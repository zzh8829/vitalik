require('dotenv').config()
const login = require("facebook-chat-api");
const request = require('request');
const rateLimit = require('function-rate-limit');

BASE_URL = 'https://api.coinmarketcap.com/v1/ticker/';
BOT_CALL = '@crypbro ';
API_RATE_LIMIT = 6000;

function idempotent(value, symbol) { return value; }
function hash_prefix(value, symbol) { return '#' + value; }
function usd_prefix(value, symbol) { return '$' + value; }
function btc_suffix(value, symbol) { return value + ' BTC'; }
function symbol_suffix(value, symbol) { return value + ' ' + symbol; }
function percent_prefix(value, symbol) { return value + '%'; }

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
  return valid && message.body.toLowerCase().startsWith(BOT_CALL)
}

// @param message [String] The string to parse.
// @return [Array<String> || Bool] The parsed command. Or False if invalid.
function parseCall(message) {
  var parsed = message.toLowerCase();
  parsed = parsed.replace('vitalik ', '');
  parsed = parsed.replace(BOT_CALL, '').split(' ');

  // If it's just the currency, return the price
  if(parsed.length == 1) parsed.push('price_usd');

  // Make sure it's a valid command length.
  if(parsed.length > 2) return false;

  // Check if they asked for price - invalid command but we want to make it work
  if(parsed[1] == 'price') parsed[1] = 'price_usd';

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
          return;
        } else {
          value = response[item][command];
          api.sendMessage(formatOutput(symbol, value, command), threadID);
          return;
        }
      }
    }
    api.sendMessage('Invalid command.', threadID);
  });
});

credentials = { email: process.env.EMAIL, password: process.env.PASSWORD }
console.log(credentials);
login(credentials, (err, api) => {
  if(err) return console.error(err);

  api.listen((err, message) => {
    if(validBotCall(message)) {
      // Check if the most important question was asked.
      if(message.body.toLowerCase().indexOf('why did you hard-fork?') != -1) {
        api.sendMessage('I have so many regrets.', message.threadID);
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


var express = require('express');
var app     = express();
app.set('port', (process.env.PORT || 5000));
app.get('/', function(request, response) {
  var result = 'App is running'
  response.send(result);
}).listen(app.get('port'), function() {
  console.log('App is running, server is listening on port ', app.get('port'));
});
