require('dotenv').config()
const login = require("facebook-chat-api");
const request = require('request');
const rateLimit = require('function-rate-limit');

BASE_URL = 'https://api.coinmarketcap.com/v1/ticker/';
BOT_CALL = '@Vitalik Wallet ';
API_RATE_LIMIT = 6000;

function idempotent(value, symbol) { return value; }
function hash_prefix(value, symbol) { return '#' + value; }
function usd_prefix(value, symbol) { return '$' + value; }
function btc_suffix(value, symbol) { return value + ' BTC'; }
function symbol_suffix(value, symbol) { return value + ' ' + symbol; }
function percent_prefix(value, symbol) { return value + '%'; }

MAPPINGS = {
  'price' : 'price_btc',
  'volume' : '24h_volume_usd',
  'market_cap' : 'market_cap_usd',
  'supply' : 'total_supply',
  'change_1h' : 'percent_change_1h',
  'change_24h' : 'percent_change_24h',
  'change_7d' : 'percent_change_7d',
}

VALID_COMMANDS = {
  'rank' : hash_prefix,
  'price_usd' : usd_prefix,
  'price_btc' : btc_suffix,
  '24h_volume_usd' : usd_prefix,
  'market_cap_usd' : usd_prefix,
  'available_supply' : symbol_suffix,
  'total_supply' : symbol_suffix,
  'percent_change_1h' : percent_prefix,
  'percent_change_24h' : percent_prefix,
  'percent_change_7d' : percent_prefix,
  'last_updated' : idempotent
}

// @param message [Object] The message object sent from Facebook.
// @return [Boolean] True if the message is directed at the bot.
function validBotCall(message) {
  valid = message != undefined && message.body != undefined;
  return valid && message.body.toLowerCase().startsWith(BOT_CALL.toLowerCase())
}

// @param message [String] The string to parse.
// @return [Array<String> || Bool] The parsed command. Or False if invalid.
function parseCall(message) {
  var parsed = message.toLowerCase();
  parsed = parsed.replace(BOT_CALL.toLowerCase(), '').split(' ');

  // If it's just the currency, return the price
  if(parsed.length == 1) parsed.push('price_usd');

  // Make sure it's a valid command length.
  if(parsed.length > 2) return false;

  // Check if they asked for an invalid command (but we want to make it work)
  if(Object.keys(MAPPINGS).indexOf(parsed[1]) != -1) {
    parsed[1] = MAPPINGS[parsed[1]];
  }

  // Make sure that the command sent is valid.
  if(Object.keys(VALID_COMMANDS).indexOf(parsed[1]) == -1) {
    if(parsed[1] != 'numbers') return false;
  }

  return parsed;
}

// @param response_item [Hash] The response item from CMC for a specific coin.
// @param currency [String] The ticker symbol of the desired currency.
// @return [Bool] True if the currency matches the blob, false otherwise.
function matchingBlob(response_item, currency) {
  return (response_item['symbol'].toLowerCase() === currency ||
          response_item['name'].toLowerCase() === currency);
}

// @param symbol [String] The ticker symbol of the desired currency.
// @param value [String] The value retrieved from CMC.
// @param command [String] The command given by the user.
// @return [String] A formatted response to send.
function formatOutput(symbol, value, command) {
  value = parseFloat(value);
  value = parseFloat(value.toFixed(2)).toLocaleString();
  value = VALID_COMMANDS[command](value, symbol);
  return value;
}

database = {

}

function initMoney(message, api, cb) {
  console.log('init')
  console.log(message)

  database[message.threadID] = {}

  api.getThreadInfo(message.threadID, function(err, info) {
    ids = info.participantIDs
    api.getUserInfo(ids, (err, ret) => {
      if(err) return console.error(err);

      for(var prop in ret) {
        if(ret.hasOwnProperty(prop)) {
          database[message.threadID][prop] = {
            info: ret[prop],
            money: {
              ETH: 100,
            }
          }
        }
      }

      console.log(database)
      api.sendMessage('Wallet Initialized', message.threadID);

      if(cb) cb();
    });
  })
}

function sendMoney(message, api) {
  console.log('send')
  console.log(message)
  const re = /^(\d+(\.\d+)?) ([A-Z]+) to @(.+)$/;

  const txt = message.body.substring((BOT_CALL + 'send ').length)

  const match = re.exec(txt)

  if(match != null) {

    const fromId = message.senderID
    const amount = parseFloat(match[1])
    const cur = match[3]
    const toName = match[4]

    let toId = null;
    for(var id in database[message.threadID]) {
      if(database[message.threadID][id]['info']['name'] === toName) {
        toId = id;
        break;
      }
    }

    if(!toId) {
      api.sendMessage('Invalid Recipient ' + toName, message.threadID);
      return;
    }

    if(cur in database[message.threadID][fromId]['money'] &&
       database[message.threadID][fromId]['money'][cur] >= amount) {

      if(!(cur in database[message.threadID][toId]['money'])) {
        database[message.threadID][toId]['money'][cur] = 0
      }

      database[message.threadID][fromId]['money'][cur] -= amount;
      database[message.threadID][toId]['money'][cur] += amount;

      const msg = `Success, @${database[message.threadID][fromId]['info']['name']} sent ${amount} ${cur} to @${toName}`

      console.log(msg)
      api.sendMessage(msg, message.threadID)
    } else {
      api.sendMessage('You got no $$', message.threadID);
    }
  } else {
    api.sendMessage('Invalid Command', message.threadID);
  }
}

