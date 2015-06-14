var sqlite3 = require('sqlite3').verbose();
var nodefn = require('when/node');

var db = new sqlite3.Database('index.db');

db.run(
    'CREATE TABLE IF NOT EXISTS entries (' +
    'url TEXT PRIMARY KEY,' +
    'author TEXT,' +
    'date TEXT,' +
    'isArticle INTEGER,' +
    'isReply INTEGER,' +
    'isRepost INTEGER,' +
    'isLike INTEGER,' +
    'isPhoto INTEGER' +
    ')'
);


function store(entry) {
    return nodefn.call(db.run.bind(db), 'INSERT INTO entries ' +
        '(url, author, date, isArticle, isReply, isRepost, ' +
        'isLike, isPhoto) '+
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        entry.url[0],
        entry.author[0].url[0],
        entry.published[0],
        entry.isArticle(),
        entry.isReply(),
        entry.isRepost(),
        entry.isLike(),
        entry.isPhoto()
    );
}

var url = 'http://foo.bar/1';

nodefn.call(db.get.bind(db), 'SELECT * FROM entries WHERE url=?', url).
then(function(row) {
    console.log(row);
}).
catch(function (e) {
    throw e;
});

