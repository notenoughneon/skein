var ejs = require('ejs');
var fs = require('fs');
var url = require('url');
var nodefn = require('when/node');
var util = require('./util');
var db = require('./db');

var config = {
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

function getPathForUrl(u) {
    return __dirname + url.parse(u).pathname + '.html';
}

function store(entry) {
    return nodefn.call(ejs.renderFile, 'template/entrypage.ejs', {site: config, entry: entry}).
        then(function (html) {
            return util.writeFileP(getPathForUrl(entry.url[0]), html);
        });
}

exports.store = store;