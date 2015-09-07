///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import microformat = require('../microformat');
import Db = require('../db');
import Site = require('../site');
import util = require('../util');

describe('site', function() {
    var site;

    var author = new microformat.Card();
    author.name = 'Test User';
    author.url = 'http://localhost:8000';

    var entry1 = new microformat.Entry();
    entry1.url = 'http://localhost:8000/1';
    entry1.name = 'Hello World!';
    entry1.published = new Date('2015-08-28T08:00:00Z');
    entry1.content = {"value":"Hello World!","html":"Hello <b>World!</b>"};
    entry1.author = author;

    var entry2 = new microformat.Entry();
    entry2.url = 'http://localhost:8000/2';
    entry2.replyTo = entry1;
    entry2.name = 'This is a reply';
    entry2.published = new Date('2015-08-28T08:00:00Z');
    entry2.content = {"value":"This is a reply","html":"This is a reply"};
    entry2.author = new microformat.Card();
    entry2.author = author;

    before(function(done) {
        var config = JSON.parse(fs.readFileSync('test/testconfig.json').toString());
        var db = new Db(':memory:');
        db.init().
            then(done).
            catch(done);
        site = new Site(config, db);
    });

    it('can post a note', function(done) {
        site.publish(entry1).
            then(() => site.db.get(entry1.url)).
            then(e => assert.deepEqual(e, entry1)).
            then(done).
            catch(done);
    });

    it.skip('can post a reply', function(done) {
        site.publish(entry2).
            then(() => site.db.get(entry2.url)).
            then(e => assert.deepEqual(e, entry2)).
            then(done).
            catch(done);
    })
});