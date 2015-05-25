function getprop(mf, name) {
    if (mf.properties[name] !== undefined &&
            mf.properties[name][0] !== undefined)
        return mf.properties[name][0];
    return null;
}

function Entry() {
    this.name = null;
    this.published = null;
    this.contentHtml = null;
    this.contentValue = null;
    this.photo = null;
    this.url = null;
    this.author = null;
    this.syndication = [];
    this.replyTo = [];
    this.likeOf = [];
    this.repostOf = [];
    this.children = [];
}

function Cite() {
    this.p = [];    // parent mf properties: p-in-reply-to, etc
}

function Card() {
    this.name = null;
    this.photo = null;
    this.url = null;
};

Entry.prototype = {
    loadFromMf: function(mf) {
                    this.name = getprop(mf, 'name');
                    this.published = getprop(mf, 'published');
                    var content = getprop(mf, 'content');
                    if (content !== null) {
                        this.contentHtml = content.html;
                        this.contentValue = content.value;
                    }
                    this.photo = getprop(mf, 'photo');
                    this.url = getprop(mf, 'url');
                    var author = getprop(mf, 'author');
                    if (author !== null) {
                        this.author = new Card();
                        card.loadFromMf(author);
                    }
                    this.syndication = getprop(mf, 'syndication');
                },
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
    loadFromMf: function(mf) {
                    this.name = getprop(mf, 'name');
                    this.photo = getprop(mf, 'photo');
                    this.url = getprop(mf, 'url');
                }
};

exports.Entry = Entry;
exports.Card = Card;
