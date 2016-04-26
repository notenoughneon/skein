///<reference path="typings/main.d.ts"/>
var parser = require('microformat-node');
import Request = require('request');
import cheerio = require('cheerio');
import util = require('./util');
import url = require('url');
import Debug = require('debug');
var debug = Debug('microformat');

export var request = util.promisify(Request);

export async function crawlHEntryThread(seed: string) {
    var boundary: string[] = [];
    var entryDict: Map<string, Entry> = new Map();
    boundary.push(seed);
    while (boundary.length > 0) {
        let url = boundary.shift();
        try {
            let entry = await getHEntryFromUrl(url);
            entryDict.set(url, entry);
            let references = entry
                .replyTo
                .concat(entry.likeOf)
                .concat(entry.repostOf)
                .concat(entry.children)
                .map(r => r.url)
                .filter(r => !entryDict.has(r));
            boundary = boundary.concat(references);
        } catch (err) {
            debug('Broken link: ' + err);
            entryDict.set(url, new Entry(url));
        }
    }
    return Array.from(entryDict.values());
}

export async function constructHEntryForMention(url: string) {
    var res = await request(url);
    if (res.statusCode != 200)
        throw new Error('Server returned status ' + res.statusCode);
    var entry = new Entry(url);
    entry.content = {html: 'html content', value: util.truncate(util.stripHtml(res.body), 180)};
    return entry;
}

export async function getHEntryFromUrl(url: string): Promise<Entry> {
    var res = await request(url);
    debug('Fetching ' + url);
    if (res.statusCode != 200)
        throw new Error('Server returned status ' + res.statusCode);
    var entry = await getHEntry(res.body, url);
    if (entry.author !== null && entry.author.url !== null && entry.author.name === null) {
        try {
            var author = await getCardFromAuthorPage(entry.author.url);
            if (author !== null)
                entry.author = author;
        } catch (err) {
            debug('Failed to fetch author page: ' + err.message);
        }
    }
    return entry;
}

export async function getCardFromAuthorPage(url: string): Promise<Card> {
    var res = await request(url);
    debug('Fetching ' + url);
    if (res.statusCode != 200)
        throw new Error('Server returned status ' + res.statusCode);
    var mf = await parser.getAsync({html: res.body, baseUrl: url});
    var cards = mf.items.
        filter(i => i.type.some(t => t == 'h-card')).
        map(h => _buildCard(h));
    // 1. uid and url match author-page url
    var match = cards.filter(c =>
        c.url != null &&
        c.uid != null &&
        urlsEqual(c.url, url) &&
        urlsEqual(c.uid, url)
    );
    if (match.length > 0) return match[0];
    // 2. url matches rel=me
    if (mf.rels.me != null) {
        var match = cards.filter(c =>
            mf.rels.me.some(r =>
                c.url != null &&
                urlsEqual(c.url, r)
            )
        );
        if (match.length > 0) return match[0];
    }
    // 3. url matches author-page url
    var match = cards.filter(c =>
        c.url != null &&
        urlsEqual(c.url, url)
    );
    if (match.length > 0) return match[0];
    return null;
}

export async function getHEntry(html: string | Buffer, url: string): Promise<Entry> {
    var mf = await parser.getAsync({html: html, baseUrl: url});
    var entries = mf.items.filter(i => i.type.some(t => t == 'h-entry'));
    if (entries.length == 0)
        throw new Error('No h-entry found');
    else if (entries.length > 1)
        throw new Error('Multiple h-entries found');
    var entry = _buildEntry(entries[0]);
    if (entry.author === null) {
        if (mf.rels.author != null && mf.rels.author.length > 0) {
            entry.author = new Card(mf.rels.author[0]);
        }
    }
    return entry;
}

function prop(mf, name, f?) {
    if (mf.properties[name] != null) {
        if (f != null)
            return mf.properties[name].filter(e => e !== '').map(f);
        return mf.properties[name].filter(e => e !== '');
    }
    return [];
}

function firstProp(mf, name, f?) {
    if (mf.properties[name] != null) {
        if (f != null)
            return f(mf.properties[name][0]);
        return mf.properties[name][0];
    }
    return null;
}

export function _buildCard(mf) {
    if (typeof(mf) === 'string')
        return new Card(mf);
    var card = new Card();
    card.name = firstProp(mf, 'name');
    card.photo = firstProp(mf, 'photo');
    card.url = firstProp(mf, 'url');
    card.uid = firstProp(mf, 'uid');
    return card;
}

