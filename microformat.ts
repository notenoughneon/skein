///<reference path="typings/tsd.d.ts"/>
var parser = require('microformat-node');
var nodefn = require('when/node');
import util = require('./util');
import url = require('url');

export function getHEntryWithCard(html: string, url: string) {
    return getHEntry(html, url).
        then(function(entry) {
            if (entry.author != null) {
                return getRepHCard(html, url).
                    then(function(card) {
                        if (card !== null) entry.author = card;
                        return entry;
                    });
            }
            else return entry;
        });
}

export function getHEntry(html: string, url: string) {
    return parser.parseHtml(html, {filters: ['h-entry'], baseUrl: url, logLevel: 1}).
        then(function(mf) {
            return new Entry(mf.items[0]);
        });
}

export function getRepHCard(html: string, url: string) {
    return parser.parseHtml(html, {filters: ['h-card'], baseUrl: url, logLevel: 1}).
        then(function(mf) {
            var cards = mf.items.map(function(h) {
                return new Card(h);
            });
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
        map(e => new Entry(e));
}

export class Entry {
    name: string = null;
    published: Date = null;
    content: {value: string, html: string} = null;
    photo: string = null;
    url: string = null;
    author: Card = null;
    syndication: string[] = [];
    replyTo: Entry = null;
    likeOf: Entry = null;
    repostOf: Entry = null;
    children: Entry[] = [];

    constructor(mf?) {
        if (mf != null && typeof(mf) === 'string') {
            // stub with only url, ie. from "<a href="..." class="u-in-reply-to">"
            this.url = mf;
        } else if (mf != null && mf.properties !== undefined) {
            // mf parser output
            this.name = firstProp(mf, 'name');
            this.published = firstProp(mf, 'published', p => new Date(p));
            this.content = firstProp(mf, 'content');
            this.photo = firstProp(mf, 'photo');
            this.url = firstProp(mf, 'url');
            this.author = firstProp(mf, 'author', a => new Card(a));
            this.syndication = prop(mf, 'syndication');
            this.replyTo = firstProp(mf, 'in-reply-to', r => new Entry(r));
            this.likeOf = firstProp(mf, 'like-of', r => new Entry(r));
            this.repostOf = firstProp(mf, 'repost-of', r => new Entry(r));
            this.children = children(mf);
        }
    }

    references(): string[] {
        return util.flatten(
            [this.replyTo, this.repostOf, this.likeOf].
            map(r => r != null ? [r.url] : [])
        );
    }

    allLinks(): string[] {
        var allLinks = this.references();
        if (this.content != null)
            allLinks = allLinks.concat(util.getLinks(this.content.html));
        return allLinks;

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

    isPhoto(): boolean {
        return this.photo != null;
    }

    isReplyTo(url: string): boolean {
        return this.references().indexOf(url) !== -1;
    }

    isArticle(): boolean {
        return !this.isReply() &&
            !this.isRepost() &&
            !this.isLike() &&
            !this.isPhoto() &&
            this.name != null &&
            this.content != null &&
            this.name !== this.content.value;
    }

    flatten(): Entry[] {
        var entries = [this];
        if (this.replyTo != null)
            entries.push(this.replyTo);
        if (this.repostOf != null)
            entries.push(this.repostOf);
        if (this.likeOf != null)
            entries.push(this.likeOf);
        entries = entries.concat(this.children);
        return entries;
    }

    serialize(): string {
        return JSON.stringify(this, (key,val) => {
            if (val != null && (key === 'replyTo' || key === 'repostOf' || key === 'likeOf'))
                return val.url;
            if (key === 'children')
                return val.map(c => c.url);
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
            if (val != null && (key === 'replyTo' || key === 'repostOf' || key === 'likeOf'))
                return new Entry(val);
            if (key === 'children')
                return val.map(url => new Entry(url));
            if (key === '') {
                var entry = new Entry();
                entry.name = val.name;
                entry.published = new Date(val.published);
                entry.content = val.content;
                entry.photo = val.photo;
                entry.url = val.url;
                entry.author = val.author;
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

