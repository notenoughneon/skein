///<reference path="../typings/main.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import url = require('url');
import path = require('path');
import child_process = require('child_process');
import express = require('express');
import nodefn = require('when/node');
var parser = require('microformat-node');
import microformat = require('../microformat');
import Site = require('../site');
import util = require('../util');

var exec = nodefn.lift(child_process.exec);

var app = express();
var config = JSON.parse(fs.readFileSync('test/config.json').toString());

app.use(express.static('build/test/static', {extensions: ['html']}));

describe('site', function() {
    var server;
    var site: Site;
    var post1: microformat.Entry,
    post2: microformat.Entry,
    post3: microformat.Entry,
    post4: microformat.Entry,
    post5: microformat.Entry;

    before(function(done) {
        exec('rm -rf ' + config.publisher.root)
        .then(() => exec('cp -R skel ' + config.publisher.root))
        .then(() => server = app.listen(config.port))
        .then(() => site = new Site(config))
        .then(() => done())
        .catch(done);
    });

    after(function() {
        server.close();
    });

    it('can post a note', function(done) {
        var m = {content: 'Hello World!'};
        site.publish(m).
            then(entry => {
                post1 = entry;
                return site.get(entry.url);
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
                return site.get(entry.url);
            }).
            then(e => {
                assert.equal(e.content.value, m.content);
                assert.deepEqual(e.replyTo.map(r => r.url), [m.replyTo]);
            }).
            then(done).
            catch(done);
    });

    it('can update post with reply', function(done) {
        site.receiveWebmention(post2.url, post1.url).
            then(() => site.get(post1.url)).
            then(e => {
                assert.equal(e.children.length, 1);
                assert.equal(e.children[0].url, post2.url);
                assert.equal(e.children[0].content.value, post2.content.value);
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
                post3 = entry;
                return site.get(entry.url);
            }).
            then(e => {
                assert.equal(e.content.value, m.content);
                var photoSlug = path.join(path.dirname(e.getSlug()), 'teacups.jpg');
                assert.deepEqual(e.getPhotos(),[config.url + photoSlug]);
                assert(fs.existsSync(path.join(config.publisher.root, photoSlug)));
            }).
            then(done).
            catch(done);
    });
    
    it('can post a note with a tag', function(done) {
        var category = ['indieweb', 'test'];
        var m = {content: 'A post with tags', category: category};
        site.publish(m).
            then(entry => {
                post4 = entry;
                return site.get(entry.url);
            }).
            then(e => {
                assert.equal(e.content.value, m.content);
                assert.deepEqual(e.category, category);
            }).
            then(done).
            catch(done);
    });

    it('can post an article', function(done) {
        var m = {name: 'Title', content: {html: 'Hello <b>World</b>!'}};
        site.publish(m).
            then(entry => {
                post5 = entry;
                return site.get(entry.url);
            }).
            then(e => {
                assert.equal(e.name, m.name);
                assert.equal(e.content.html, m.content.html);
                assert.equal(e.content.value, 'Hello World!');
            }).
            then(done).
            catch(done);
    });

    //FIXME: brittle
    it('can generate an index', function(done) {
        site.generateStream().
            then(() => parser.getAsync({html: fs.readFileSync(config.publisher.root + '/index.html')})).
            then(mf => {
                var feed = mf.items[0];
                assert.equal(feed.type[0], 'h-feed');
                var entry1 = feed.children[3];
                assert.equal(entry1.type[0], 'h-entry');
                assert.equal(entry1.properties.url[0], post2.url);
                assert.equal(entry1.properties.published[0], post2.published.toISOString());
                assert.deepEqual(entry1.properties.content[0], post2.content);
                assert.equal(entry1.properties.name[0], post2.name);
                var entry2 = feed.children[4];
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
    
    it('can generate a tag index', function(done) {
        site.generateTagIndex('indieweb').
            then(() => parser.getAsync({html: fs.readFileSync(config.publisher.root + '/tags/indieweb.html')})).
            then(mf => {
                var feed = mf.items[0];
                assert.equal(feed.type[0], 'h-feed');
                var entry1 = feed.children[0];
                assert.equal(entry1.type[0], 'h-cite');
                assert.equal(entry1.properties.url[0], post4.url);
                assert.equal(entry1.properties.published[0], post4.published.toISOString());
                assert.equal(entry1.properties.name[0], post4.name);
            }).
            then(done).
            catch(done);
    });

    it('can generate an article index', function(done) {
        site.generateArticleIndex()
        .then(() => parser.getAsync({html: fs.readFileSync(config.publisher.root + '/articles.html')}))
        .then(mf => {
            var feed = mf.items[0];
            assert.equal(feed.type[0], 'h-feed');
            var entry1 = feed.children[0];
            assert.equal(entry1.type[0], 'h-cite');
            assert.equal(entry1.properties.url[0], post5.url);
            assert.equal(entry1.properties.published[0], post5.published.toISOString());
            assert.equal(entry1.properties.name[0], post5.name);
        })
        .then(done)
        .catch(done);
    });

    it('regenerate works', function(done) {
        exec('find ' + config.publisher.root + ' -name *.html | xargs rm').
            then(() => site.generateAll()).
            then(() => {
                var path = config.publisher.root + url.parse(post1.url).path + '.html';
                assert.equal(fs.existsSync(path), true, path + ' exists');
                path = config.publisher.root + url.parse(post2.url).path + '.html';
                assert.equal(fs.existsSync(path), true, path + ' exists');
                path = config.publisher.root + '/index.html';
                assert.equal(fs.existsSync(path), true, path + ' exists');
                path = config.publisher.root + '/tags/indieweb.html';
                assert.equal(fs.existsSync(path), true, path + ' exists');
            }).
            then(done).
            catch(done);
    });
    

});