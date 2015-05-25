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
        mf = {properties:{url:url}};
    }
    Entry.call(this, mf);
    this.p = p;    // parent mf properties: p-in-reply-to, etc
}

function Card(mf) {
    this.name = prop(mf, 'name');
    this.photo = prop(mf, 'photo');
    this.url = prop(mf, 'url');
};

Entry.prototype = {
    getRootClass: function() {
                      return 'h-entry';
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
