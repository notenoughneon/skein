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
var api = new Api(new Site(config));

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
    
    it('micropub endpoint requires token', function(done) {
        var form = { h: 'entry', content: 'Hello World!' };
        post({ url: config.micropubUrl, form: form })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
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
    
    it('can post a note (access token in header)', function(done) {
        var form = { h: 'entry', content: 'Access token in header' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
        })
        .then(done)
        .catch(done);
    });

    it('can post a note (access token in body)', function(done) {
        var form = { h: 'entry', content: 'Access token in body', access_token: token };
        post({ url: config.micropubUrl, form: form })
        .then(res => {
            assert(res.statusCode === 201);
        })
        .then(done)
        .catch(done);
    });
    
    it('posting stress test', function(done) {
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
});