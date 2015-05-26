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
    this.name = prop(mf, 'name');
    this.published = prop(mf, 'published');
    this.content = prop(mf, 'content');
    this.photo = prop(mf, 'photo');
    this.url = prop(mf, 'url');
    this.author = prop(mf, 'author').
        map(function(a) {
            return new Card(a);
        });
    this.syndication = prop(mf, 'syndication');
    this.replyto = prop(mf, 'in-reply-to').
        map(function(r) {
            return new Cite(r, ['in-reply-to']);
        });
    this.likeof = prop(mf, 'like-of').
        map(function(r) {
            return new Cite(r, ['like-of']);
        });
    this.repostof = prop(mf, 'repost-of').
        map(function(r) {
            return new Cite(r, ['repost-of']);
        });
    this.children = children(mf).
        map(function(c) {
            return new Cite(c, []);
        });
}

function Cite(mf, p) {
    if (typeof(mf) === 'string') {
        var url = mf;
        mf = {properties:{url:[url]}};
    }
    Entry.call(this, mf);
    this.p = p;    // parent mf properties: p-in-reply-to, etc
}

function Card(mf) {
    this.name = prop(mf, 'name');
    this.photo = prop(mf, 'photo');
    this.url = prop(mf, 'url');
}

Entry.prototype = {
    getRootClass: function() {
                      return 'h-entry';
                  },
    getContentClass: function() {
                         if (this.isArticle())
                             return 'e-content p-name note-content';
                         return 'e-content';
                     },
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
                    return this.replyto.
                        concat(this.repostof).
                        concat(this.likeof).
                        map(function(r) { return r.url[0]; });
                },
    isReply: function() {
                 return this.replyto.length > 0;
             },
    isRepost: function() {
                  return this.repost.length > 0;
              },
    isLike: function() {
                return this.likeof.length > 0;
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

Cite.prototype = Object.create(Entry.prototype, {
    getRootClass: function() {
                      return 'h-cite' +
                        this.p.map(function(elt) {
                            return ' ' + elt;
                        }).join('');
                  }
});

Card.prototype = {
};

exports.Entry = Entry;
exports.Cite = Cite;
exports.Card = Card;
