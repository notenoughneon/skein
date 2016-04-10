///<reference path="typings/main.d.ts"/>
import fs = require('fs');
import url = require('url');
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
import oembed = require('./oembed');
import assert = require('assert');
import jade = require('jade');

var _renderEntry = jade.compileFile('template/entrypage.jade', {pretty:true});
var _renderStream = jade.compileFile('template/streampage.jade', {pretty:true});
var _renderIndex = jade.compileFile('template/indexpage.jade', {pretty:true});


function getPathForIndex(page) {
    return '/index' + (page == 1 ? '' : page);
}

function getPathForTag(category) {
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
    getPathForCategory: getPathForTag,
    truncate: truncate
};

interface SiteConfig {
    title: string;
    url: string;
    author: {
        name: string;
        photo?: string;
        note?: string;
        elsewhere: {
            name: string;
            url: string;
        }[];
    }
    entriesPerPage: number;
    port: number;
    staticSiteRoot?: string;
    authUrl: string;
    tokenUrl: string;
    micropubUrl: string;
    webmentionUrl: string;
    publisher:
    {
        type: "file";
        root: string;
    } |
    {
       type: "git";
       root: string;
       push: boolean;
    } |
    {
        type: "s3";
        region: string;
        bucket: string;
    };
    password: string;
}

interface Micropub {
    name?: string,
    content: string | {html: string},
    replyTo?: string,
    likeOf?: string,
    repostOf?: string,
    syndication?: string[],
    photo?: {filename: string, tmpfile: string, mimetype: string},
    audio?: {filename: string, tmpfile: string, mimetype: string},
    category?: string[]
}

class Site {
    config: SiteConfig;
    publisher: Publisher;

