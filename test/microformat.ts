///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import microformat = require('../microformat');

describe('entry', function() {
    it('can be constructed from mf2', function() {
        var url = 'http://localhost:8000/firstpost';
        var content = 'hello world';
        var mf2 = {
            "type": ["h-entry"],
            "properties": {
                "url": [url],
                "content": [
                    {
                        "value": content,
                        "html": content
                    }
                ]
            }
        };
        var entry = new microformat.Entry(mf2);
        assert.equal(url, entry.url);
        assert.equal(content, entry.content.value);
        assert.equal(content, entry.content.html);
    });

    it('can be constructed from url string', function() {
        var url = 'http://localhost:8000/firstpost';
        var entry = new microformat.Entry(url);
        assert.equal(url, entry.url);
    });

    it('can be constructed from micropub', function() {
        var url = 'http://localhost:8000/firstpost';
        var content = 'hello world';
        var entry = new microformat.Entry({h: 'entry', url: url, content: content});
        assert.equal(url, entry.url);
        assert.equal(content, entry.content.value);
        assert.equal(content, entry.content.html);
    });

    it('can load a note', function(done) {
        var html =
            '<div class="h-entry">\
                <a class="u-url" href="/2015/8/28/1"></a>\
                <time class="dt-published" datetime="2015-08-28T08:00:00Z"></time>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content">Hello <b>World!</b></div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry) {
                assert.deepEqual(entry, {
                    "name":"Hello World!",
                    "published":new Date("2015-08-28T08:00:00Z"),
                    "content":{"value":"Hello World!","html":"Hello <b>World!</b>"},
                    "photo":null,
                    "url":"http://testsite/2015/8/28/1",
                    "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                    "syndication":[],
                    "replyTo":null,
                    "likeOf":null,
                    "repostOf":null,
                    "children":[]
                });
            }).
            then(done).
            catch(done);
    });

    it('can load a reply', function(done) {
        var html =
            '<div class="h-entry">\
                <a class="u-url" href="/2015/8/28/2"></a>\
                <time class="dt-published" datetime="2015-08-28T08:10:00Z"></time>\
                <a class="u-in-reply-to" href="/2015/8/28/1"></a>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content">Here is a <i>reply</i></div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry) {
                var json = JSON.stringify(entry);
                assert.deepEqual(entry, {
                    "name":"Here is a reply",
                    "published":new Date("2015-08-28T08:10:00Z"),
                    "content":{"value":"Here is a reply","html":"Here is a <i>reply</i>"},
                    "photo":null,
                    "url":"http://testsite/2015/8/28/2",
                    "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                    "syndication":[],
                    "replyTo":{
                        "name":null,
                        "published":null,
                        "content":null,
                        "photo":null,
                        "url":"http://testsite/2015/8/28/1",
                        "author":null,
                        "syndication":[],
                        "replyTo":null,
                        "likeOf":null,
                        "repostOf":null,
                        "children":[]
                    },
                    "likeOf":null,
                    "repostOf":null,
                    "children":[]}
                );
            }).
            then(done).
            catch(done);
    });

    it('can load an article', function(done) {
        var html =
            '<div class="h-entry">\
                <h1 class="p-name">First Post</h1>\
                <a class="u-url" href="/2015/8/28/1"></a>\
                <time class="dt-published" datetime="2015-08-28T08:00:00Z"></time>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content">Hello <b>World!</b></div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry) {
                assert.deepEqual(entry, {
                    "name":"First Post",
                    "published":new Date("2015-08-28T08:00:00Z"),
                    "content":{"value":"Hello World!","html":"Hello <b>World!</b>"},
                    "photo":null,
                    "url":"http://testsite/2015/8/28/1",
                    "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                    "syndication":[],
                    "replyTo":null,
                    "likeOf":null,
                    "repostOf":null,
                    "children":[]
                });
            }).
            then(done).
            catch(done);
    });
});
