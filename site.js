var fs = require('fs');
var ejs = require('ejs');
var url = require('url');
var crypto = require('crypto');
var when = require('when');
var nodefn = require('when/node');
var util = require('./util');
var microformat = require('./microformat');

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


function init(config) {
    var publisher;
    var db = require('./db').init('index.db');
    if (config.publisher.type == 's3') {
        publisher = require('./s3publisher').init(config.publisher);
    } else if (config.publisher.type == 'file') {
        publisher = require('./filepublisher').init(config.publisher);
    }

    function getNextAvailable(seed, prefix) {
        var n = seed;
        function chain() {
            return publisher.exists(prefix + n).
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

    function resolve(permalink) {
        if (url.parse(permalink).protocol !== null)
            return permalink;
        return url.resolve(config.url, permalink);
    }

    return {
        config: config,
        getToken: db.getToken,
        deleteToken: db.deleteToken,
        listTokens: db.listTokens,

        getSlug: function (name) {
            var now = new Date();
            var datepart = '/' + now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
            if (name !== undefined) {
                var namepart = name.toLowerCase();
                namepart = namepart.replace(/[^a-z0-9 ]/g, '');
                namepart = namepart.replace(/ +/g, '-');
                return getNextAvailable("", datepart + '/' + namepart);
            } else {
                return getNextAvailable(1, datepart + '/');
            }
        },

        reIndex: function() {
            return publisher.list().
                then(function (keys) {
                    return when.map(keys, function (key) {
                        return publisher.get(key).
                            then(microformat.getHEntryWithCard).
                            then(db.store);
                    });
                });
        },

        publish: function(entry) {
            return db.store(entry).
                then(nodefn.lift(ejs.renderFile, 'template/entrypage.ejs', {
                    site: config,
                    entry: entry,
                    utils: templateUtils
                })).
                then(function (html) {
                    return publisher.put(getPathForUrl(entry.url[0]), html, 'text/html');
                });
        },

        generateIndex: function() {
            var limit = config.entriesPerPage;
            var offset = 0;
            var page = 1;

            function chain() {
                return db.getAllByAuthor(config.url, limit, offset).
                    then(function (entries) {
                        if (entries.length == 0) return null;
                        return nodefn.call(ejs.renderFile, 'template/indexpage.ejs',
                            {site: config, entries: entries, page: page, utils: templateUtils}).
                            then(function (html) {
                                return publisher.put(getPathForIndex(page), html, 'text/html');
                            }).
                            then(function () {
                                offset += limit;
                                page += 1;
                            }).
                            then(chain);
                    });
            }

            return chain();
        },

        sendWebmentionsFor: function(entry) {
            return when.map(entry.allLinks(), function (link) {
                try {
                    util.sendWebmention(resolve(entry.url[0]), link);
                    console.log('Sent webmention to ' + link);
                } catch (err) {
                    console.log('Failed to send webmention to ' + link);
                    console.log(err.stack);
                }
            });
        },

        receiveWebmention: function(source, target) {
            return util.getPage(source).
                then(function (html) {
                    if (!util.isMentionOf(html, target)) {
                        throw new Error('Didn\'t find mention on source page');
                    } else {
                        var targetEntry;
                        return get(target).
                            then(function (entry) {
                                if (entry === undefined)
                                    throw new Error('Target ' + target + ' not found');
                                targetEntry = entry;
                                return microformat.getHEntryWithCard(html, source);
                            }).
                            then(function (sourceEntry) {
                                targetEntry.children.push(sourceEntry);
                                return publish(targetEntry);
                            });
                    }
                });
        },

        generateToken: function(client_id, scope) {
            return nodefn.call(crypto.randomBytes, 18).
                then(function (buf) {
                    var token = buf.toString('base64');
                    return db.storeToken(token, client_id, scope);
                });
        }
    };
}

exports.init = init;