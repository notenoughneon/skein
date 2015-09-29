///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import url = require('url');
import path = require('path');
import child_process = require('child_process');
import nodefn = require('when/node');
var parser = require('microformat-node');
import microformat = require('../microformat');
import Db = require('../db');
import Site = require('../site');
import util = require('../util');

var exec = nodefn.lift(child_process.exec);

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
        {"name": "Twitter", "url": "https://twitter.com/testuser"}
    ]
},
    "entriesPerPage": 10,
    "authUrl": "http://localhost:8000/auth",
    "tokenUrl": "http://localhost:8000/token",
    "micropubUrl": "http://localhost:8000/micropub",
    "webmentionUrl": "http://localhost:8000/webmention",
    "publisher": {
        "type": "file",
        "root": "build/test/static"
},
    "password": "xxxxxxxx"
};

describe('site', function() {
    var site: Site;
    var post1: microformat.Entry,
    post2: microformat.Entry;

    before(function(done) {
        var db = new Db(':memory:');
        db.init().
            then(() => exec('rm -rf ' + config.publisher.root)).
            then(() => exec('cp -R skel ' + config.publisher.root)).
            then(() => done()).
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
                assert.equal(e.replyTo.url, m.replyTo);
            }).
            then(done).
            catch(done);
    });

    it('can update post with reply', function(done) {
        site.receiveWebmention(post2.url, post1.url).
            then(() => site.db.getTree(post1.url)).
            then(e => {
                assert.equal(e.children.length, 1);
                assert.equal(e.children[0].url, post2.url);
                assert.equal(e.children[0].content.value, post2.content.value);
            }).
            then(done).
            catch(done);
    });

    it('can generate an index', function(done) {
        site.generateIndex().
            then(() => parser.getAsync({html: fs.readFileSync(config.publisher.root + '/index.html')})).
            then(mf => {
                var feed = mf.items[0];
                assert.equal(feed.type[0], 'h-feed');
                var entry1 = feed.children[0];
                assert.equal(entry1.type[0], 'h-entry');
                assert.equal(entry1.properties.url[0], post2.url);
                assert.equal(entry1.properties.published[0], post2.published.toISOString());
                assert.deepEqual(entry1.properties.content[0], post2.content);
                assert.equal(entry1.properties.name[0], post2.name);
                var entry2 = feed.children[1];
                assert.equal(entry2.type[0], 'h-entry');
                assert.equal(entry2.properties.url[0], post1.url);
                assert.equal(entry2.properties.published[0], post1.published.toISOString());
                assert.deepEqual(entry2.properties.content[0], post1.content);
                assert.equal(entry2.properties.name[0], post1.name);
                var author = mf.items[1];
                assert.equal(author.type[0], 'h-card');
                assert.equal(author.properties.name[0], config.author.name);
                assert.equal(author.properties.url[0], config.url);
            }).
            then(done).
            catch(done);
    });

    it('reindex works', function(done) {
        site.db = new Db(':memory:');
        site.db.init().
            then(() => site.reIndex()).
            then(() => site.db.getAllByDomain(config.url)).
            then(entries => {
                assert.equal(entries.length, 2);
                assert.equal(entries[0].url, post2.url);
                assert.equal(entries[0].name, post2.name);
                assert.equal(entries[1].url, post1.url);
                assert.equal(entries[1].name, post1.name);
            }).
            then(done).
            catch(done);
    });

    it('regenerate works', function(done) {
        exec('find ' + config.publisher.root + ' -name *.html | xargs rm').
            then(() => site.reGenerate()).
            then(() => {
                var path = config.publisher.root + url.parse(post1.url).path + '.html';
                assert.equal(fs.existsSync(path), true, path + ' exists');
                path = config.publisher.root + url.parse(post2.url).path + '.html';
                assert.equal(fs.existsSync(path), true, path + ' exists');
                path = config.publisher.root + '/index.html';
                assert.equal(fs.existsSync(path), true, path + ' exists');
            }).
            then(done).
            catch(done);
    });
    
        it('can post a photo', function(done) {
        var m = {content: 'This is a photo', photo: {
            filename: 'teacups.jpg',
            tmpfile: 'test/teacups.jpg',
            mimetype: 'image/jpeg'
        }};
        site.publish(m).
            then(entry => {
                post2 = entry;
                return site.db.get(entry.url);
            }).
            then(e => {
                assert.equal(e.content.value, m.content);
                var photoSlug = path.join(path.dirname(e.getSlug()), 'teacups.jpg');
                assert.deepEqual(e.getPhotos(),[photoSlug]);
                assert(fs.existsSync(path.join(config.publisher.root, photoSlug)));
            }).
            then(done).
            catch(done);
    });
});