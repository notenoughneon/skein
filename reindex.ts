var fs = require('fs');
var util = require('./util');

if (process.argv[2] === undefined)
    var configFile = 'config.json';
else
    configFile = process.argv[2];
var site = require('./site').init(JSON.parse(fs.readFileSync(configFile)));

site.reIndex().
    then(util.dump).
    catch(function (e) {
        console.log(e.stack);
    });