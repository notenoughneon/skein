///<reference path="typings/tsd.d.ts"/>
import fs = require('fs');
import util = require('./util');
import Site = require('./site');
import FilePublisher = require('./filepublisher');
var site = new Site(JSON.parse(fs.readFileSync('config.json').toString()));

var publisher = new FilePublisher({root: '../oldsite', postRegex: '^20[0-9][0-9]/.*\.html$'});

site.clone(publisher).
    then(util.dump).
    catch(function (e) {
        console.log(e.stack);
    });