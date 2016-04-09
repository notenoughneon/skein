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

var server = app.listen(config.port);

describe('e2e', function() {
    var code;
    var token;
    
    before(function(done) {
        exec('rm -rf ' + config.publisher.root).
            then(() => exec('cp -R skel ' + config.publisher.root)).
            then(() => done()).
            catch(done);
    });
    
    it('micropub endpoint requires token', function(done) {
        var m = {content: 'Hello World!'};
        post(config.micropubUrl, {form: m})
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });
    
    it('auth endpoint rejects invalid password', function(done) {
        var r = {
            password: 'invalid password',
            client_id: 'e2e_test',
            scope: 'post',
            redirect_uri: 'http://bogus.redirect',
            state: '12345'
        };
        post(config.authUrl, {form: r})
        .then (res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });
    
    it('auth endpoint issues token', function(done) {
        var r = {
            password: config.password,
            client_id: 'e2e_test',
            scope: 'post',
            redirect_uri: 'http://bogus.redirect',
            state: '12345'
        };
        post(config.authUrl, {form: r})
        .then (res => {
            assert(res.statusCode === 302);
            var location = res.headers.location;
            assert(location.startsWith(r.redirect_uri));
            var query = url.parse(location).query;
            var args = querystring.parse(query);
            assert(args.state === r.state);
            assert(args.me === config.url);
            code = args.code;
        })
        .then(done)
        .catch(done);
    });
});