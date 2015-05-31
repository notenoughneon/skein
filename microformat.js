var parser = require('microformat-node');
var nodefn = require('when/node');
var url = require('url');

function getHEntry(url) {
    return nodefn.call(parser.parseUrl, url, {filters: ['h-entry']}).
        then(function(data) {
            return new Entry(data.items[0]);
        });
}

function getRepHCard(url) {
    return nodefn.call(parser.parseUrl, url, {filters: ['h-card']}).
        then(function(data) {
            var cards = data.items.map(function(h) {
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
            if (data.rels.me !== undefined) {
                var match = cards.filter(function(c) {
                    return data.rels.me.some(function(r) {
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
        map(function(c) { return new Entry(c); });
}

function Card(mf) {
    this.name = prop(mf, 'name');
    this.photo = prop(mf, 'photo');
    this.url = prop(mf, 'url');
    this.uid = prop(mf, 'uid');
}

Entry.prototype = {
    getPostType: function() {
                     if (this.isReply())
                         return 'reply';
                     if (this.isRepost())
                         return 'repost';
                     if (this.isLike())
                         return 'like';
                     if (this.isArticle())
                         return 'article';
                     if (this.isPhoto())
                         return 'photo';
                     return 'note';
                 },
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

exports.getHEntry = getHEntry;
exports.getRepHCard = getRepHCard;
exports.Entry = Entry;
exports.Card = Card;
