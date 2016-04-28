import fs = require('fs');
import repl = require('repl');
import express = require('express');
import http = require('http');
import https = require('https');
import Site = require('./site');
import Api = require('./api');

var app = express();
var configFile = process.argv[2];
var config = JSON.parse(fs.readFileSync(configFile).toString());
var site = new Site(config);
var api = new Api(site);
site.init();

app.use('/api', api.router);
app.disable('x-powered-by');
app.set('views', './template');
app.set('view engine', 'jade');

if (config.staticSiteRoot != null)
    app.use(express.static(config.staticSiteRoot, {extensions: ['html']}));

var server;

if (config.keyFile != null && config.certFile != null) {
    var key = fs.readFileSync(config.keyFile);
    var cert = fs.readFileSync(config.certFile);
    server = https.createServer({key, cert}, app);
} else {
    server = http.createServer(app);
}

server.listen(config.port);

if (process.argv[3] == '-i')
    repl.start('> ').context.site = site;