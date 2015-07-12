var fs = require('fs');
var ejs = require('ejs');
var url = require('url');
var crypto = require('crypto');
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

function getSlug(title) {
    var now = new Date();
    var datepart = '/' + now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
    if (title !== null) {
        throw new Error('Not implemented');
    } else {
        var n = 1;
        function chain() {
            return site.publisher.exists(datepart + '/' + n).
                then(function (exists) {
                    if (exists) {
                        n++;
                        return chain();
                    } else {
                        return datepart + '/' + n;
                    }
                })
        }
        return chain();
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

function generateToken(client_id, scope) {
    return nodefn.call(crypto.randomBytes, 18).
        then(function (buf) {
            var token = buf.toString('base64');
            return db.storeToken(token, client_id, scope);
        });
}

function hasAuthorization(req, scope) {
    if (req.headers.Authorization !== undefined) {
        var token = /^Bearer (.+)/.exec(req.headers.Authorization)[1];
    } else if (req.post.access_token !== undefined) {
        var token = req.post.access_token;
    } else {
        return false;
    }
    return db.getToken(token).
        then(function (row) {
            return row.scope === scope;
        });
}

function listTokens() {
    return db.listTokens();
}

site.getSlug = getSlug;
site.store = store;
site.generateIndex = generateIndex;
site.generateToken = generateToken;
site.hasAuthorization = hasAuthorization;
site.listTokens = listTokens;
module.exports = site;