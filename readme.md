# Bunker.net

A Discord bot built with [discord.js](https://discord.js.org/), featuring scheduled tasks and live weather data.

## Features

- 🤖 Discord bot powered by `discord.js`
- ⏰ Scheduled/recurring tasks via `node-schedule`
- 🌦️ Weather lookups via `openweather-apis`
- 🌐 Lightweight web server via `express`
- 📅 Date/time handling via `moment`

## Prerequisites

- [Node.js](https://nodejs.org/) (v12 or later recommended)
- npm
- A [Discord bot token](https://discord.com/developers/applications)
- An [OpenWeatherMap API key](https://openweathermap.org/api) (for weather features)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/GabrielSaliba/Bunker.net.git
   cd Bunker.net
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure your environment/credentials (Discord bot token, OpenWeatherMap API key, etc.) as required by `index.js`.

## Configuration

The bot's command prefix is set in `config.json`:

```json
{
  "prefix": "!bunker"
}
```

You can change `prefix` to whatever you'd like your bot's commands to start with.

## Usage

Start the bot:

```bash
npm start
```

or run it directly with:

```bash
node index.js
```

Once online, interact with the bot in your Discord server using the configured prefix, e.g.:

```
!bunker <command>
```

## Dependencies

| Package            | Purpose                   |
| ------------------ | ------------------------- |
| `discord.js`       | Discord API client        |
| `express`          | Web server                |
| `moment`           | Date/time utilities       |
| `node-schedule`    | Cron-like task scheduling |
| `openweather-apis` | Weather data integration  |

## License

ISC

## Author

[GabrielSaliba](https://github.com/GabrielSaliba)
