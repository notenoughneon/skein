///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import microformat = require('../microformat');
var Site = require('../site');
var site = new Site(JSON.parse(fs.readFileSync('test/testconfig.json').toString()),'test/testindex.db');

describe.skip('site', function() {
    it('can post a note', function(done) {
        var url = 'http://localhost:8000/firstpost';
        var content = 'hello world';
        var entry = new microformat.Entry({h: 'entry', url: url, content: content});
        entry.author = [new microformat.Card(
            {
                url: site.config.url,
                name: site.config.author.name,
                photo: site.config.author.photo
            })];
        site.publish(entry).
            then(function() {
                return site.get(url);
            }).
            then(function(e) {
                assert.equal(e.url[0], url);
                assert.equal(e.content[0].value, content);
            }).
            then(done).
            catch(done);
    });

    it('can post a reply', function(done) {
        var url = 'http://localhost:8000/firstreply';
        var replyTo = 'http://localhost:8000/firstpost';
        var content = 'hello this is a reply';
        site.publish(new microformat.Entry({h: 'entry', url: url, 'in-reply-to': replyTo, content: content})).
            then(function() {
                return site.get(url);
            }).
            then(function(e) {
                assert.equal(e.url[0], url);
                assert.equal(e.content[0].value, content);
                assert.equal(e.replyTo[0], replyTo);
            }).
            then(done).
            catch(done);
    })
});