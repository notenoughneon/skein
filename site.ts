///<reference path="typings/tsd.d.ts"/>
var ejs = require('ejs');
import url = require('url');
import crypto = require('crypto');
import when = require('when');
import nodefn = require('when/node');
import Debug = require('debug');
var debug = Debug('site');
import util = require('./util');
import microformat = require('./microformat');
import Publisher = require('./publisher');
import S3Publisher = require('./s3publisher');
import FilePublisher = require('./filepublisher');
import Db = require('./db');

function getPathForIndex(page) {
    return 'index' + (page == 1 ? '' : page);
}

function truncate(s, len) {
    if (s.length > len)
        return s.substr(0, len) + '...';
    return s;
}

function formatDate(date) {
    var month = ["Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec"];
    var minutes = date.getMinutes();
    return date.getDate() + ' ' +
        month[date.getMonth()] + ' ' +
        date.getFullYear() + ' ' +
        date.getHours() + ':' +
        ((minutes < 10) ? '0' + minutes : minutes);
}

var templateUtils = {
    formatDate: formatDate,
    getPathForIndex: getPathForIndex,
    truncate: truncate
};

class Site {
    config: any;
    db: Db;
    publisher: Publisher;

    constructor(config, db: Db) {
        this.config = config;
        this.db = db;
        switch(config.publisher.type) {
            case 's3':
                this.publisher = new S3Publisher(config.publisher);
                break;
            case 'file':
                this.publisher = new FilePublisher(config.publisher);
                break;
            default:
                throw new Error('Unknown publisher type');
        }
    }

    getNextAvailable(seed, prefix) {
        var n = seed;
        var that = this;
        function chain() {
            return that.publisher.exists(prefix + n).
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

    getAuthor() {
        var card = new microformat.Card();
        card.url = this.config.url;
        card.name = this.config.author.name;
        card.photo = this.config.author.photo;
        return card;
    }

    publish(m: {name?: string, content: string, replyTo?: string}): when.Promise<microformat.Entry> {
        var entry = new microformat.Entry();
        entry.author = this.getAuthor();
        entry.name = m.name || m.content;
        entry.content = {
            value: m.content,
            html: util.autoLink(util.escapeHtml(m.content))
        };
        entry.published = new Date();
        return this.getSlug(m.name, entry.published).
            then(slug => entry.url = this.config.url + slug).
            then(() => {
                if (m.replyTo != null)
                    return microformat.getHEntryFromUrl(m.replyTo).
                        then(e => {
                            entry.replyTo = e;
                        });
            }).
            then(() => this.db.storeTree(entry)).
            then(() => nodefn.call(ejs.renderFile, 'template/entrypage.ejs', {
                site: this.config,
                entry: entry,
                utils: templateUtils
            })).
            then(html => this.publisher.put(url.parse(entry.url).pathname, html, 'text/html')).
            then(() => entry);
    }

    generateIndex() {
        var limit = this.config.entriesPerPage;
        return this.db.getAllByDomain(url.parse(this.config.url).host).
            then(entries => util.chunk(limit, entries)).
            then(chunks =>
                when.map(chunks, (chunk, index) =>
                    nodefn.call(ejs.renderFile, 'template/indexpage.ejs',
                        {
                            site: this.config,
                            entries: chunk,
                            page: index + 1,
                            totalPages: chunks.length,
                            utils: templateUtils
                        }).
                        then(html => this.publisher.put(getPathForIndex(index + 1), html, 'text/html'))
                )
            );
    }

    getSlug(name: string, date: Date) {
        var datepart = '/' + date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
        if (name !== undefined) {
            return this.getNextAvailable("", datepart + '/' + util.kebabCase(name));
        } else {
            return this.getNextAvailable(1, datepart + '/');
        }
    }

    clone(from: Publisher) {
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
        return this.db.getAllByDomain(this.config.url).
            then(function (entries) {
                return when.map(entries, function (entry) {
                    return nodefn.call(ejs.renderFile, 'template/entrypage.ejs',
                        {site: this.config, entry: entry, utils: templateUtils}).
                        then(function (html) {
                            return this.publisher.put(url.parse(entry.url).pathname, html, 'text/html');
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

    receiveWebmention(sourceUrl: string, targetUrl: string): when.Promise<any> {
        if (url.parse(targetUrl).host != url.parse(this.config.url).host)
            throw new Error("Target URL " + targetUrl + " doesn't match " + this.config.url);
        return util.getPage(sourceUrl).
            then(html => {
                if (!util.isMentionOf(html, targetUrl)) {
                    throw new Error('Didn\'t find mention on source page');
                } else {
                    var targetEntry;
                    return this.db.getTree(targetUrl).
                        then(entry => {
                            targetEntry = entry;
                            return microformat.getHEntryWithCard(html, sourceUrl);
                        }).
                        then(sourceEntry => {
                            // TODO: handle non mf mentions
                            targetEntry.children.push(sourceEntry);
                        }).
                        then(() => this.db.storeTree(targetEntry)).
                        then(() => nodefn.call(ejs.renderFile, 'template/entrypage.ejs', {
                            site: this.config,
                            entry: targetEntry,
                            utils: templateUtils
                        })).
                        then(html => this.publisher.put(url.parse(targetEntry.url).pathname, html, 'text/html'));
                }
            });
    }

    generateToken(client_id, scope) {
        return nodefn.call(crypto.randomBytes, 18).
            then(buf => {
                var token = buf.toString('base64');
                return this.db.storeToken(token, client_id, scope);
            });
    }
}

export = Site;