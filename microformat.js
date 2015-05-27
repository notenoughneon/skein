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

Card.prototype = {
};

exports.Entry = Entry;
exports.Card = Card;
