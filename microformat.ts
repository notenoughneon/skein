///<reference path="typings/main.d.ts"/>
var parser = require('microformat-node');
import Request = require('request');
import cheerio = require('cheerio');
import util = require('./util');
import url = require('url');
import Debug = require('debug');
var debug = Debug('microformat');

var request = util.promisify(Request);

export async function crawlHEntryThread(seed: string) {
    var boundary: string[] = [];
    var entryDict: Map<string, Entry> = new Map();
    boundary.push(seed);
    while (boundary.length > 0) {
        let url = boundary.shift();
        try {
            debug('Fetching ' + url);
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

export function getHEntryFromUrl(url: string): Promise<Entry> {
    return request(url).
        then(res => {
            if (res.statusCode != 200)
                throw new Error('Server returned status ' + res.statusCode);
            return getHEntryWithCard(res.body, url);
        });
}

export function getHEntryWithCard(html: string | Buffer, url: string): Promise<Entry> {
    return getHEntry(html, url).
        then(function(entry) {
            if (entry && entry.author == null) {
                return getRepHCard(html, url).
                    then(function(card) {
                        if (card !== null) entry.author = card;
                        return entry;
                    });
            }
            else return entry;
        });
}

export function getHEntry(html: string | Buffer, url: string): Promise<Entry> {
    return parser.getAsync({html: html, baseUrl: url}).
        then(function(mf) {
            var entries = mf.items.filter(i => i.type.some(t => t == 'h-entry'));
            if (entries.length == 0)
                throw new Error('No h-entry found');
            else if (entries.length > 1)
                throw new Error('Multiple h-entries found');
            return new Entry(entries[0]);
        });
}

export function getRepHCard(html: string | Buffer, url: string): Promise<Card> {
    return parser.getAsync({html: html, baseUrl: url}).
        then(function(mf) {
            var cards = mf.items.
                filter(i => i.type.some(t => t == 'h-card')).
                map(h => new Card(h));
            // 1. uid and url match page url
            var match = cards.filter(function(c) {
                return c.url != null &&
                c.uid != null &&
                urlsEqual(c.url, url) &&
                urlsEqual(c.uid, url);
            });
            if (match.length > 0) return match[0];
            // 2. url has rel=me
            if (mf.rels.me != null) {
                var match = cards.filter(function(c) {
                    return mf.rels.me.some(function(r) {
                        return c.url != null &&
                        urlsEqual(c.url, r);
                    });
                });
                if (match.length > 0) return match[0];
            }
            // 3. is only hcard, url matches page url
            if (cards.length === 1) {
                var card = cards[0];
                if (card.url != null &&
                        urlsEqual(card.url, url))
                    return card;
            }
            return null;
        });
}

function urlsEqual(u1, u2) {
    var p1 = url.parse(u1);
    var p2 = url.parse(u2);
    return p1.protocol === p2.protocol &&
        p1.host === p2.host &&
        p1.path === p2.path;
}

function prop(mf, name, f?) {
    if (mf.properties[name] != null) {
        if (f != null)
            return mf.properties[name].map(f);
        return mf.properties[name];
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

function children(mf) {
    return (mf.children || []).
        concat(mf.properties['comment'] || []).
        filter(i => i.type.some(t => t === 'h-cite')).
        map(e => new Entry(e)).
        filter(e => e.url != null);
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

    constructor(mf?) {
        if (mf != null && typeof(mf) === 'string') {
            // stub with only url, ie. from "<a href="..." class="u-in-reply-to">"
            this.url = mf;
        } else if (mf != null && mf.properties !== undefined) {
            // mf parser output
            if (!mf.type.some(t => t === 'h-entry' || t === 'h-cite'))
                throw new Error('Attempt to parse ' + mf.type + ' as Entry');
            this.name = firstProp(mf, 'name');
            this.published = firstProp(mf, 'published', p => new Date(p));
            this.content = firstProp(mf, 'content');
            this.summary = firstProp(mf, 'summary');
            this.url = firstProp(mf, 'url');
            this.author = firstProp(mf, 'author', a => new Card(a));
            this.category = prop(mf, 'category');
            this.syndication = prop(mf, 'syndication');
            this.replyTo = prop(mf, 'in-reply-to', r => new Entry(r));
            this.likeOf = prop(mf, 'like-of', r => new Entry(r));
            this.repostOf = prop(mf, 'repost-of', r => new Entry(r));
            this.children = children(mf);
        }
    }

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

    isReplyTo(url: string): boolean {
        return this.references().indexOf(url) !== -1;
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

    constructor(mf?) {
        if (mf != null && mf.properties !== undefined) {
            // mf parser output
            this.name = firstProp(mf, 'name');
            this.photo = firstProp(mf, 'photo');
            this.url = firstProp(mf, 'url');
            this.uid = firstProp(mf, 'uid');
        }
    }
}

