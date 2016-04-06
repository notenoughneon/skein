import fs = require('fs');
import repl = require('repl');
import express = require('express');
import Site = require('./site');
import ApiServer = require('./apiserver');

var app = express();
var config = JSON.parse(fs.readFileSync(process.argv[2]).toString());
var site = new Site(config);
var api = new ApiServer(site);

app.use('/api', api.router);

if (config.staticSiteRoot != null)
    app.use(express.static(config.staticSiteRoot, {extensions: ['html']}));

// var server = http.listen(process.argv[2], function () {
//     var address = server.address();
//     console.log('Listening on %s:%s', address.address, address.port);
// });

app.set('views', './template');
app.set('view engine', 'jade');

var server = app.listen(config.port);

if (process.argv[3] == '-i')
    repl.start('> ').context.site = site;