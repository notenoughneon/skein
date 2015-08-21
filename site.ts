///<reference path="typings/tsd.d.ts"/>
var ejs = require('ejs');
import url = require('url');
import crypto = require('crypto');
var when = require('when');
var nodefn = require('when/node');
import Debug = require('debug');
var debug = Debug('site');
import util = require('./util');
import microformat = require('./microformat');
import s3publisher = require('./s3publisher');
import filepublisher = require('./filepublisher');
import db = require('./db');

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
    return d.getDate() + ' ' +
        month[d.getMonth()] + ' ' +
        d.getFullYear() + ' ' +
        d.getHours() + ':' +
        ((minutes < 10) ? '0' + minutes : minutes);
}

var templateUtils = {
    formatDate: formatDate,
    getPathForIndex: getPathForIndex,
    truncate: truncate
};

export class Site {
    config: any;
    db: any;
    publisher: any;
    getToken: any;
    deleteToken: any;
    listTokens: any;

    constructor(config, dbfile?) {
        this.config = config;
        if (dbfile === undefined) dbfile = 'index.db';
        this.db = new db.Db(dbfile);
        if (config.publisher.type == 's3') {
            this.publisher = new s3publisher.S3Publisher(config.publisher);
        } else if (config.publisher.type == 'file') {
            this.publisher = new filepublisher.FilePublisher(config.publisher);
        }
        this.getToken = this.db.getToken;
        this.deleteToken = this.db.deleteToken;
        this.listTokens = this.db.listTokens;
    }
    getNextAvailable(seed, prefix) {
        var n = seed;
        function chain() {
            return this.publisher.exists(prefix + n).
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

    resolve(permalink) {
        if (url.parse(permalink).protocol !== null)
            return permalink;
        return url.resolve(this.config.url, permalink);
    }

    publish(entry) {
        return this.db.store(entry).
            then(nodefn.lift(ejs.renderFile, 'template/entrypage.ejs', {
                site: this.config,
                entry: entry,
                utils: templateUtils
            })).
            then(function (html) {
                return this.publisher.put(getPathForUrl(entry.url[0]), html, 'text/html');
            });
    }

    generateIndex() {
        var limit = this.config.entriesPerPage;
        return this.db.getAllByAuthor(this.config.url).
            then(util.chunk.bind(null, limit)).
            then(function (chunks) {
                return when.map(chunks, function (chunk, index) {
                    return nodefn.call(ejs.renderFile, 'template/indexpage.ejs',
                        {
                            site: this.config,
                            entries: chunk,
                            page: index + 1,
                            totalPages: chunks.length,
                            utils: templateUtils
                        }).
                        then(function (html) {
                            return this.publisher.put(getPathForIndex(index + 1), html, 'text/html');
                        });
                });
            });
    }

    getSlug(name, kebabCase?) {
        var now = new Date();
        var datepart = '/' + now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
        if (name !== undefined) {
            if (kebabCase) name = util.kebabCase(name);
            return this.getNextAvailable("", datepart + '/' + name);
        } else {
            return this.getNextAvailable(1, datepart + '/');
        }
    }

    copyFrom(from) {
        var postRe = new RegExp(from.config.postRegex);
        return from.list().
            then(function (files) {
                return when.map(files, function (file) {
                    if (postRe.test(file)) {
                        return from.get(file).
                            then(function (obj) {
                                return obj.Body;
                            }).
                            then(function (html) {
                                return microformat.getHEntryWithCard(html, this.config.url);
                            }).
                            then(function (entry) {
                                return this.publish(entry);
                            });
                    } else {
                        return from.get(file).
                            then(function (obj) {
                                return this.publisher.put(file, obj.Body, obj.ContentType);
                            })
                    }
                });
            }).
            then(this.generateIndex);
    }

    reIndex() {
        var postRe = new RegExp(this.publisher.config.postRegex);
        return this.publisher.list().
            then(function (keys) {
                return keys.filter(function (key) {
                    return postRe.test(key);
                });
            }).
            then(function (keys) {
                return when.map(keys, function (key) {
                    debug(key);
                    return this.publisher.get(key).
                        then(function (obj) {
                            return microformat.getHEntryWithCard(obj.Body, this.config.url);
                        }).
                        then(this.db.store);
                });
            });
    }

    reGenerate() {
        return this.db.getAllByAuthor(this.config.url).
            then(function (entries) {
                return when.map(entries, function (entry) {
                    return nodefn.call(ejs.renderFile, 'template/entrypage.ejs',
                        {site: this.config, entry: entry, utils: templateUtils}).
                        then(function (html) {
                            return this.publisher.put(getPathForUrl(entry.url[0]), html, 'text/html');
                        });
                });
            });
    }

    sendWebmentionsFor(entry) {
        return when.map(entry.allLinks(), function (link) {
            return util.sendWebmention(this.resolve(entry.url[0]), link).
                then(function () {
                    debug('Sent webmention to ' + link);
                }).
                catch(function (err) {
                    debug('Failed to send webmention to ' + link);
                    debug(err.stack);
                });
        });
    }

    receiveWebmention(source, target) {
        return util.getPage(source).
            then(function (html) {
                if (!util.isMentionOf(html, target)) {
                    throw new Error('Didn\'t find mention on source page');
                } else {
                    var targetEntry;
                    return this.db.existsByAuthor(this.config.url, target).
                        then(function (exists) {
                            if (!exists)
                                throw new Error(target + ' isn\'t a valid target');
                            return target;
                        }).
                        then(this.db.get).
                        then(function (entry) {
                            targetEntry = entry;
                            return microformat.getHEntryWithCard(html, source);
                        }).
                        then(function (sourceEntry) {
                            targetEntry.children.push(sourceEntry);
                            return this.publish(targetEntry);
                        });
                }
            });
    }

    generateToken(client_id, scope) {
        return nodefn.call(crypto.randomBytes, 18).
            then(function (buf) {
                var token = buf.toString('base64');
                return this.db.storeToken(token, client_id, scope);
            });
    }
}