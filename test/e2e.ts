import assert = require('assert');
import url = require('url');
import querystring = require('querystring');
import fs = require('fs');
import express = require('express');
import Request = require('request');
import Site = require('../site');
import Api = require('../api');
import child_process = require('child_process');
import util = require('../util');
import Debug = require('debug');
var debug = Debug('e2e');

var get = util.promisify(Request.get);
var post = util.promisify(Request.post);
var exec = util.promisify(child_process.exec);

var app = express();
var configFile = 'test/config.json';
var config = JSON.parse(fs.readFileSync(configFile).toString());
var site = new Site(config);
var api = new Api(site);

app.use('/api', api.router);
app.use(express.static(config.staticSiteRoot, {extensions: ['html']}));
app.set('views', './template');
app.set('view engine', 'jade');

describe('e2e', function() {
    var server;
    var code;
    var token;
    
    before(function(done) {
        exec('rm -rf ' + config.publisher.root)
        .then(() => exec('cp -R skel ' + config.publisher.root))
        .then(() => server = app.listen(config.port))
        .then(() => done())
        .catch(done);
    });

    after(function() {
        server.close();
    });
    
    it('auth endpoint rejects invalid password', function(done) {
        var form = {
            password: 'invalid password',
            client_id: 'e2e_test',
            scope: 'post',
            redirect_uri: 'http://bogus.redirect',
            state: '12345'
        };
        post({ url: config.authUrl, form: form })
        .then (res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });

    it('auth endpoint issues code', function(done) {
        var form = {
            password: config.password,
            client_id: 'e2e_test',
            scope: 'post',
            redirect_uri: 'http://bogus.redirect',
            state: '12345'
        };
        post({ url: config.authUrl, form: form })
        .then (res => {
            assert(res.statusCode === 302);
            var location = res.headers.location;
            assert(location.startsWith(form.redirect_uri));
            var query = url.parse(location).query;
            var args = querystring.parse(query);
            assert(args.state === form.state);
            assert(args.me === config.url);
            code = args.code;
        })
        .then(done)
        .catch(done);
    });

    it('token endpoint rejects invalid code', function(done) {
        var form = { code: 'invalid code' };
        post({ url: config.tokenUrl, form: form })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });

    it('token endpoint issues token', function(done) {
        var form = { code: code };
        post({ url: config.tokenUrl, form: form })
        .then(res => {
            assert(res.statusCode === 200);
            var args = querystring.parse(res.body);
            assert(args.scope === 'post');
            assert(args.me === config.url);
            token = args.access_token;
        })
        .then(done)
        .catch(done);
    });
    
    it('micropub endpoint requires token', function(done) {
        var form = { h: 'entry', content: 'Hello World!' };
        post({ url: config.micropubUrl, form: form })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });
    
    it('micropub endpoint rejects invalid access token in header', function(done) {
        var form = { h: 'entry', content: 'Access token in header' };
        var headers = { Authorization: 'bearer ' + 'bad token' };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });
    
    it('micropub endpoint rejects invalid access token in body', function(done) {
        var form = { h: 'entry', content: 'Access token in body', access_token: 'bad token' };
        post({ url: config.micropubUrl, form: form })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });
    
    it('micropub endpoint accepts access token in header', function(done) {
        var form = { h: 'entry', content: 'Access token in header' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
        })
        .then(done)
        .catch(done);
    });

    it('micropub endpoint accepts access token in body', function(done) {
        var form = { h: 'entry', content: 'Access token in body', access_token: token };
        post({ url: config.micropubUrl, form: form })
        .then(res => {
            assert(res.statusCode === 201);
        })
        .then(done)
        .catch(done);
    });
    
    it.skip('posting stress test', function(done) {
        this.timeout(0);
        var headers = { Authorization: 'bearer ' + token };
        var elts = util.range(1, 10);
        Promise.all(elts.map(elt => {
            let form = { h: 'entry', content: 'Stress test post ' + elt };
            return post({ url: config.micropubUrl, form: form, headers: headers })
            .then(res => {
                assert(res.statusCode === 201);
                debug('Done ' + res.headers.location);
            });
        }))
        .then(() => done())
        .catch(done);
        
    });
    
    var testNote;
    it('post note via micropub', function(done) {
        var form = { h: 'entry', content: 'Test note' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testNote = e;
            assert(e.name === form.content);
            assert(e.content.html === form.content);
            assert(e.content.value === form.content);
        })
        .then(done)
        .catch(done);
    });
    
    var testReply;
    it('post reply via micropub', function(done) {
        var form = { h: 'entry', content: 'Test reply', 'in-reply-to': testNote.url };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testReply = e;
            assert(e.name === form.content);
            assert(e.replyTo[0].url === testNote.url);
            assert(e.replyTo[0].name === testNote.name);
            return site.get(testNote.url);
        })
        .then(e => {
            testNote = e;
            assert(e.children[0].url === testReply.url);
            assert(e.children[0].name === testReply.name);
        })
        .then(done)
        .catch(done);
    });
    
    var testLike;
    it('post like via micropub', function(done) {
        var form = { h: 'entry', content: 'Test like', 'like-of': testNote.url };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testLike = e;
            assert(e.name === form.content);
            assert(e.likeOf[0].url === testNote.url);
            assert(e.likeOf[0].name === testNote.name);
            return site.get(testNote.url);
        })
        .then(e => {
            testNote = e;
            assert(e.children[1].url === testLike.url);
            assert(e.children[1].name === testLike.name);
        })
        .then(done)
        .catch(done);
    });
    
    var testRepost;
    it('post repost via micropub', function(done) {
        var form = { h: 'entry', content: 'Test repost', 'repost-of': testNote.url };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testRepost = e;
            assert(e.name === form.content);
            assert(e.repostOf[0].url === testNote.url);
            assert(e.repostOf[0].name === testNote.name);
            return site.get(testNote.url);
        })
        .then(e => {
            testNote = e;
            assert(e.children[2].url === testRepost.url);
            assert(e.children[2].name === testRepost.name);
        })
        .then(done)
        .catch(done);
    });
});