var parser = require('microformat-node');
var ejs = require('ejs');
var util = require('util');
var fs = require('fs');
var microformat = require('./microformat');

var url = process.argv[2];
var options = {filters: ['h-entry']};

parser.parseUrl(url, options, function(err, data) {
    var entry = new microformat.Entry(data.items[0]);
    //console.log(util.inspect(entry, {depth: null}));
    var template = fs.readFileSync('template/entry.ejs', 'utf8');
    console.log(ejs.render(template, {entry: entry}, {filename: 'template/entry.ejs'}));
});
