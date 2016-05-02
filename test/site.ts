///<reference path="../typings/main.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import url = require('url');
import path = require('path');
import child_process = require('child_process');
import express = require('express');
var parser = require('microformat-node');
import microformat = require('../microformat');
import Site = require('../site');
import util = require('../util');

var exec = util.promisify(child_process.exec);

var app = express();
var config = JSON.parse(fs.readFileSync('test/config.json').toString());
var site = new Site(config);

app.use(express.static('build/test/static', {extensions: ['html']}));

describe('site', function() {
    var server;
    var post1: microformat.Entry,
    post2: microformat.Entry,
    post3: microformat.Entry,
    post4: microformat.Entry,
    post5: microformat.Entry;

    before(function(done) {
        exec('rm -rf ' + config.publisher.root)
        .then(() => site.init())
        .then(() => server = app.listen(config.port))
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
                assert.equal(e.replyTo.url, m.replyTo);
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

    it('generateAll works', function(done) {
        var indexfile = config.publisher.root + '/index.html';
        var tagfile = config.publisher.root + '/tags/indieweb.html';
        var postfile = config.publisher.root + post1.getPath() + '.html';
        site.config.title = "New Blog Title";
        site.generateAll().
            then(() => {
                var html = fs.readFileSync(indexfile);
                assert(html.toString().indexOf(site.config.title) !== -1);
                html = fs.readFileSync(tagfile);
                assert(html.toString().indexOf(site.config.title) !== -1);
                html = fs.readFileSync(postfile);
                assert(html.toString().indexOf(site.config.title) !== -1);
            }).
            then(done).
            catch(done);
    });
    
    it('update works', function(done) {
        post1.content.html = 'Updated content';
        site.update(post1)
        .then(() => site.get(post1.url))
        .then(e => {
            assert(e.content.html === 'Updated content');
        })
        .then(done)
        .catch(done);
    });
    
    it('delete works', function(done) {
        site.delete(post4.url)
        .then(() => site.get(post4.url))
        .then(() => assert(false))
        .catch(err => done(err.message.endsWith('not found') ? null : err));
    })
    
    it('validate works', function(done) {
        site.validate()
        .then(res => {
            assert(res.length === 0);
        })
        .then(done)
        .catch(done);
    });
});