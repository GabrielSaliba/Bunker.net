const express = require('express');
const schedule = require('node-schedule');
var weather = require('openweather-apis');
var moment = require('moment');

const app = express();

weather.setLang('pt');
moment.locale('pt-br');


app.get("/", (request, response) => {
  const ping = new Date();
  ping.setHours(ping.getHours() - 3);
  console.log(`Ping recebido às ${ping.getUTCHours()}:${ping.getUTCMinutes()}:${ping.getUTCSeconds()}`);
  response.sendStatus(200);
});
app.listen(process.env.PORT); // Recebe solicitações que o deixa online

const Discord = require("discord.js"); //Conexão com a livraria Discord.js
const client = new Discord.Client(); //Criação de um novo Client
const config = require("./config.json"); //Pegando o prefixo do bot para respostas de comandos

let channels = []
let warningCodes = [500, 501, 502, 503, 504, 511, 520, 521, 522, 531]
let dangerCodes = [200, 201, 202, 210, 211, 212, 221, 230, 231, 232]
let scheduleCooldown = moment().add(30, 'seconds')
let timeCooldown = moment()
let startTime = moment()
let morningMessageCooldown = moment()

client.login(process.env.TOKEN);

client.on('ready', () => {
  console.log('Bunker.net Online!');
  initializeWeatherApi();
});

client.on('message', message => {
  if (message.content === config.prefix + ' adicionar canal') {

    if(channels.includes(message.channel.id)) {
      message.channel.send("Canal já adicionado à Bunker.net")
      return
    }
    channels.push(message.channel.id)
    message.channel.send("Canal adicionado à Bunker.net.")
    message.channel.send("Bunker.net Online! \nIremos sempre te notificar ao receber uma previsão de uma possível tempestade.")
  }
});

client.on('message', message => {
  if (message.content === config.prefix + ' remover canal') {

    if(!channels.includes(message.channel.id)) {
      message.channel.send("Canal não presente na Bunker.net")
      return
    }

    channels.splice(channels.indexOf(message.channel.id), 1)
    message.channel.send("Canal removido da Bunker.net.")
  }
});

client.on('message', message => {
  if (message.content == config.prefix + ' listar canais') {
    if (channels.length > 0) {
      message.channel.send("Canais na rede Bunker.net: " + channels)
    }
    else {
      message.channel.send("Nenhum canal adicionado à rede Bunket.net.")
    }
    message.channel.send(`Contagem total: ${channels.length} canais`)
  }
});

client.on('message', message => {
  if (message.content == config.prefix + ' previsão') {
    getCurrentWeather(message)
    timeCooldown = moment().add(1, 'hours')
  }
})

client.on('message', message => {
   if (message.content == config.prefix + ' sobre') {
     message.channel.send(`Bunker.net v${process.env.VERSION} \nTempo de serviço ativo: ${startTime.fromNow()} \n${process.env.GITHUB}`)
   }
})

client.on('message', message => {
   if (message.content == config.prefix + ' cooldown') {
     message.channel.send(`Cooldown Mensagem Programada: ${moment(scheduleCooldown).subtract(3, 'hours').calendar()} \nCooldown Mensagem Usuário: ${moment(timeCooldown).subtract(3, 'hours').calendar()}`)
   }
})

var job = schedule.scheduleJob('*/20 * * * * *', function(){
    scheduledWeatherMonitoring()
  });

var startDayJob = schedule.scheduleJob({hour: 13}, function(){
    if(moment() > morningMessageCooldown) {
      channels.forEach(item => {
        const channel = client.channels.cache.find(channel => channel.id === item)
        channel.send("Bom dia!")
        weather.getSmartJSON(function(err, smart) {
        channel.send(`Previsão de clima recente: ${capitalize(smart.description)} \nTemperatura atual: ${smart.temp} ºC \nUmidade do ar: ${smart.humidity}% \nServiços Bunker.net em execução monitorando o clima.`)
      });
      morningMessageCooldown = moment().add(12, 'hours')
    })
  }
});

function getCurrentWeather(message) {
  weather.getSmartJSON(function(err, smart){
      if (warningCodes.includes(smart.weathercode)) {
        message.channel.send("Atenção!")
      }

      if (dangerCodes.includes(smart.weathercode)) {
        message.channel.send("PERIGO!!!")
      }

      message.reply(`Previsão de clima recente: ${smart.description} \nTemperatura atual: ${smart.temp} ºC \nUmidade do ar: ${smart.humidity}% \nLeve em consideração que as informações exibidas são apenas previsões para lhe ajudar, e nem sempre representam a realidade \nObrigado por usar os serviçoes da Bunker.net`)
  });
}

function scheduledWeatherMonitoring() {
    if(moment() >= timeCooldown && moment() >= scheduleCooldown) {
      channels.forEach(item => {
      const channel = client.channels.cache.find(channel => channel.id === item)
      weather.getSmartJSON(function(err, smart) {
        if (warningCodes.includes(smart.weathercode) || (warningCodes.includes(smart.weathercode))) {
          if (warningCodes.includes(smart.weathercode)) {
            channel.send("Atenção!")
          }

          if (dangerCodes.includes(smart.weathercode)) {
            channel.send("PERIGO!!!")
          }

          channel.send(`Previsão de clima recente: ${capitalize(smart.description)} \nTemperatura atual: ${smart.temp} ºC \nUmidade do ar: ${smart.humidity}% \nLeve em consideração que as informações exibidas são apenas previsões para lhe ajudar, e nem sempre representam a realidade \nObrigado por usar os serviçoes da Bunker.net`)
        }
      })
    })
    scheduleCooldown = moment().add(2, 'hours')
  }
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function initializeWeatherApi() {
  weather.setCity('Betim');
  weather.setUnits('metric');
  weather.setAPPID(process.env.WEATHER_API_TOKEN);
  console.log("API de Clima inicializada.")
}