function convertMoney(message, api) {
  const re = /^(\d+(\.\d+)?) ([A-Z]+) to ([A-Z]+)$/;

  const txt = message.body.substring((BOT_CALL + 'convert ').length)

  const match = re.exec(txt)

  if(match != null) {

    const fromId = message.senderID;
    const toId = fromId;
    const amount = parseFloat(match[1])
    const cur1 = match[3]
    const cur2 = match[4]

    request(BASE_URL, function (error, response, body) {
      const data = JSON.parse(body);
      const table = {}
      for(var item in data) {
        table[data[item]['symbol']] = data[item];
      }

      if(cur1 in table && cur2 in table) {
        rate = parseFloat(table[cur1]['price_usd']) / parseFloat(table[cur2]['price_usd'])

        cur2_amount = amount * rate
        if(cur1 in database[message.threadID][fromId]['money'] &&
           database[message.threadID][fromId]['money'][cur1] >= amount) {

          if(!(cur2 in database[message.threadID][toId]['money'])) {
            database[message.threadID][toId]['money'][cur2] = 0
          }

          database[message.threadID][fromId]['money'][cur1] -= amount;
          database[message.threadID][toId]['money'][cur2] += cur2_amount;

          const msg = `Success, @${database[message.threadID][fromId]['info']['name']} converted ${amount} ${cur1} to ${cur2_amount.toFixed(5).replace(/\.0+$/,'')} ${cur2}`
          console.log(msg)
          api.sendMessage(msg, message.threadID)
        } else {
          api.sendMessage('You got no $$', message.threadID);
        }
      } else {
        api.sendMessage(`Invalid Currency Pair ${cur1} ${cur2}`, message.threadID);
      }
    });
  } else {
    api.sendMessage('Invalid Command', message.threadID);
  }
}

function showMoney(message, api) {
  console.log(database)

  if(!(message.threadID in database)) {
    initMoney(message, api, function() {
      showMoney(message, api);
    });
    return;
  }

  user = database[message.threadID][message.senderID]

  request(BASE_URL, function (error, response, body) {
    const data = JSON.parse(body);

    money = ''
    value = 0
    for(var cur in user['money']) {
      if(user['money'][cur] != 0) {
        if(money) money += ', '
        money += `${user['money'][cur].toFixed(5).replace(/\.0+$/,'')} ${cur}`

        for(var item in data) {
          if(data[item]['symbol'] === cur) {
            value += user['money'][cur] * parseFloat(data[item]['price_usd'])
          }
        }
      }
    }

    if(!money) money = 'nothing';

    const msg = `@${user['info']['name']} has ${money}, networth $${value.toFixed(2).replace(/\.0+$/,'')} USD`

    api.sendMessage(msg, message.threadID);
  });
}

// @param currency [String] The ticker symbol to look for.
// @param command [String] The command the user asked for.
// @param api [Object] The API object from facebook-chat-api.
// @param threadID [String] The ID of the thread to respond to.
var respondToQuery = rateLimit(1, API_RATE_LIMIT, function(
      currency, command, api, threadID
  ) {
  request(BASE_URL, function (error, response, body) {
    var response = JSON.parse(body);

    for(var item in response) {
      if(matchingBlob(response[item], currency)) {
        symbol = response[item]['symbol'];
        if(command == 'numbers') {
          value = 'Numbers for ' + currency.toUpperCase() + ': ';
          for(var cmd in Object.keys(VALID_COMMANDS)) {
            cmd = Object.keys(VALID_COMMANDS)[cmd];
            cmd_value = response[item][cmd];
            value += '\n' + cmd + ': ' + formatOutput(symbol, cmd_value, cmd);
          }
          api.sendMessage(value, threadID);
        } else {
          value = response[item][command];
          api.sendMessage(formatOutput(symbol, value, command), threadID);
        }
        return;
      }
    }
    api.sendMessage('Invalid command.', threadID);
  });
});

credentials = { email: process.env.EMAIL, password: process.env.PASSWORD }
console.log(credentials);
login(credentials, (err, api) => {
  if(err) return console.error(err);


  api.setOptions({listenEvents: true})

  api.listen((err, message) => {
    console.log(message);

    if(validBotCall(message)) {
      // Check if the most important question was asked.
      if(message.body.toLowerCase().indexOf('why did you hard-fork?') != -1) {
        api.sendMessage('I have so many regrets.', message.threadID);
        return;
      }

      const msg = message.body.substring(BOT_CALL.length);
      if(msg.toLowerCase() === 'init') {
        initMoney(message, api)
        return;
      }
      if(msg.toLowerCase() === 'balance') {
        showMoney(message, api)
        return;
      }
      if(msg.toLowerCase().startsWith('send ')) {
        sendMoney(message, api)
        return;
      }
      if(msg.toLowerCase().startsWith('convert ')) {
        convertMoney(message, api)
        return;
      }

      // Now we know that the message is directed at the bot.
      var parsed = parseCall(message.body);
      if(parsed === false) {
        api.sendMessage('Invalid command.', message.threadID);
        return;
      }
      currency = parsed[0];
      command = parsed[1];

      // Edge-case: the only command that has one word is help.
      if(currency == 'help') {
        commands = Object.keys(VALID_COMMANDS).join(', ');
        reply = 'Available commands: ' + commands;
        api.sendMessage(reply, message.threadID);
        return;
      }

      respondToQuery(currency, command, api, message.threadID);
    }
  });
});

// We listen on whatever port Heroku sets for us so that the dyno doesn't crash.
// Read: This is the most hacky code I've ever written.
var express = require('express');
var app     = express();
app.set('port', (process.env.PORT || 5000));
app.get('/', function(request, response) {
  response.send('Application is running.');
}).listen(app.get('port'), function() {});
