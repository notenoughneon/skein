var fs = require('fs');
var ejs = require('ejs');
var url = require('url');
var crypto = require('crypto');
var when = require('when');
var nodefn = require('when/node');
var util = require('./util');

var site = JSON.parse(fs.readFileSync('config.json'));
var db = require('./db').init('index.db');
if (site.publisherConfig.type == 's3') {
    site.publisher = require('./s3publisher').init(site.publisherConfig.region, site.publisherConfig.bucket);
} else if (site.publisherConfig.type == 'file') {
    site.publisher = require('./filepublisher').init(site.publisherConfig.root);
}

function getPathForUrl(u) {
    return url.parse(u).pathname;
}

function getPathForIndex(page) {
    return 'index' + (page == 1 ? '' : page);
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
    getPathForIndex: getPathForIndex,
    truncate: truncate
};

function getNextAvailable(seed, prefix) {
    var n = seed;
    function chain() {
        return site.publisher.exists(prefix + n).
            then(function (exists) {
                if (exists) {
                    n++;
                    return chain();
                } else {
                    return prefix + n;
                }
            })
    }
    return chain();

}

function getSlug(name) {
    var now = new Date();
    var datepart = '/' + now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
    if (name !== undefined) {
        var namepart = name.toLowerCase();
        namepart = namepart.replace(/[^a-z0-9 ]/g,'');
        namepart = namepart.replace(/ +/g, '-');
        return getNextAvailable("", datepart + '/' + namepart);
    } else {
        return getNextAvailable(1, datepart + '/');
    }
}

function store(entry) {
    return db.store(entry).
        then(nodefn.lift(ejs.renderFile, 'template/entrypage.ejs', {site: site, entry: entry, utils: templateUtils})).
        then(function (html) {
            return site.publisher.put(getPathForUrl(entry.url[0]), html, 'text/html');
        });
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
                    then(function (html) {
                        return site.publisher.put(getPathForIndex(page), html, 'text/html');
                    }).
                    then(function() {
                        offset += limit;
                        page += 1;
                    }).
                    then(chain);
            });
    }
    return chain();
}

function resolve(permalink) {
    if (url.parse(permalink).protocol !== null)
        return permalink;
    return url.resolve(site.url, permalink);
}

function sendWebmentionsFor(entry) {
    return when.map(entry.allLinks(), function(link) {
        try {
            util.webmention(resolve(entry.url[0]), link);
            console.log('Sent webmention to ' + link);
        } catch (err) {
            console.log('Failed to send webmention to ' + link);
            console.log(err.stack);
        }
    });
}

function generateToken(client_id, scope) {
    return nodefn.call(crypto.randomBytes, 18).
        then(function (buf) {
            var token = buf.toString('base64');
            return db.storeToken(token, client_id, scope);
        });
}

site.getSlug = getSlug;
site.store = store;
site.generateIndex = generateIndex;
site.sendWebmentionsFor = sendWebmentionsFor;
site.generateToken = generateToken;
site.getToken = db.getToken;
site.deleteToken = db.deleteToken;
site.listTokens = db.listTokens;
module.exports = site;