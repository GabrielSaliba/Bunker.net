# Bunker.net — Internal Logic Wiki

This document explains how `index.js` actually works internally: architecture, state, commands, scheduled jobs, and the weather-alert logic. Bot-facing text is in Portuguese; this wiki is in English for reference.

---

## 1. Overview

Bunker.net is a single-file Discord bot (`index.js`) that:

1. Runs a tiny Express server whose only job is to answer pings so an external uptime/keep-alive service can stop the process from sleeping (common pattern for free hosts like Heroku/Repl.it).
2. Connects to Discord via `discord.js` v12.
3. Lets moderators register text channels as "subscribers" to weather alerts.
4. Polls the OpenWeatherMap API (via `openweather-apis`) on a fixed schedule and, when the forecast matches a "warning" or "danger" weather code, broadcasts an alert to every subscribed channel.
5. Sends a scheduled "good morning" weather summary once a day.

There is no database — all state (subscribed channels, cooldown timers) lives in memory and is lost on restart.

---

## 2. Startup sequence

```
require dependencies
 → create Express app, set weather language (pt) and moment locale (pt-br)
 → define GET / (ping/health-check route)
 → app.listen(process.env.PORT)
 → require discord.js, create Client
 → load config.json (command prefix)
 → initialize in-memory state (channels[], cooldown timers, startTime)
 → client.login(process.env.TOKEN)
 → on 'ready': log online, call initializeWeatherApi()
 → register message listeners (commands)
 → schedule two cron-style jobs
```

### Required environment variables

| Variable            | Used for                                      |
| ------------------- | --------------------------------------------- |
| `TOKEN`             | Discord bot token (`client.login`)            |
| `PORT`              | Port the Express keep-alive server listens on |
| `WEATHER_API_TOKEN` | OpenWeatherMap API key (`weather.setAPPID`)   |
| `VERSION`           | Displayed by the `sobre` (about) command      |
| `GITHUB`            | Displayed by the `sobre` command (repo link)  |

### Hardcoded configuration

- **City**: `Betim` — set once in `initializeWeatherApi()`. The bot only ever checks weather for this single city; it is **not** per-channel or per-server configurable.
- **Units**: metric (°C).
- **Command prefix**: read from `config.json` (`"prefix": "!bunker"`), but note commands are matched as `prefix + ' ' + word(s)`, e.g. `!bunker previsão`.

---

## 3. In-memory state

| Variable                 | Type       | Purpose                                                                                                |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------------------------ |
| `channels`               | `string[]` | IDs of Discord channels subscribed to weather alerts. Not persisted to disk — resets on every restart. |
| `warningCodes`           | `number[]` | OpenWeatherMap condition codes treated as "⚠️ Atenção" (Attention).                                    |
| `dangerCodes`            | `number[]` | OpenWeatherMap condition codes treated as "🚨 PERIGO!!!" (Danger).                                     |
| `scheduleCooldown`       | moment     | Earliest time the _scheduled_ monitoring job is allowed to broadcast again. Starts 30s in the future.  |
| `timeCooldown`           | moment     | Earliest time the scheduled job may fire relative to the last **manual** `previsão` check.             |
| `startTime`              | moment     | Bot boot time, used for uptime display in `sobre`.                                                     |
| `morningMessageCooldown` | moment     | Gate to prevent the daily morning job from double-firing.                                              |

---

## 4. Commands

