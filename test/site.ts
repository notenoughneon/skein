///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import microformat = require('../microformat');
import Db = require('../db');
import Site = require('../site');
import util = require('../util');

// test web server
var express = require('express');
var app = express();
var http = require('http').Server(app);
app.use(express.static('build/test/static', {extensions: ['html']}));

var config = {
    "title": "Test Site",
    "url": "http://localhost:8000",
    "author": {
    "name": "Test User",
        "elsewhere": [
        {"name": "Twitter", "url": "https://twitter.com/testuser"},
    ]
},
    "entriesPerPage": 10,
    "authUrl": "http://localhost:8001/auth",
    "tokenUrl": "http://localhost:8001/token",
    "micropubUrl": "http://localhost:8001/micropub",
    "webmentionUrl": "http://localhost:8001/webmention",
    "publisher": {
    "type": "file",
        "postRegex": "^20[0-9][0-9]/.*\\.html$",
        "root": "build/test/static"
},
    "password": "xxxxxxxx"
};

describe('site', function() {
    var site;
    var post1, post2;

    before(function(done) {
        var db = new Db(':memory:');
        db.init().
            then(done).
            catch(done);
        site = new Site(config, db);
        var server = http.listen(8000);
    });

    it('can post a note', function(done) {
        var m = {content: 'Hello World!'};
        site.publish(m).
            then(entry => {
                post1 = entry;
                return site.db.get(entry.url);
            }).
            then(e => {
                assert.equal(e.content.value, m.content);
            }).
            then(done).
            catch(done);
    });

    it('can post a reply', function(done) {
        var m = {content: 'This is a reply', replyTo: post1.url};
        site.publish(m).
            then(entry => {
                post2 = entry;
                return site.db.get(entry.url);
            }).
            then(e => {
                assert.equal(e.content.value, m.content);
                assert.equal(e.content.replyTo, m.replyTo);
            }).
            then(done).
            catch(done);
    });

    it.skip('can update post with reply', function(done) {
        entry1.children.push(entry2);
        entry2.replyTo = new microformat.Entry(entry1.url); // break circular reference
        site.publish(entry1).
            then(() => site.db.get(entry1.url)).
            then(e => site.db.hydrate(e)).
            then(e => assert.deepEqual(e, entry1)).
            then(done).
            catch(done);
    });
});