///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import microformat = require('../microformat');
import Db = require('../db');

describe('db', function() {
    var db: Db;

    before(function(done) {
        db = new Db(':memory:');
        db.init().
            then(done).
            catch(done);
    });

    it('store/load entry', function (done) {
        var html =
            '<div class="h-entry">\
                <a class="u-url" href="/2015/8/28/1"></a>\
                <time class="dt-published" datetime="2015-08-28T08:00:00Z"></time>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content">Hello <b>World!</b></div>\
            </div>';
        var entry;
        microformat.getHEntry(html, 'http://testsite').
            then(function(e) {
                entry = e;
                return db.store(entry);
            }).
            then(function() {
                return db.get(entry.url);
            }).
            then(function(e) {
                assert.deepEqual(e, entry);
            }).
            then(done).
            catch(done);
    });

    it('store/load reply', function (done) {
        var html =
            '<div class="h-entry">\
                <a class="u-url" href="/2015/8/28/2"></a>\
                <time class="dt-published" datetime="2015-08-28T08:10:00Z"></time>\
                <a class="u-in-reply-to" href="/2015/8/28/1"></a>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content">Here is a <i>reply</i></div>\
            </div>';
        var entry;
        microformat.getHEntry(html, 'http://testsite').
            then(function(e) {
                entry = e;
                return db.store(entry);
            }).
            then(function() {
                return db.get(entry.url);
            }).
            then(function(e) {
                assert.deepEqual(e, entry);
            }).
            then(done).
            catch(done);
    });
    
    it('store categories', function(done) {
        var entry = new microformat.Entry();
        entry.url = 'http://testsite/2015/10/2/1';
        entry.published = new Date();
        entry.category = ['indieweb'];
        db.store(entry).
            then(() => db.getByCategory('indieweb')).
            then(entries => assert.deepEqual(entries, [entry])).
            then(() => db.getByCategory('bogus')).
            then(entries => assert.deepEqual(entries, [])).
            then(done).
            catch(done);
    });
});