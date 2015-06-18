var ejs = require('ejs');
var url = require('url');
var nodefn = require('when/node');
var util = require('./util');
var db = require('./db');

var config = {
    title: 'Dummy Site Title',
    url: 'http://notenoughneon.com',
    author: {
        name: 'My Name',
        photo: 'http://dummy.site/photo.jpg',
        note: 'Here is my bio',
        elsewhere: [
            {name: 'Twitter', url: 'https://twitter.com/test'}
        ]
    },
    entriesPerPage: 10,
    webmentionUrl: 'http://api.dummy.site/webmention',
    authUrl: 'http://api.dummy.site/auth',
    tokenUrl: 'http://api.dummy.site/token',
    micropubUrl: 'http://api.dummy.site/micropub'
};

function getPathForUrl(u) {
    return __dirname + url.parse(u).pathname + '.html';
}

function getPathForIndex(page) {
    return 'index' + (page == 1 ? '' : page) + '.html';
}

function store(entry) {
    return db.store(entry).
        then(nodefn.lift(ejs.renderFile, 'template/entrypage.ejs', {site: config, entry: entry})).
        then(nodefn.lift(util.writeFile, getPathForUrl(entry.url[0])));
}

function generateIndex() {
    var limit = config.entriesPerPage;
    var offset = 0;
    var page = 1;

    function chain() {
        return db.getAllByAuthor(config.url, limit, offset).
            then(function(entries) {
                if (!entries) return null;
                return nodefn.call(ejs.renderFile, 'template/indexpage.ejs', {site: config, entries: entries, page: page}).
                    then(nodefn.lift(util.writeFile, getPathForIndex(page))).
                    then(function() {
                        offset += limit;
                        page += 1;
                    }).
                    then(chain);
            });
    }
    return chain();
}

exports.store = store;
exports.generateIndex = generateIndex;