require('dotenv').config()
const login = require("facebook-chat-api");
const request = require('request');

BASE_URL = 'https://api.coinmarketcap.com/v1/ticker/'
BOT_CALL = '@crypbro '

VALID_COMMANDS = [
  'id', 'name', 'symbol', 'rank', 'price_usd', 'price_btc', '24h_volume_usd',
  'market_cap_usd', 'available_supply', 'total_supply', 'percent_change_1h',
  'percent_change_24h', 'percent_change_7d', 'last_updated'
]

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
  if(VALID_COMMANDS.indexOf(parsed[1]) == -1) {
    return false;
  }

  return parsed;
}

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
        reply = 'Available commands: ' + VALID_COMMANDS.join(', ');
        api.sendMessage(reply, message.threadID);
        return;
      }

      // Get the price and message it back.
      request(BASE_URL, function (error, response, body) {
        var response = JSON.parse(body);
        var prices = {};
        for(var item in response) {
          if(response[item]['symbol'].toLowerCase() === currency ||
            response[item]['name'].toLowerCase() === currency) {
            reply = response[item]['symbol'] + ': ' + response[item][command];
            api.sendMessage(reply, message.threadID);
          }
        }
      });
    }
  });
});
