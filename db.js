var sqlite3 = require('sqlite3').verbose();
var nodefn = require('when/node');
var microformat = require('./microformat');

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
    'isPhoto INTEGER,' +
    'json TEXT' +
    ')'
);


function store(entry) {
    return nodefn.call(db.run.bind(db), 'INSERT OR REPLACE INTO entries ' +
        '(url, author, date, isArticle, isReply, isRepost, ' +
        'isLike, isPhoto, json) '+
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        entry.url[0],
        entry.author[0].url[0],
        entry.published[0],
        entry.isArticle(),
        entry.isReply(),
        entry.isRepost(),
        entry.isLike(),
        entry.isPhoto(),
        JSON.stringify(entry)
    );
}

function unmarshall(record) {
    return new microformat.Entry(JSON.parse(record.json));
}

function get(url) {
    return nodefn.call(db.get.bind(db), 'SELECT * FROM entries WHERE url=?', url).
        then(unmarshall);
}

function getAllByAuthor(author, limit, offset) {
    return nodefn.call(db.all.bind(db),
        'SELECT * FROM entries WHERE author=? ORDER BY date DESC LIMIT ? OFFSET ?', author, limit, offset).
        then(function (records) { return records.map(unmarshall); });
}

exports.store = store;
exports.get = get;
exports.getAllByAuthor = getAllByAuthor;
