///<reference path="typings/main.d.ts"/>
var parser = require('microformat-node');
import Request = require('request');
import cheerio = require('cheerio');
import url = require('url');
var debug = require('debug')('microformat');

export var request = function(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        Request.get(url, (err, result) => err !== null ? reject(err) : resolve(result));
    });
}

function getLinks(html) {
    var $ = cheerio.load(html);
    return $('a').toArray().map(a => a.attribs['href']);
}

export async function getThreadFromUrl(seed: string) {
    var boundary: string[] = [];
    var entryDict: Map<string, Entry> = new Map();
    boundary.push(seed);
    while (boundary.length > 0) {
        let url = boundary.shift();
        try {
            let entry = await getEntryFromUrl(url);
            entryDict.set(url, entry);
            let references = entry.getChildren().map(c => c.url)
                .concat(entry.getReferences())
                .filter(r => !entryDict.has(r));
            boundary = boundary.concat(references);
        } catch (err) {
            debug('Broken link: ' + err);
            entryDict.set(url, new Entry(url));
        }
    }
    return Array.from(entryDict.values());
}

export async function getEntryFromUrl(url: string, inclNonMf?: boolean): Promise<Entry> {
    var res = await request(url);
    debug('Fetching ' + url);
    if (res.statusCode != 200)
        throw new Error('Server returned status ' + res.statusCode);
    var entry = await getEntry(res.body, url, inclNonMf);
    if (entry.author !== null && entry.author.url !== null && entry.author.name === null) {
        try {
            var author = await getCardFromUrl(entry.author.url);
            if (author !== null)
                entry.author = author;
        } catch (err) {
            debug('Failed to fetch author page: ' + err.message);
        }
    }
    return entry;
}

export async function getCardFromUrl(url: string): Promise<Card> {
    var res = await request(url);
    debug('Fetching ' + url);
    if (res.statusCode != 200)
        throw new Error('Server returned status ' + res.statusCode);
    var mf = await parser.getAsync({html: res.body, baseUrl: url});
    var cards = mf.items.
        filter(i => i.type.some(t => t == 'h-card')).
        map(h => buildCard(h));
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

export async function getEntry(html: string | Buffer, url: string, inclNonMf?: boolean): Promise<Entry> {
    try {
        var mf = await parser.getAsync({html: html, baseUrl: url});
        var entries = mf.items.filter(i => i.type.some(t => t == 'h-entry'));
        if (entries.length == 0)
            throw new Error('No h-entry found');
        else if (entries.length > 1)
            throw new Error('Multiple h-entries found');
        var entry = buildEntry(entries[0]);
        if (entry.author === null) {
            if (mf.rels.author != null && mf.rels.author.length > 0) {
                entry.author = new Card(mf.rels.author[0]);
            }
        }
        return entry;
    } catch (err) {
        if (inclNonMf === true) {
            var entry = new Entry(url);
            let $ = cheerio.load(html);
            entry.name = $('title').text();
            entry.content = {html: null, value: $('body').text().replace(/\s+/g, ' ')};
            return entry;
        }
        else
            throw err;
    }
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

function buildCard(mf) {
    if (typeof(mf) === 'string')
        return new Card(mf);
    var card = new Card();
    if (!mf.type.some(t => t === 'h-card'))
        throw new Error('Attempt to parse ' + mf.type + ' as Card');
    card.name = firstProp(mf, 'name');
    card.photo = firstProp(mf, 'photo');
    card.url = firstProp(mf, 'url');
    card.uid = firstProp(mf, 'uid');
    return card;
}

function buildEntry(mf) {
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
    entry.author = firstProp(mf, 'author', a => buildCard(a));
    entry.category = prop(mf, 'category');
    entry.syndication = prop(mf, 'syndication');
    entry.replyTo = firstProp(mf, 'in-reply-to', r => buildEntry(r));
    entry.likeOf = firstProp(mf, 'like-of', r => buildEntry(r));
    entry.repostOf = firstProp(mf, 'repost-of', r => buildEntry(r));
    (mf.children || [])
    .concat(mf.properties['comment'] || [])
    .filter(i => i.type.some(t => t === 'h-cite'))
    .map(e => buildEntry(e))
    .filter(e => e.url != null)
    .map(e => entry.addChild(e));
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
    replyTo: Entry = null;
    likeOf: Entry = null;
    repostOf: Entry = null;
    private children: Map<string, Entry> = new Map();

    constructor(url?: string) {
        if (typeof(url) === 'string') {
            this.url = url;
        }
    }
    
    private _getTime() {
        if (this.published != null)
            return this.published.getTime();
        return -1;
    }

    private _getType(): number {
        if (this.isLike() || this.isRepost())
            return 1;
        return 0;
    }

    static byDate = (a: Entry, b: Entry) => a._getTime() - b._getTime();
    static byDateDesc = (a: Entry, b: Entry) => b._getTime() - a._getTime();
    static byType = (a: Entry, b: Entry) => a._getType() - b._getType();
    static byTypeDesc = (a: Entry, b: Entry) => b._getType() - a._getType();

    getDomain(): string {
        var p = url.parse(this.url);
        return p.protocol + '//' + p.host;
    }
    
    getPath(): string {
        return url.parse(this.url).path;
    }

    getReferences(): string[] {
        var ref: Entry[] = [];
        if (this.replyTo != null)
            ref.push(this.replyTo);
        if (this.likeOf != null)
            ref.push(this.likeOf);
        if (this.repostOf != null)
            ref.push(this.repostOf);
        return ref.map(r => r.url);
    }

    getMentions(): string[] {
        var allLinks = this.getReferences();
        if (this.content != null)
            allLinks = allLinks.concat(getLinks(this.content.html));
        return allLinks;
    }
    
    getChildren(sortFunc?: (a: Entry, b: Entry) => number) {
        var values = Array.from(this.children.values());
        if (sortFunc != null)
            values.sort(sortFunc);
        return values;
    }
    
    addChild(entry: Entry) {
        if (entry.url == null)
            throw new Error('Url must be set');
        this.children.set(entry.url, entry);
    }
    
    deleteChild(url: string) {
        return this.children.delete(url);
    }

    isReply(): boolean {
        return this.replyTo != null;
    }

    isRepost(): boolean {
        return this.repostOf != null;
    }

    isLike(): boolean {
        return this.likeOf != null;
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

    serialize(): string {
        return JSON.stringify(this, (key,val) => {
            if (key === 'replyTo' || key === 'repostOf' || key === 'likeOf')
                return val === null ? null : val.url;
            if (key === 'children')
                return Array.from(val.values()).map(r => r.url);
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
            if (key === 'replyTo' || key === 'repostOf' || key === 'likeOf')
                return val === null ? null : new Entry(val);
            if (key === 'children')
                return new Map(val.map(url => [url, new Entry(url)]));
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

