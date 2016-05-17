///<reference path="../typings/main.d.ts"/>
import assert = require('assert');
import Request = require('request');
import util = require('../util');

describe('webmention', function() {
    describe('mock tests', function() {
        var orig_get;
        var orig_post;
    
        before(function() {
            orig_get = util.get;
            orig_post = util.post;
        });
        
        after(function() {
            util.get = orig_get;
            util.post = orig_post;
        });
        
        it('getWebmentionEndpoint', async function(done) {
            try {
                var get_res = {
                    'http://brid.gy/publish/twitter': '<html><head><link rel="webmention" href="http://brid.gy/publish/webmention"></head></html>'
                };
                util.get = (url: string) => Promise.resolve(get_res[url] ?
                    {statusCode: 200, body: get_res[url], headers: {}} : {statusCode: 404, body: ''});
                var endpoint = await util.getWebmentionEndpoint('http://brid.gy/publish/twitter');
                assert.equal(endpoint, 'http://brid.gy/publish/webmention');
                done();
            } catch (err) {
                done(err);
            }
        });

        it('sendWebmention arguments', async function(done) {
            try {
                var get_res = {
                    'http://brid.gy/publish/twitter': '<html><head><link rel="webmention" href="http://brid.gy/publish/webmention"></head></html>'
                };
                var post_res = {
                    'http://brid.gy/publish/webmention': '{"url": "http://twitter.com/12345"}'
                };
                var args;
                util.get = (url: string) => Promise.resolve(get_res[url] ?
                    {statusCode: 200, body: get_res[url], headers: {}} : {statusCode: 404, body: ''});
                util.post = (opts: Request.Options) => {
                    args = opts.form;
                    return Promise.resolve(post_res[opts.uri] ?
                    {statusCode: 201, body: post_res[opts.uri]} : {statusCode: 404, body: ''});
                };
                var res = JSON.parse(await util.sendWebmention('http://somesite/somepost', 'http://brid.gy/publish/twitter'));
                assert.deepEqual(args, {source: 'http://somesite/somepost', target: 'http://brid.gy/publish/twitter'});
                done();
            } catch (err) {
                done(err);
            }
        });
        
        it('sendWebmention result', async function(done) {
            try {
                var get_res = {
                    'http://brid.gy/publish/twitter': '<html><head><link rel="webmention" href="http://brid.gy/publish/webmention"></head></html>'
                };
                var post_res = {
                    'http://brid.gy/publish/webmention': '{"url": "http://twitter.com/12345"}'
                };
                util.get = (url: string) => Promise.resolve(get_res[url] ?
                    {statusCode: 200, body: get_res[url], headers: {}} : {statusCode: 404, body: ''});
                util.post = (opts: Request.Options) => Promise.resolve(post_res[opts.uri] ?
                    {statusCode: 201, body: post_res[opts.uri]} : {statusCode: 404, body: ''});
                var res = JSON.parse(await util.sendWebmention('http://somesite/somepost', 'http://brid.gy/publish/twitter'));
                assert.equal(res.url, 'http://twitter.com/12345');
                done();
            } catch (err) {
                done(err);
            }
        });
        
    });
    
    describe.skip('webmention.rocks discovery', function() {
        it('Test 1', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/1')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/1/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 2', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/2')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/2/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 3', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/3')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/3/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 4', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/4')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/4/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 5', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/5')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/5/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 6', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/6')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/6/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 7', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/7')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/7/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 8', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/8')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/8/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 9', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/9')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/9/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 10', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/10')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/10/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 11', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/11')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/11/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 12', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/12')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/12/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 13', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/13')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/13/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 14', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/14')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/14/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 15', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/15')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/15'))
            .then(done)
            .catch(done);
        });
        
        it('Test 16', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/16')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/16/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 17', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/17')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/17/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 18', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/18')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/18/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 19', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/19')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/19/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 20', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/20')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/20/webmention'))
            .then(done)
            .catch(done);
        });
        
        it('Test 21', function(done) {
            util.getWebmentionEndpoint('https://webmention.rocks/test/21')
            .then(res => assert.equal(res, 'https://webmention.rocks/test/21/webmention?query=yes'))
            .then(done)
            .catch(done);
        });

    });

});