require('dotenv').config()
const login = require("facebook-chat-api");
const request = require('request');
var rateLimit = require('function-rate-limit');

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
  'id' : idempotent,
  'name' : idempotent,
  'symbol' : idempotent,
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
  if(parsed.length == 1) {
    parsed.push('price_usd');
  }

  // Make sure it's a valid command length.
  if(parsed.length > 2) {
    return false;
  }

  // Check if they asked for price - invalid command but we want to make it work
  if(parsed[1] == 'price') {
    parsed[1] = 'price_usd';
  }

  // Make sure that the command sent is valid.
  if(Object.keys(VALID_COMMANDS).indexOf(parsed[1]) == -1) {
    return false;
  }

  return parsed;
}

var sendRequest = rateLimit(1, API_RATE_LIMIT, function(
    currency, command, api, message
  ) {
  // Get the price and message it back.
  request(BASE_URL, function (error, response, body) {
    var response = JSON.parse(body);
    var prices = {};
    var foundCoin = false;
    for(var item in response) {
      if(response[item]['symbol'].toLowerCase() === currency ||
          response[item]['name'].toLowerCase() === currency) {
        symbol = response[item]['symbol']
          value = parseFloat(response[item][command]);
        value = parseFloat(value.toFixed(2)).toLocaleString();
        value = VALID_COMMANDS[command](value, symbol);
        api.sendMessage(value, message.threadID);
        foundCoin = true;
      }
    }
    if(!foundCoin) {
      api.sendMessage('Invalid command.', message.threadID);
    }
  });
});

credentials = { email: process.env.EMAIL, password: process.env.PASSWORD }
login(credentials, (err, api) => {
  if(err) return console.error(err);

  api.listen((err, message) => {
    console.log('Got a message: ' + message.body);

    if(validBotCall(message)) {
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

      sendRequest(currency, command, api, message);
    }
  });
});
