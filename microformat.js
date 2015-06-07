var parser = require('microformat-node');
var when = require('when');
var nodefn = require('when/node');
var url = require('url');
var parseHtml = nodefn.lift(parser.parseHtml);

function getHEntryWithCard(html, url) {
    return getHEntry(html, url).
        then(function(entry) {
            if (entry.author.length == 0) {
                return getRepHCard(html, url).
                    then(function(card) {
                        if (card !== null) entry.author = [card];
                        return entry;
                    });
            }
            else return entry;
        });
}

function getHEntry(html, url) {
    return parseHtml(html, {filters: ['h-entry'], baseUrl: url}).
        then(function(mf) {
            return new Entry(mf.items[0]);
        });
}

function getRepHCard(html, url) {
    return parseHtml(html, {filters: ['h-card'], baseUrl: url}).
        then(function(mf) {
            var cards = mf.items.map(function(h) {
                return new Card(h);
            });
            // 1. uid and url match page url
            var match = cards.filter(function(c) {
                return c.url.length > 0 &&
                c.uid.length > 0 &&
                urlsEqual(c.url[0], url) &&
                urlsEqual(c.uid[0], url);
            });
            if (match.length > 0) return match[0];
            // 2. url has rel=me
            if (mf.rels.me !== undefined) {
                var match = cards.filter(function(c) {
                    return mf.rels.me.some(function(r) {
                        return c.url.length > 0 &&
                        urlsEqual(c.url[0], r);
                    });
                });
                if (match.length > 0) return match[0];
            }
            // 3. is only hcard, url matches page url
            if (cards.length === 1) {
                var card = cards[0];
                if (card.url.length > 0 &&
                        urlsEqual(card.url[0], url))
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

function prop(mf, name) {
    if (mf.properties[name] !== undefined)
        return mf.properties[name];
    return [];
}

function children(mf) {
    if (mf.children !== undefined)
        return mf.children;
    return [];
}

function Entry(mf) {
    if (typeof(mf) === 'string') {
        var url = mf;
        mf = { properties: { url: [url] } };
    }
    this.name = prop(mf, 'name');
    this.published = prop(mf, 'published');
    this.content = prop(mf, 'content');
    this.photo = prop(mf, 'photo');
    this.url = prop(mf, 'url');
    this.author = prop(mf, 'author').
        map(function(a) { return new Card(a); });
    this.syndication = prop(mf, 'syndication');
    this.replyTo = prop(mf, 'in-reply-to').
        map(function(r) { return new Entry(r); });
    this.likeOf = prop(mf, 'like-of').
        map(function(r) { return new Entry(r); });
    this.repostOf = prop(mf, 'repost-of').
        map(function(r) { return new Entry(r); });
    this.children = children(mf).
        concat(prop(mf, 'comment')).
        map(function(c) { return new Entry(c); });
}

function Card(mf) {
    this.name = prop(mf, 'name');
    this.photo = prop(mf, 'photo');
    this.url = prop(mf, 'url');
    this.uid = prop(mf, 'uid');
}

Entry.prototype = {
    references: function() {
                    return this.replyTo.
                        concat(this.repostOf).
                        concat(this.likeOf).
                        map(function(r) { return r.url[0]; });
                },
    isReply: function() {
                 return this.replyTo.length > 0;
             },
    isRepost: function() {
                  return this.repostOf.length > 0;
              },
    isLike: function() {
                return this.likeOf.length > 0;
            },
    isPhoto: function() {
                 return this.photo.length > 0;
             },
    isReplyTo: function(url) {
                   return this.references().indexOf(url) !== -1;
               },
    isArticle: function() {
                   return this.name.length > 0 &&
                       this.content.length > 0 &&
                       this.name[0] !== this.content[0].value;
               }

};

exports.getHEntryWithCard = getHEntryWithCard;
exports.getHEntry = getHEntry;
exports.getRepHCard = getRepHCard;
exports.Entry = Entry;
exports.Card = Card;
