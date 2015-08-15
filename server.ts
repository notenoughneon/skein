var express = require('express');
var app = express();
var http = require('http').Server(app);

app.use(express.static('static', {extensions: ['html']}));

var server = http.listen(process.argv[2], function () {
    var address = server.address();
    console.log('Listening on %s:%s', address.address, address.port);
});