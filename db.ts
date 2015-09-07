///<reference path="typings/tsd.d.ts"/>
import sqlite3 = require('sqlite3');
import nodefn = require('when/node');
import microformat = require('./microformat');

class Db {
    dbRun: any;
    dbGet: any;
    dbAll: any;

    constructor(dbfile) {
        var db = new sqlite3.Database(dbfile);
        this.dbRun = nodefn.lift(db.run.bind(db));
        this.dbGet = nodefn.lift(db.get.bind(db));
        this.dbAll = nodefn.lift(db.all.bind(db));
    }

    init() {
        return this.dbRun(
            'CREATE TABLE IF NOT EXISTS entries (' +
            'url TEXT PRIMARY KEY,' +
            'domain TEXT,' +
            'date TEXT,' +
            'isArticle INTEGER,' +
            'isReply INTEGER,' +
            'isRepost INTEGER,' +
            'isLike INTEGER,' +
            'json TEXT' +
            ')'
        ).
            then(() => this.dbRun(
                    'CREATE TABLE IF NOT EXISTS tokens (' +
                    'token TEXT PRIMARY KEY,' +
                    'client_id TEXT,' +
                    'scope TEXT,' +
                    'date_issued TEXT' +
                    ')')
            );
    }

    store(entry) {
        return this.dbRun('INSERT OR REPLACE INTO entries ' +
            '(url, domain, date, isArticle, isReply, isRepost, isLike, json) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            entry.url,
            entry.domain(),
            entry.published.toISOString(),
            entry.isArticle(),
            entry.isReply(),
            entry.isRepost(),
            entry.isLike(),
            entry.serialize()
        );
    }

    get(url) {
        return this.dbGet('SELECT * FROM entries WHERE url=?', url).
            then(function (data) {
                if (data === undefined) throw new Error(url + ' not found');
                return data;
            }).
            then(record => microformat.Entry.deserialize(record.json));
    }

    getAllByDomain(domain) {
        return this.dbAll('SELECT * FROM entries WHERE domain=? ORDER BY date DESC', domain).
            then(function (records) {
                return records.map(record => microformat.Entry.deserialize(record.json));
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