    constructor(config: SiteConfig) {
        this.config = config;
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

    renderEntry(entry: microformat.Entry) {
        return _renderEntry({
            site: this.config,
            entry: entry,
            utils: templateUtils
        });
    }

    renderStreamPage(entries: microformat.Entry[], page: number, totalPages: number) {
        return _renderStream({
            site: this.config,
            entries: entries,
            page: page,
            totalPages: totalPages,
            utils: templateUtils
        });
    }

    renderIndexPage(entries: microformat.Entry[], category: string) {
        return _renderIndex({
            site: this.config,
            category: category,
            entries: entries,
            utils: templateUtils
        });
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
            entry.name = m.name || util.stripHtml(content.html);
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
        if (m.likeOf != null)
            entry.likeOf.push(await microformat.getHEntryFromUrl(m.likeOf));
        if (m.repostOf != null)
            entry.repostOf.push(await microformat.getHEntryFromUrl(m.repostOf));
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
        //ISSUE: some properties may be embedded mf in the content (e.g. summary)
        //so we render and then re-parse it to get all properties
        var html = this.renderEntry(entry);
        entry = await microformat.getHEntry(html, this.config.url);
        await this.publisher.put(slug, html, 'text/html');
        debug('Published ' + entry.getSlug())
        return entry;
    }

    async get(u: string) {
        u = url.parse(u).pathname;
        var obj = await this.publisher.get(u);
        return await microformat.getHEntry(obj.Body, url.resolve(this.config.url, u));
    }

    async getAll() {
        var keys = await this.publisher.list();
        var entries: Map<string, microformat.Entry> = new Map();
        var re = /^(index|js|css|tags|articles|log.txt)/;
        keys = keys.filter(k => !re.test(k));
        await Promise.all(keys.map( async (key) => {
            let obj = await this.publisher.get(key);
            if (obj.ContentType === 'text/html') {
                let u = url.resolve(this.config.url, key);
                try {
                    let entry = await microformat.getHEntry(obj.Body, u);
                    if (entry != null && (entry.url === u || entry.url + '.html' === u)) {
                        entries.set(entry.url, entry);
                    }
                } catch (err) {}
            }
        }));
        return Array.from(entries.values());
    }

    async update(entry: microformat.Entry) {
        var html = this.renderEntry(entry);
        await this.publisher.put(entry.getSlug(), html, 'text/html');
        return entry;
    }

    async delete(url: string) {
        var entry = await this.get(url);
        await this.publisher.delete(entry.getSlug(), 'text/html');
        for (let c of entry.category) {
            await this.generateTagIndex(c);
        }
        await this.generateStream();
    }

    async _generateStream(entries: microformat.Entry[], page: number, total: number) {
        let html = this.renderStreamPage(entries, page, total);
        await this.publisher.put(getPathForIndex(page), html, 'text/html');
        debug('Published ' + getPathForIndex(page));
    }

    async generateStream() {
        var entries = await this.getAll();
        entries.sort(microformat.Entry.byDateDesc);
        var limit = this.config.entriesPerPage;
        var chunks = util.chunk(limit, entries);
        for (let index = 0; index < chunks.length; index++) {
            let chunk = chunks[index];
            await this._generateStream(chunk, index + 1, chunks.length);
        }
    }

    async _generateIndex(entries: microformat.Entry[], category: string, path: string) {
        var html = this.renderIndexPage(entries, category);
        await this.publisher.put(path, html, 'text/html');
        debug('Published ' + path);
    }

    async generateTagIndex(tag: string) {
        var entries = await this.getAll();
        entries = entries.filter(e => e.category.indexOf(tag) > -1);
        entries.sort(microformat.Entry.byDateDesc);
        await this._generateIndex(entries, 'Posts tagged ' + tag, getPathForTag(tag));
    }

    async generateArticleIndex() {
        var entries = await this.getAll();
        entries = entries.filter(e => e.isArticle());
        entries.sort(microformat.Entry.byDateDesc);
        await this._generateIndex(entries, 'Articles', '/articles');
    }

    getSlug(name: string, date: Date) {
        var datepart = '/' + date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
        if (name !== undefined) {
            return this.getNextAvailable("", datepart + '/' + util.kebabCase(name));
        } else {
            return this.getNextAvailable(1, datepart + '/');
        }
    }

    async generateAll() {
        var entries = await this.getAll();
        entries.sort(microformat.Entry.byDateDesc);
        // entries
        for (let entry of entries) {
            let html = this.renderEntry(entry);
            let path = url.parse(entry.url).pathname;
            await this.publisher.put(path, html, 'text/html');
            debug('Published '+ path);
        }
        // feed
        var limit = this.config.entriesPerPage;
        var chunks = util.chunk(limit, entries);
        for (let index = 0; index < chunks.length; index++) {
            let chunk = chunks[index];
            await this._generateStream(chunk, index + 1, chunks.length);
        }
        // tags
        var tags = util.unique(util.flatten(entries.map(e => e.category)));
        for (let tag of tags) {
            await this._generateIndex(entries.filter(e => e.category.indexOf(tag) > -1), 'Posts tagged ' + tag, getPathForTag(tag));
        }
        // articles
        await this._generateIndex(entries.filter(e => e.isArticle()), 'Articles', '/articles');
    }

    async validate() {
        var keys = await this.publisher.list();
        for (let key of keys) {
            try {
                var u = url.resolve(this.config.url, key);
                var obj = await this.publisher.get(key);
                if (obj.ContentType == 'text/html') {
                    var expected = await microformat.getHEntry(obj.Body, u);
                    if (expected != null && (expected.url === u || expected.url + '.html' === u)) {
                        let html = this.renderEntry(expected);
                        var actual = await microformat.getHEntry(html, expected.url);
                        assert.deepEqual(actual, expected);
                        debug('pass ' + expected.url);
                    }
                }
            } catch (err) {
                debug('fail ' + expected.url);
                return {expected: expected, actual: actual};
            }
        }
        debug('all entries passed');
        return null;
    }

    async sendWebmentionsFor(entry: microformat.Entry) {
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

    async receiveWebmention(sourceUrl: string, targetUrl: string) {
        if (url.parse(targetUrl).host != url.parse(this.config.url).host)
            throw new Error("Target URL " + targetUrl + " doesn't match " + this.config.url);
        var sourceHtml = await util.getPage(sourceUrl);
        if (!util.isMentionOf(sourceHtml, targetUrl)) {
            throw new Error('Didn\'t find mention on source page');
        } else {
            var targetEntry = await this.get(targetUrl);
            var sourceEntry = await microformat.getHEntry(sourceHtml, sourceUrl);
            // TODO: handle non mf mentions
            targetEntry.children.push(sourceEntry);
            targetEntry.deduplicate();
            var targetHtml = this.renderEntry(targetEntry);
            await this.publisher.put(url.parse(targetEntry.url).pathname, targetHtml, 'text/html');
            debug('Received webmention from ' + sourceUrl);
        }
    }

}

export = Site;