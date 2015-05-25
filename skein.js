var parser = require('microformat-node');
var util = require('util');
var microformat = require('./microformat');

var url = process.argv[2];
var options = {filters: ['h-entry']};

parser.parseUrl(url, options, function(err, data) {
    var entry = new microformat.Entry(data.items[0]);
    console.log(util.inspect(entry, {depth: null}));
});