export function _buildEntry(mf) {
    if (typeof(mf) === 'string')
        return new Entry(mf);
    var entry = new Entry();
    if (!mf.type.some(t => t === 'h-entry' || t === 'h-cite'))
        throw new Error('Attempt to parse ' + mf.type + ' as Entry');
    entry.name = firstProp(mf, 'name');
    entry.published = firstProp(mf, 'published', p => new Date(p));
    entry.content = firstProp(mf, 'content');
    entry.summary = firstProp(mf, 'summary');
    entry.url = firstProp(mf, 'url');
    entry.author = firstProp(mf, 'author', a => _buildCard(a));
    entry.category = prop(mf, 'category');
    entry.syndication = prop(mf, 'syndication');
    entry.replyTo = prop(mf, 'in-reply-to', r => _buildEntry(r));
    entry.likeOf = prop(mf, 'like-of', r => _buildEntry(r));
    entry.repostOf = prop(mf, 'repost-of', r => _buildEntry(r));
    entry.children = (mf.children || []).
        concat(mf.properties['comment'] || []).
        filter(i => i.type.some(t => t === 'h-cite')).
        map(e => _buildEntry(e)).
        filter(e => e.url != null);
    return entry;
}

function urlsEqual(u1, u2) {
    var p1 = url.parse(u1);
    var p2 = url.parse(u2);
    return p1.protocol === p2.protocol &&
        p1.host === p2.host &&
        p1.path === p2.path;
}

export class Entry {
    name: string = null;
    published: Date = null;
    content: {value: string, html: string} = null;
    summary: string = null;
    url: string = null;
    author: Card = null;
    category: string[] = [];
    syndication: string[] = [];
    replyTo: Entry[] = [];
    likeOf: Entry[] = [];
    repostOf: Entry[] = [];
    children: Entry[] = [];

    constructor(url?: string) {
        if (typeof(url) === 'string') {
            this.url = url;
        }
    }

    static byDate = (a: Entry, b: Entry) => a.published.getTime() - b.published.getTime();
    static byDateDesc = (a: Entry, b: Entry) => b.published.getTime() - a.published.getTime();
    static byType = (a: Entry, b: Entry) => a._getType() - b._getType();
    static byTypeDesc = (a: Entry, b: Entry) => b._getType() - a._getType();

    domain(): string {
        var p = url.parse(this.url);
        return p.protocol + '//' + p.host;
    }

    references(): string[] {
        return this.replyTo.concat(this.repostOf).concat(this.likeOf).
            map(r => r.url);
    }

    allLinks(): string[] {
        var allLinks = this.references();
        if (this.content != null)
            allLinks = allLinks.concat(util.getLinks(this.content.html));
        return allLinks;

    }

    isReply(): boolean {
        return this.replyTo.length > 0;
    }

    isRepost(): boolean {
        return this.repostOf.length > 0;
    }

    isLike(): boolean {
        return this.likeOf.length > 0;
    }
    
    private _getType(): number {
        if (this.isLike() || this.isRepost())
            return 1;
        return 0;
    }
    
    getSlug(): string {
        return url.parse(this.url).path;
    }

    getPhotos(): string[] {
        if (this.content != null && this.content.html != null) {
            var $ = cheerio.load(this.content.html);
            return $('img.u-photo').toArray().map(img => img.attribs['src']);
        }
        return [];
    }

    isArticle(): boolean {
        return !this.isReply() &&
            !this.isRepost() &&
            !this.isLike() &&
            this.name != null &&
            this.content != null &&
            this.content.value != '' &&
            this.name !== this.content.value;
    }

    flatten(): Entry[] {
        return [this].
            concat(this.replyTo).
            concat(this.repostOf).
            concat(this.likeOf).
            concat(this.children);
    }
    
    deduplicate() {
        var seen = {};
        var tmp = [];
        this.children.forEach(c => {
            if (!seen[c.url]) {
                seen[c.url] = true;
                tmp.push(c);
            }
        });
        this.children = tmp;
    }

    serialize(): string {
        return JSON.stringify(this, (key,val) => {
            if (key === 'replyTo' || key === 'repostOf' || key === 'likeOf' || key === 'children')
                return val.map(r => r.url);
            return val;
        });
    }

    static deserialize(json: string): Entry {
        return JSON.parse(json, (key,val) => {
            if (val != null && key === 'author') {
                var author = new Card();
                author.name = val.name;
                author.photo = val.photo;
                author.uid = val.uid;
                author.url = val.url;
                return author;
            }
            if (key === 'replyTo' || key === 'repostOf' || key === 'likeOf' || key === 'children')
                return val.map(url => new Entry(url));
            if (key === '') {
                var entry = new Entry();
                entry.name = val.name;
                entry.published = val.published ? new Date(val.published) : null;
                entry.content = val.content;
                entry.summary = val.summary;
                entry.url = val.url;
                entry.author = val.author;
                entry.category = val.category;
                entry.syndication = val.syndication;
                entry.replyTo = val.replyTo;
                entry.likeOf = val.likeOf;
                entry.repostOf = val.repostOf;
                entry.children = val.children;
                return entry;
            }
            return val;
        });
    }
}

export class Card {
    name: string = null;
    photo: string = null;
    url: string = null;
    uid: string = null;

    constructor(urlOrName?: string) {
        if (typeof(urlOrName) === 'string') {
            if (urlOrName.startsWith('http://') || urlOrName.startsWith('https://'))
                this.url = urlOrName;
            else
                this.name = urlOrName;
        }
    }
}

