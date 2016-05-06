import assert = require('assert');
import url = require('url');
import querystring = require('querystring');
import fs = require('fs');
import path = require('path');
import express = require('express');
import cheerio = require('cheerio');
import Request = require('request');
import Site = require('../site');
import Api = require('../api');
import child_process = require('child_process');
import util = require('../util');
import Debug = require('debug');
var debug = Debug('e2e');
import microformat = require('../microformat');

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
        .then(() => site.init())
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
            response_type: 'code',
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
    
    it('auth endpoint rejects invalid code (indieauth)', function(done) {
        var form = {
            code: 'invalid code',
            client_id: 'e2e_test',
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
    
    it('auth endpoint successful login (indieauth)', function(done) {
        var form = {
            password: config.password,
            client_id: 'e2e_test',
            response_type: 'id',
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
            var form2 = {
                code: args.code,
                redirect_uri: form.redirect_uri,
                client_id: form.client_id,
                state: form.state
            };
            return post({ url: config.authUrl, form: form2 });
        })
        .then(res => {
            assert(res.statusCode === 200);
            var args = querystring.parse(res.body);
            assert(args.me === config.url);
        })
        .then(done)
        .catch(done);
    });

    it('auth endpoint issues code', function(done) {
        var form = {
            password: config.password,
            client_id: 'e2e_test',
            response_type: 'code',
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
        var form = { code: 'invalid code', redirect_uri: 'http://bogus.redirect', client_id: 'e2e_test' };
        post({ url: config.tokenUrl, form: form })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });

    it('token endpoint issues token', function(done) {
        var form = { code: code, redirect_uri: 'http://bogus.redirect', client_id: 'e2e_test' };
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
        var form = { h: 'entry', content: 'Do not post' };
        post({ url: config.micropubUrl, form: form })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });
    
    it('micropub endpoint rejects invalid auth header', function(done) {
        var form = { h: 'entry', content: 'Do not post' };
        var headers = { Authorization: 'bad header' };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });
    
    it('micropub endpoint rejects invalid access token in header', function(done) {
        var form = { h: 'entry', content: 'Do not post' };
        var headers = { Authorization: 'bearer ' + 'bad token' };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });
    
    it('micropub endpoint rejects access token with invalid scope', function(done) {
        var authForm = {
            password: config.password,
            client_id: 'e2e_test',
            response_type: 'code',
            scope: 'bogus',
            redirect_uri: 'http://bogus.redirect',
            state: '12345'
        };
        post({ url: config.authUrl, form: authForm })
        .then (res => {
            assert(res.statusCode === 302);
            var location = res.headers.location;
            var query = url.parse(location).query;
            var args = querystring.parse(query);
            return post({ url: config.tokenUrl, form: { code: args.code, redirect_uri: 'http://bogus.redirect', client_id: 'e2e_test' } });
        })
        .then(res => {
            assert(res.statusCode === 200);
            var args = querystring.parse(res.body);
            var form = { h: 'entry', content: 'Do not post' };
            var headers = { Authorization: 'bearer ' + args.access_token };
            return post({ url: config.micropubUrl, form: form, headers: headers });
        })
        .then(res => {
            assert(res.statusCode === 401);
        })
        .then(done)
        .catch(done);
    });
    
    it('micropub endpoint rejects invalid access token in body', function(done) {
        var form = { h: 'entry', content: 'Do not post', access_token: 'bad token' };
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
    
    var testNote;
    it('post note via micropub', function(done) {
        var form = { h: 'entry', content: 'Test note.' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testNote = e;
            assert(e.name === form.content);
            assert(e.content.value === form.content);
        })
        .then(done)
        .catch(done);
    });
    
    it('whitespace behavior in plain text', function(done) {
        var form = { h: 'entry', content: 'Here is a line break.\nHere is    extra whitespace.\n    This line begins with whitespace.' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            assert(e.name === form.content);
            assert(e.content.value === form.content);
        })
        .then(done)
        .catch(done);
    });
    
    it('html in plain text escaped', function(done) {
        var form = { h: 'entry', content: 'Plain text note. <b>HTML</b> should be escaped.' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            assert(e.name === form.content);
            assert(e.content.value === form.content);
        })
        .then(done)
        .catch(done);
    });
    
    it.skip('youtube.com oembed', function(done) {
        var form = { h: 'entry', content: 'Youtube oembed. https://www.youtube.com/watch?v=sPasebVMIW4 https://youtu.be/bt_yCugXk8U' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            assert(e.name === form.content);
            assert(e.content.value === form.content);
        })
        .then(done)
        .catch(done);
    });
    
    it.skip('soundcloud.com oembed', function(done) {
        var form = { h: 'entry', content: 'Soundcloud oembed. https://soundcloud.com/dj-rasoul/dj-ra-soul-deep-n-da-bay-may-2014' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            assert(e.name === form.content);
            assert(e.content.value === form.content);
        })
        .then(done)
        .catch(done);
    });
    
    it.skip('twitter oembed', function(done) {
        var form = { h: 'entry', content: 'Twitter oembed. https://twitter.com/jennschiffer/status/708888255828250625' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            assert.equal(e.name, form.content);
            assert.equal(e.content.value, form.content);
        })
        .then(done)
        .catch(done);
    });
    
    it.skip('wordpress oembed', function(done) {
        var form = { h: 'entry', content: 'Wordpress oembed. http://abstractscience.net/radio-shows/absci-radio-show-as0946' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            assert.equal(e.name, form.content);
            assert.equal(e.content.value, form.content);
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
            assert(e.replyTo.url === testNote.url);
            assert(e.replyTo.name === testNote.name);
            return site.get(testNote.url);
        })
        .then(e => {
            testNote = e;
            assert(e.getChildren()[0].url === testReply.url);
            assert(e.getChildren()[0].name === testReply.name);
        })
        .then(done)
        .catch(done);
    });
    
    var testLike;
    it('post like via micropub', function(done) {
        var form = { h: 'entry', 'like-of': testNote.url };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testLike = e;
            assert(e.likeOf.url === testNote.url);
            assert(e.likeOf.name === testNote.name);
            return site.get(testNote.url);
        })
        .then(e => {
            testNote = e;
            assert(e.getChildren()[1].url === testLike.url);
        })
        .then(done)
        .catch(done);
    });
    
    var testRepost;
    it('post repost via micropub', function(done) {
        var form = { h: 'entry', 'repost-of': testNote.url };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testRepost = e;
            assert(e.repostOf.url === testNote.url);
            assert(e.repostOf.name === testNote.name);
            return site.get(testNote.url);
        })
        .then(e => {
            testNote = e;
            assert(e.getChildren()[2].url === testRepost.url);
        })
        .then(done)
        .catch(done);
    });
    
    it('post rsvp via micropub', function(done) {
        var html = '<html>\
            <body>\
            <div class="h-event">\
            <h1 class="p-name">Indieweb Summit</h1>\
            <time class="dt-start" datetime="2016-06-03">June 3</time>\
            <time class="dt-end" datetime="2016-06-05">5</time>\
            <span class="h-card p-location">\
                <span class="p-name">Vadio</span>, \
                <span class="p-street-address">919 SW Taylor St, Ste 300</span>, \
                <span class="p-locality">Portland</span>, <span class="p-region">Oregon</span>\
            </span>\
            </div>\
            </body>\
        </html>';
        site.publisher.put('event.html', html)
        .then(() => {
            var form = { h: 'entry', 'content[html]': 'RSVP <span class="p-rsvp">yes</span>', 'in-reply-to': 'http://localhost:8000/event.html' };
            var headers = { Authorization: 'bearer ' + token };
            return post({ url: config.micropubUrl, form: form, headers: headers });
        })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            assert.equal(e.replyTo.url, 'http://localhost:8000/event.html');
            assert.equal(e.replyTo.name, 'Indieweb Summit');
        })
        .then(done)
        .catch(done);
    });
    
    it('webmention send to nonexistent target', function(done) {
        util.sendWebmention('http://localhost:8000/12345', 'http://localhost:8000/nonexist')
        .then(() => assert(false))
        .catch(err => done(err.message.endsWith('returned status 404') ? null : err));
    });
    
    it('webmention receive deduplication', function(done) {
        util.sendWebmention(testReply.url, testNote.url)
        .then(() => {
            return site.get(testNote.url);
        })
        .then(e => {
            assert(e.getChildren().length === 3);
        })
        .then(done)
        .catch(done);
    });
        
    var testSyndication;
    it('post note with syndication', function(done) {
        var form = { h: 'entry', content: 'Test syndication', category: ['test'], syndication: [
            'https://twitter.com/testuser/status/12345',
            'https://instagram.com/p/12345',
            'https://facebook.com/12345'
        ] };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers, qsStringifyOptions: { arrayFormat: 'brackets' } })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testSyndication = e;
            assert(e.name === form.content);
            assert(e.content.value === form.content);
            assert.deepEqual(e.syndication, form.syndication);
        })
        .then(done)
        .catch(done);
    });

    it('post note with syndication (single string)', function(done) {
        var form = { h: 'entry', content: 'Test syndication (single string)', 
        syndication: 'https://twitter.com/testuser/status/12345' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            assert(e.name === form.content);
            assert(e.content.value === form.content);
            assert.deepEqual(e.syndication, [form.syndication]);
        })
        .then(done)
        .catch(done);
    });


    var testCategories;
    it('post note with categories', function(done) {
        var form = { h: 'entry', content: 'Test categories', category: ['indieweb', 'micropub'] };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers, qsStringifyOptions: { arrayFormat: 'brackets' } })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testCategories = e;
            assert(e.name === form.content);
            assert(e.content.value === form.content);
            assert.deepEqual(e.category, form.category);
        })
        .then(done)
        .catch(done);
    });
    
    it('post note with category (single string)', function(done) {
        var form = { h: 'entry', content: 'Test category (single string)', category: 'test' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            assert(e.name === form.content);
            assert(e.content.value === form.content);
            assert.deepEqual(e.category, [form.category]);
        })
        .then(done)
        .catch(done);
    });

    
    var testPhoto;
    it('post photo via micropub', function(done) {
        var formData = {
            h: 'entry',
            content: 'Test photo',
            photo: {
                value: fs.createReadStream('test/teacups.jpg'),
                options: {
                    filename: 'teacups.jpg',
                    contentType: 'image/jpg'
                }
            },
            'category[]': ['tea'],
            'syndication[]': ['https://instagram.com/p/12345']
        };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, formData: formData, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testPhoto = e;
            assert(e.name === formData.content);
            assert(e.content.value === formData.content);
            var photoSlug = path.join(path.dirname(e.getPath()), 'teacups.jpg');
            var $ = cheerio.load(e.content.html);
            assert.deepEqual($('img.u-photo').toArray().map(img => img.attribs['src']), [config.url + photoSlug]);
        })
        .then(done)
        .catch(done);
    });
    
    var testAudio;
    it('post audio via micropub', function(done) {
        var formData = {
            h: 'entry',
            content: 'Test audio',
            audio: {
                value: fs.createReadStream('test/test.ogg'),
                options: {
                    filename: 'test.ogg',
                    contentType: 'audio/ogg'
                }
            }
        };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, formData: formData, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testAudio = e;
            assert(e.name === formData.content);
            assert(e.content.value === formData.content);
            var audioSlug = path.join(path.dirname(e.getPath()), 'test.ogg');
            var $ = cheerio.load(e.content.html);
            assert.deepEqual($('audio.u-audio').toArray().map(audio => audio.attribs['src']), [config.url + audioSlug]);
        })
        .then(done)
        .catch(done);
    });
    
    var testArticle;
    it('post article via micropub', function(done) {
        var form = { h: 'entry', name: 'Example Article', content: 'Here is some content.' };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testArticle = e;
            assert(e.name === form.name);
            assert(e.content.value === form.content);
        })
        .then(done)
        .catch(done);
    });

    var testArticle2;
    it('post article with html content', function(done) {
        var form = {
            h: 'entry',
            name: 'Article with HTML',
            'content[html]': '<p class="p-summary">Here is a <b>summary</b></p><p>Lorem <i>ipsum</i> dolor</p>'
        };
        var headers = { Authorization: 'bearer ' + token };
        post({ url: config.micropubUrl, form: form, headers: headers })
        .then(res => {
            assert(res.statusCode === 201);
            return site.get(res.headers.location);
        })
        .then(e => {
            testArticle2 = e;
            assert(e.name === form.name);
            assert(e.content.html === form['content[html]']);
            assert(e.content.value === util.stripHtml(form['content[html]']));
        })
        .then(done)
        .catch(done);
    });
});