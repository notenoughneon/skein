var sqlite3 = require('sqlite3').verbose();
var nodefn = require('when/node');
var microformat = require('./microformat');

function init(dbfile) {
    var db = new sqlite3.Database(dbfile);
    var run = nodefn.lift(db.run.bind(db));
    var get = nodefn.lift(db.get.bind(db));
    var all = nodefn.lift(db.all.bind(db));

    run(
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

    run(
        'CREATE TABLE IF NOT EXISTS tokens (' +
        'token TEXT PRIMARY KEY,' +
        'client_id TEXT,' +
        'scope TEXT,' +
        'date_issued TEXT' +
        ')'
    );

    function unmarshall(record) {
        return new microformat.Entry(JSON.parse(record.json));
    }

    return {
        store: function(entry)
        {
            return run('INSERT OR REPLACE INTO entries ' +
                '(url, author, date, isArticle, isReply, isRepost, ' +
                'isLike, isPhoto, json) ' +
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
        },

        get: function(url) {
            return get('SELECT * FROM entries WHERE url=?', url).
                then(function (data) {
                    if (data === undefined) throw new Error(url + ' not found');
                    return data;
                }).
                then(unmarshall);
        },

        getAllByAuthor: function(author, limit, offset) {
            return all('SELECT * FROM entries WHERE author=? ORDER BY date DESC LIMIT ? OFFSET ?',
                author, limit, offset).
                then(function (records) {
                    return records.map(unmarshall);
                });
        },

        storeToken: function(token, client_id, scope) {
            return run('INSERT INTO tokens ' +
                '(token, client_id, scope, date_issued) ' +
                'VALUES (?, ?, ?, ?)',
                token,
                client_id,
                scope,
                (new Date).toISOString()
            ).then(function () {
                    return {token: token, client_id: client_id, scope: scope};
                });
        },

        getToken: function(token) {
            return get('SELECT * FROM tokens WHERE token=?', token);
        },

        deleteToken: function(token) {
            return run('DELETE FROM tokens WHERE token=?', token);
        },

        listTokens: function() {
            return all('SELECT * FROM tokens ORDER BY date_issued DESC');
        }
    };
}

exports.init = init;