All commands are registered as separate `client.on('message', ...)` listeners (one listener per command — see [§7 Notes](#7-notes--quirks) for why this is inefficient). Format: `!bunker <command>`.

| Command           | Behavior                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `adicionar canal` | Adds the current channel's ID to `channels` (if not already present) and confirms.                                                    |
| `remover canal`   | Removes the current channel's ID from `channels` (if present) and confirms.                                                           |
| `listar canais`   | Lists all subscribed channel IDs and the total count.                                                                                 |
| `previsão`        | Fetches current weather immediately via `getCurrentWeather()`, replies in-channel, and pushes `timeCooldown` forward 1 hour.          |
| `sobre`           | Shows bot version (`VERSION` env var), uptime (`startTime.fromNow()`), and the GitHub link (`GITHUB` env var).                        |
| `cooldown`        | Shows the current values of `scheduleCooldown` and `timeCooldown` (adjusted -3h, likely a UTC→BRT correction) in human-readable form. |

---

## 5. Scheduled jobs (`node-schedule`)

### 5.1 Weather monitoring job

```js
schedule.scheduleJob("*/20 * * * * *", scheduledWeatherMonitoring);
```

Runs **every 20 seconds**. Each run calls `scheduledWeatherMonitoring()`, which:

1. Checks whether `now >= timeCooldown` **and** `now >= scheduleCooldown`. If not, it does nothing (still "cooling down").
2. If clear, it fetches the current weather once and, for **every subscribed channel**, sends an alert if the weather code matches `warningCodes` or `dangerCodes`, plus a general forecast summary.
3. Resets `scheduleCooldown` to 2 hours in the future.

Effectively: the bot polls every 20s but only actually notifies channels at most once every 2 hours (or once per hour after someone manually runs `previsão`, via `timeCooldown`).

### 5.2 Morning message job

```js
schedule.scheduleJob({ hour: 13 }, ...)
```

Fires once whenever the clock hits **hour 13** (server-local time, minute unspecified so it triggers on minute 0). If `now > morningMessageCooldown`, it sends "Bom dia!" plus a weather summary to every subscribed channel, then pushes `morningMessageCooldown` 12 hours ahead (a guard against the job re-firing within the same "day cycle").

---

## 6. Weather classification logic

`getCurrentWeather()` (manual `previsão` command) and `scheduledWeatherMonitoring()` (automatic) both call `weather.getSmartJSON()` and classify the returned `weathercode`:

- Code in `warningCodes` → send **"Atenção!"**
- Code in `dangerCodes` → send **"PERIGO!!!"**
- Either way, a formatted message follows with description, temperature (°C), and humidity (%), plus a disclaimer that forecasts aren't always accurate.

`warningCodes` (500–522, 531 range) correspond to OpenWeatherMap rain/storm codes (moderate rain through severe thunderstorms).
`dangerCodes` (200–232 range) correspond to thunderstorm codes (thunderstorm with light rain through heavy hail).

> Note: in the OpenWeatherMap scheme these ranges are actually inverted from typical severity assumptions — the "danger" list (200s) is thunderstorms, and "warning" list (500s+) is heavier rain/extreme conditions. Worth double-checking against OpenWeatherMap's [condition code table](https://openweathermap.org/weather-conditions) if you plan to extend this logic.

---

## 7. Notes & quirks

- **discord.js v12 + `'message'` event**: this is the pre-v13 event name (later renamed `messageCreate`). Upgrading discord.js without updating this code would break every command.
- **Exact string matching**: commands use `message.content === config.prefix + ' comando'` — no trimming, no case-insensitivity, no argument parsing. Extra whitespace or different casing won't match.
- **One listener per command**: each command is its own `client.on('message', ...)` call rather than a single listener with a switch/if-else chain. Functionally fine at this scale, but means every message triggers 6 separate handler invocations.
- **Single global city**: weather is fetched once for `Betim` and broadcast to _all_ subscribed channels regardless of server — there's no per-guild location support.
- **No persistence**: `channels` lives only in memory; a restart (e.g. redeploy) silently unsubscribes every channel.
- **Two independent cooldown systems** (`timeCooldown` for manual-triggered delay, `scheduleCooldown` for the periodic job) interact only through the `&&` check in `scheduledWeatherMonitoring()` — both must be satisfied for an automatic broadcast to fire.
- **Express server** exists purely to keep the process alive on platforms that spin down idle web dynos; it has no relation to the bot's actual functionality beyond that.

---
