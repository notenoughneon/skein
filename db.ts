///<reference path="typings/tsd.d.ts"/>
import sqlite3 = require('sqlite3');
var nodefn = require('when/node');
import microformat = require('./microformat');

function unmarshall(record) {
    return new microformat.Entry(JSON.parse(record.json));
}

class Db {
    dbRun: any;
    dbGet: any;
    dbAll: any;

    constructor(dbfile) {
        var db = new sqlite3.Database(dbfile);
        this.dbRun = nodefn.lift(db.run.bind(db));
        this.dbGet = nodefn.lift(db.get.bind(db));
        this.dbAll = nodefn.lift(db.all.bind(db));
        this.dbRun(
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
        this.dbRun(
            'CREATE TABLE IF NOT EXISTS tokens (' +
            'token TEXT PRIMARY KEY,' +
            'client_id TEXT,' +
            'scope TEXT,' +
            'date_issued TEXT' +
            ')'
        );
    }

    store(entry) {
        return this.dbRun('INSERT OR REPLACE INTO entries ' +
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
    }

    existsByAuthor(author, url) {
        return this.dbGet('SELECT * FROM entries WHERE author=? AND url=?', author, url).
            then(function(data) {
                return data !== undefined;
            });
    }

    get(url) {
        return this.dbGet('SELECT * FROM entries WHERE url=?', url).
            then(function (data) {
                if (data === undefined) throw new Error(url + ' not found');
                return data;
            }).
            then(unmarshall);
    }

    getAllByAuthor(author) {
        return this.dbAll('SELECT * FROM entries WHERE author=? ORDER BY date DESC', author).
            then(function (records) {
                return records.map(unmarshall);
            });
    }

    storeToken(token, client_id, scope) {
        return this.dbRun('INSERT INTO tokens ' +
            '(token, client_id, scope, date_issued) ' +
            'VALUES (?, ?, ?, ?)',
            token,
            client_id,
            scope,
            (new Date).toISOString()
        ).then(function () {
                return {token: token, client_id: client_id, scope: scope};
            });
    }

    getToken(token) {
        return this.dbGet('SELECT * FROM tokens WHERE token=?', token);
    }

    deleteToken(token) {
        return this.dbRun('DELETE FROM tokens WHERE token=?', token);
    }

    listTokens() {
        return this.dbAll('SELECT * FROM tokens ORDER BY date_issued DESC');
    }
}

export = Db;