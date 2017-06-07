const login = require("facebook-chat-api");
const request = require('request');

FB_EMAIL = 'crypbro.vitalik@gmail.com'
FB_PASSWORD = 'Kdhomw&!LxpQgHn#@ANhzJ3R#Y^n@i7U&cAu1h1HHra'

BASE_URL = 'https://api.coinmarketcap.com/v1/ticker/'
BOT_CALL = '@CRYPBRO '

VALID_COMMANDS = [
  'id', 'name', 'symbol', 'rank', 'price_usd', 'price_btc', '24h_volume_usd',
  'market_cap_usd', 'available_supply', 'total_supply', 'percent_change_1h',
  'percent_change_24h', 'percent_change_7d', 'last_updated'
]

login({email: FB_EMAIL, password: FB_PASSWORD}, (err, api) => {
    if(err) return console.error(err);

    api.listen((err, message) => {
        console.log('Got message:');
        console.log(message);
        if(message != undefined && message.body != undefined &&
           message.body.toUpperCase().startsWith(BOT_CALL)) {
            console.log('It was directed at me!');
            var interpret = message.body.toUpperCase();
            interpret = interpret.replace('VITALIK ', '');
            var cmd = interpret.replace(BOT_CALL, '').split(' ');
            var currency = cmd[0];
            var command = (cmd.length == 2) ? cmd[1] : 'PRICE_USD';
            if(command === 'PRICE') {
              command = 'PRICE_USD';
            }
            console.log('Interpreted as ' + currency + ' and ' + command);

            if(currency == 'HELP') {
              reply = 'Available commands: ';
              for(var cmd in VALID_COMMANDS) {
                reply += VALID_COMMANDS[cmd] + ', ';
              }
              api.sendMessage(reply, message.threadID);
            } else if(VALID_COMMANDS.indexOf(command.toLowerCase()) == -1) {
              api.sendMessage('Invalid command.', message.threadID);
            } else {
                request(BASE_URL, function (error, response, body) {
                    console.log('Sending request...');
                    var response = JSON.parse(body);
                    var prices = {};
                    for(var item in response) {
                        if(response[item]['symbol'].toUpperCase() === currency ||
                           response[item]['name'].toUpperCase() === currency) {
                           console.log(response[item]);
                           console.log(command.toLowerCase());
                           reply = response[item][command.toLowerCase()];
                           reply = response[item]['symbol'] + ': ' + reply
                           console.log('Responding with ' + reply);
                           api.sendMessage(reply, message.threadID);
                        }
                    }
               });
            }
        }
    });
});
