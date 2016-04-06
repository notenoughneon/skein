import fs = require('fs');
import repl = require('repl');
import Debug = require('debug');
var debug = Debug('server');
import express = require('express');
import Site = require('./site');
import Api = require('./api');

var app = express();
var configFile = process.argv[2];
var config = JSON.parse(fs.readFileSync(configFile).toString());
var site = new Site(config);
var api = new Api(site);

var watcher = (event, filename) => {
    if (event === 'change') {
        fs.readFile(configFile, (err, data) => {
            site.config = JSON.parse(data.toString());
            debug('reloaded config');
        });
    }
};
fs.watch(configFile, watcher);

app.use('/api', api.router);

if (config.staticSiteRoot != null)
    app.use(express.static(config.staticSiteRoot, {extensions: ['html']}));

app.set('views', './template');
app.set('view engine', 'jade');

var server = app.listen(config.port);

if (process.argv[3] == '-i')
    repl.start('> ').context.site = site;