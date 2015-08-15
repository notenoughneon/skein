var fs = require('fs');
var util = require('./util');
var site = require('./site').init(JSON.parse(fs.readFileSync('config.json')));

var publisher = require('./filepublisher').init({root: '../oldsite', postRegex: '^20[0-9][0-9]/.*\.html$'});

site.import(publisher).
    then(util.dump).
    catch(function (e) {
        console.log(e.stack);
    });