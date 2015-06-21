var express = require('express');
var app = express();
var http = require('http').Server(app);

app.use(express.static('static'));

var server = http.listen(80, function () {
    var address = server.address();
    console.log('Listening on %s:%s', address.address, address.port);
});