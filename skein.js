var parser = require('microformat-node');
var util = require('util');

var url = process.argv[2];
var options = {filters: ['h-entry']};

parser.parseUrl(url, options, function(err, data) {
    console.log(util.inspect(data, {depth: null}));
});
