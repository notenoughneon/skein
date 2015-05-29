var parser = require('microformat-node');
var ejs = require('ejs');
var util = require('util');
var fs = require('fs');
var microformat = require('./microformat');

var url = process.argv[2];
var options = {filters: ['h-entry']};
var site = {
    title: 'Dummy Site Title',
    url: 'http://dummy.site',
    author: {
        name: 'My Name',
        photo: 'http://dummy.site/photo.jpg',
        note: 'Here is my bio',
        elsewhere: [
        {name: 'Twitter', url: 'https://twitter.com/test'}
        ]
    },
    webmentionUrl: 'http://api.dummy.site/webmention',
    authUrl: 'http://api.dummy.site/auth',
    tokenUrl: 'http://api.dummy.site/token',
    micropubUrl: 'http://api.dummy.site/micropub'
};

parser.parseUrl(url, options, function(err, data) {
    var entry = new microformat.Entry(data.items[0]);
    //console.log(util.inspect(entry, {depth: null}));
    var template = fs.readFileSync('template/entrypage.ejs', 'utf8');
    console.log(ejs.render(template, {site: site, entry: entry}, {filename: 'template/entrypage.ejs'}));
});
