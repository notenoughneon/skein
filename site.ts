///<reference path="typings/main.d.ts"/>
var ejs = require('ejs');
import fs = require('fs');
import url = require('url');
import crypto = require('crypto');
import path = require('path');
import when = require('when');
import nodefn = require('when/node');
import Debug = require('debug');
var debug = Debug('site');
import util = require('./util');
import microformat = require('./microformat');
import Publisher = require('./publisher');
import S3Publisher = require('./s3publisher');
import FilePublisher = require('./filepublisher');
import GitPublisher = require('./gitpublisher');
import Db = require('./db');
import oembed = require('./oembed');

var renderFile: (string, any) => Promise<string> = nodefn.lift(ejs.renderFile);

function getPathForIndex(page) {
    return 'index' + (page == 1 ? '' : page);
}

function getPathForCategory(category) {
    return '/tags/' + category;
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
    getPathForCategory: getPathForCategory,
    truncate: truncate
};

interface Micropub {
    name?: string,
    content: string | {html: string},
    replyTo?: string,
    syndication?: string[],
    photo?: {filename: string, tmpfile: string, mimetype: string},
    audio?: {filename: string, tmpfile: string, mimetype: string},
    category?: string[]
}

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
            case 'git':
                this.publisher = new GitPublisher(config.publisher);
            default:
                throw new Error('Unknown publisher type');
        }
    }

    async getNextAvailable(n, prefix) {
        while (await this.publisher.exists(prefix + n)) {
            n++;
        }
        return prefix + n;
    }

    getAuthor() {
        var card = new microformat.Card();
        card.url = this.config.url;
        card.name = this.config.author.name;
        card.photo = this.config.author.photo;
        return card;
    }

    async publish(m: Micropub) {
        var entry = new microformat.Entry();
        entry.author = this.getAuthor();
        // workaround: type guards dont work with properties
        // https://github.com/Microsoft/TypeScript/issues/3812
        var content = m.content;
        if (content == null)
            content = '';
        if (typeof content === 'string') {
            entry.name = m.name || content;
            entry.content = {
                value: content,
                html: util.autoLink(util.escapeHtml(m.content))
            };
        } else {
            entry.name = m.name;
            entry.content = {
                value: util.stripHtml(content.html),
                html: content.html
            };
        }
        entry.published = new Date();
        if (m.category != null)
            entry.category = m.category;
        var slug = await this.getSlug(m.name, entry.published);
        entry.url = this.config.url + slug;
        if (m.replyTo != null)
            entry.replyTo.push(await microformat.getHEntryFromUrl(m.replyTo));
        if (m.syndication != null)
            entry.syndication = m.syndication;
        if (m.photo != null) {
            var photoslug = path.join(path.dirname(slug), m.photo.filename);
            entry.content.html = '<p><img class="u-photo" src="' + photoslug + '"/></p>' + entry.content.html;
            await this.publisher.put(photoslug, fs.createReadStream(m.photo.tmpfile), m.photo.mimetype);
        }
        if (m.audio != null) {
            var audioslug = path.join(path.dirname(slug), m.audio.filename);
            entry.content.html = '<p><audio class="u-audio" src="' + audioslug + '" controls>' +
            'Your browser does not support the audio tag.</audio></p>' + entry.content.html;
            await this.publisher.put(audioslug, fs.createReadStream(m.audio.tmpfile), m.audio.mimetype);
        }
        for (let link of entry.allLinks()) {
            let embed = await oembed(link);
            if (embed !== null)
                entry.content.html = entry.content.html + '<p>' + embed + '</p>';
        }
        await this.db.storeTree(entry);
        var html = await renderFile('template/entrypage.ejs', {
            site: this.config,
            entry: entry,
            utils: templateUtils
        });
        await this.publisher.put(slug, html, 'text/html');
        return entry;
    }
    
    async update(entry: microformat.Entry) {
        await this.db.store(entry);
        var html = await renderFile('template/entrypage.ejs', {
            site: this.config,
            entry: entry,
            utils: templateUtils
        });
        await this.publisher.put(entry.getSlug(), html, 'text/html');
        return entry;
    }

    async delete(url: string) {
        var entry = await this.db.get(url);
        await this.db.delete(url);
        await this.publisher.delete(entry.getSlug(), 'text/html');
        for (let c of entry.category) {
            await this.generateTagIndex(c);
        }
        await this.generateIndex();
    }

    async generateIndex() {
        var limit = this.config.entriesPerPage;
        var entries = await this.db.getAllByDomain(this.config.url);
        for (let entry of entries) {
            await this.db.hydrate(entry);
        }
        var chunks = util.chunk(limit, entries);
        for (let index in chunks) {
            let chunk = chunks[index];
            let html = await renderFile('template/indexpage.ejs',
            {
                site: this.config,
                entries: chunk,
                page: index + 1,
                totalPages: chunks.length,
                utils: templateUtils
            });
            await this.publisher.put(getPathForIndex(index + 1), html, 'text/html');
            debug('generated ' + getPathForIndex(index + 1));
        }
        debug('done generating index');
    }

    async generateTagIndex(category: string) {
        var entries = await this.db.getByCategory(category);
        var html = await renderFile('template/tagpage.ejs',
        {
            site: this.config,
            category: category,
            entries: entries,
            utils: templateUtils
        });
        await this.publisher.put(getPathForCategory(category), html, 'text/html');
        debug('generated ' + getPathForCategory(category));
    }

    getSlug(name: string, date: Date) {
        var datepart = '/' + date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
        if (name !== undefined) {
            return this.getNextAvailable("", datepart + '/' + util.kebabCase(name));
        } else {
            return this.getNextAvailable(1, datepart + '/');
        }
    }

    async reIndex() {
        var keys = await this.publisher.list();
        for (var key of keys) {
            var u = url.resolve(this.config.url, key);
            var obj = await this.publisher.get(key);
            if (obj.ContentType == 'text/html') {
                var entry = await microformat.getHEntryWithCard(obj.Body, u);
                if (entry != null && (entry.url === u || entry.url + '.html' === u)) {
                    await this.db.storeTree(entry);
                    debug('indexed ' + entry.url);
                }
            }
        }
        debug('done reindexing');
    }

    async reGenerate() {
        var entries = await this.db.getAllByDomain(this.config.url);
        for (let entry of entries) {
            await this.db.hydrate(entry);
            let html = await renderFile('template/entrypage.ejs', {site: this.config, entry: entry, utils: templateUtils});
            await this.publisher.put(url.parse(entry.url).pathname, html, 'text/html');
            debug('regenerated '+ entry.url);
        }
        await this.generateIndex();
        var categories = await this.db.getAllCategories();
        for (let category of categories) {
            await this.generateTagIndex(category);
        }
        debug('done regenerating');
    }

    async sendWebmentionsFor(entry) {
        for (let link of entry.allLinks()) {
            try {
                await util.sendWebmention(entry.url, link);
                debug('Sent webmention to ' + link);
            } catch (err) {
                debug('Failed to send webmention to ' + link);
                debug(err.stack);
            }
        }
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
                            targetEntry.deduplicate();
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