///<reference path="typings/tsd.d.ts"/>
import fs = require('fs');
import util = require('./util');
import Site = require('./site');

if (process.argv[2] === undefined)
    var configFile = 'config.json';
else
    configFile = process.argv[2];
var site = new Site(JSON.parse(fs.readFileSync(configFile).toString()));

site.reIndex().
    then(util.dump).
    catch(function (e) {
        console.log(e.stack);
    });