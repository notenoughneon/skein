var ejs = require('ejs');
var url = require('url');
var nodefn = require('when/node');
var util = require('./util');
var db = require('./db');

var site = {
    title: 'Not Enough Neon',
    url: 'http://notenoughneon.com',
    author: {
        name: 'Emma Kuo',
        photo: '/m/emma-tw-73.jpeg',
        note: 'Here is my bio',
        elsewhere: [
            {name: 'Twitter', url: 'https://twitter.com/notenoughneon'}
        ]
    },
    entriesPerPage: 10,
    webmentionUrl: 'http://api.dummy.site/webmention',
    authUrl: 'http://api.dummy.site/auth',
    tokenUrl: 'http://api.dummy.site/token',
    micropubUrl: 'http://api.dummy.site/micropub'
};

function getPathForUrl(u) {
    return __dirname + '/static/' + url.parse(u).pathname + '.html';
}

function getUrlForIndex(page) {
    return 'index' + (page == 1 ? '' : page) + '.html';
}

function getPathForIndex(page) {
    return __dirname + '/static/' + getUrlForIndex(page);
}

function truncate(s, len) {
    if (s.length > len)
        return s.substr(0, len) + '...';
    return s;
}

function formatDate(datestring) {
    var month = ["Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"];
    var d = new Date(datestring);
    var minutes = d.getMinutes();
    if (minutes < 10) minutes = '0' + minutes;
    return d.getDate() + ' ' +
        month[d.getMonth()] + ' ' +
        d.getFullYear() + ' ' +
        d.getHours() + ':' +
        minutes;
}

var templateUtils = {
    formatDate: formatDate,
    getUrlForIndex: getUrlForIndex,
    truncate: truncate
};

function store(entry) {
    return db.store(entry).
        then(nodefn.lift(ejs.renderFile, 'template/entrypage.ejs', {site: site, entry: entry, utils: templateUtils})).
        then(util.writeFile.bind(null, getPathForUrl(entry.url[0])));
}

function generateIndex() {
    var limit = site.entriesPerPage;
    var offset = 0;
    var page = 1;

    function chain() {
        return db.getAllByAuthor(site.url, limit, offset).
            then(function(entries) {
                if (entries.length == 0) return null;
                return nodefn.call(ejs.renderFile, 'template/indexpage.ejs',
                    {site: site, entries: entries, page: page, utils: templateUtils}).
                    then(util.writeFile.bind(null, getPathForIndex(page))).
                    then(function() {
                        offset += limit;
                        page += 1;
                    }).
                    then(chain);
            });
    }
    return chain();
}

site.store = store;
site.generateIndex = generateIndex;
module.exports = site;