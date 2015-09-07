///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import microformat = require('../microformat');
import Db = require('../db');
import Site = require('../site');
import util = require('../util');

describe('site', function() {
    var site;
    before(function(done) {
        var config = JSON.parse(fs.readFileSync('test/testconfig.json').toString());
        var db = new Db(':memory:');
        db.init().
            then(done).
            catch(done);
        site = new Site(config, db);
    });

    it('can post a note', function(done) {
        var entry = new microformat.Entry();
        entry.url = 'http://localhost:8000/1';
        entry.name = 'Hello World!';
        entry.published = new Date('2015-08-28T08:00:00Z');
        entry.content = {"value":"Hello World!","html":"Hello <b>World!</b>"};
        entry.author = new microformat.Card();
        entry.author.name = 'Test User';
        entry.author.url = 'http://localhost:8000';
        site.publish(entry).
            then(() => site.db.get(entry.url)).
            then(e => assert.deepEqual(e, entry)).
            then(done).
            catch(done);
    });

    it.skip('can post a reply', function(done) {
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