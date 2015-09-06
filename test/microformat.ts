///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import microformat = require('../microformat');

describe('entry', function() {
    it('can be constructed with no args', function() {
        var entry = new microformat.Entry();
        assert.equal(entry.url, null);
        assert.equal(entry.replyTo, null);
        assert.deepEqual(entry.children, []);
    });

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

    var serializeEntry = new microformat.Entry();
    serializeEntry.url = 'http://testsite/2015/8/28/2';
    serializeEntry.name = 'Hello World!';
    serializeEntry.published = new Date('2015-08-28T08:00:00Z');
    serializeEntry.content = {"value":"Hello World!","html":"Hello <b>World!</b>"};
    serializeEntry.author = new microformat.Card();
    serializeEntry.author.name = 'Test User';
    serializeEntry.author.url = 'http://testsite';
    serializeEntry.replyTo = new microformat.Entry('http://testsite/2015/8/28/2');
    serializeEntry.children = [new microformat.Entry('http://testsite/2015/8/28/3')];

    var serializeJson = '{"name":"Hello World!",\
"published":"2015-08-28T08:00:00.000Z",\
"content":{"value":"Hello World!","html":"Hello <b>World!</b>"},\
"url":"http://testsite/2015/8/28/2",\
"author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},\
"syndication":[],\
"replyTo":"http://testsite/2015/8/28/2",\
"likeOf":null,\
"repostOf":null,\
"children":["http://testsite/2015/8/28/3"]}';

    it('can be serialized', function() {
        assert.equal(serializeEntry.serialize(), serializeJson);
    });

    it('can be deserialized', function() {
        assert.deepEqual(microformat.Entry.deserialize(serializeJson), serializeEntry);
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
                assert.deepEqual(entry, {
                    "name":"Here is a reply",
                    "published":new Date("2015-08-28T08:10:00Z"),
                    "content":{"value":"Here is a reply","html":"Here is a <i>reply</i>"},
                    "url":"http://testsite/2015/8/28/2",
                    "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                    "syndication":[],
                    "replyTo":{
                        "name":null,
                        "published":null,
                        "content":null,
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

    it('flatten method works on simple note', function(done) {
        var html =
            '<div class="h-entry">\
                <a class="u-url" href="/2015/8/28/1"></a>\
                <time class="dt-published" datetime="2015-08-28T08:00:00Z"></time>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content">Hello <b>World!</b></div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry) {
                assert.deepEqual(entry.flatten(), [{
                    "name":"Hello World!",
                    "published":new Date("2015-08-28T08:00:00Z"),
                    "content":{"value":"Hello World!","html":"Hello <b>World!</b>"},
                    "url":"http://testsite/2015/8/28/1",
                    "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                    "syndication":[],
                    "replyTo":null,
                    "likeOf":null,
                    "repostOf":null,
                    "children":[]
                }]);
            }).
            then(done).
            catch(done);
    });

    it('flatten method works on note with reply', function(done) {
        var html =
            '<div class="h-entry">\
                <a class="u-url" href="/2015/8/28/1"></a>\
                <time class="dt-published" datetime="2015-08-28T08:00:00Z"></time>\
                <a class="u-in-reply-to" href="http://othersite/somepost"></a>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content">Hello <b>World!</b></div>\
                <div class="h-cite">\
                    <a class="u-url" href="/2015/8/28/2"></a>\
                    <time class="dt-published" datetime="2015-08-28T08:10:00Z"></time>\
                    <a class="u-in-reply-to" href="/2015/8/28/1"></a>\
                    <a class="p-author h-card" href="http://testsite">Test User</a>\
                    <div class="p-name e-content">Here is a <i>reply</i></div>\
                </div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry) {
                var flat = entry.flatten();
                assert.deepEqual(flat, [
                    {
                        "name":"Hello World!",
                        "published":new Date("2015-08-28T08:00:00Z"),
                        "content":{"value":"Hello World!","html":"Hello <b>World!</b>"},
                        "url":"http://testsite/2015/8/28/1",
                        "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                        "syndication":[],
                        "replyTo":{
                            "name":null,
                            "published":null,
                            "content":null,
                            "url":"http://othersite/somepost",
                            "author":null,
                            "syndication":[],
                            "replyTo":null,
                            "likeOf":null,
                            "repostOf":null,
                            "children":[]
                        },
                        "likeOf":null,
                        "repostOf":null,
                        "children":[
                            {
                                "name":"Here is a reply",
                                "published":new Date("2015-08-28T08:10:00Z"),
                                "content":{"value":"Here is a reply","html":"Here is a <i>reply</i>"},
                                "url":"http://testsite/2015/8/28/2",
                                "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                                "syndication":[],
                                "replyTo":{
                                    "name":null,
                                    "published":null,
                                    "content":null,
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
                                "children":[]
                            }
                        ]
                    },
                    {
                        "name":null,
                        "published":null,
                        "content":null,
                        "url":"http://othersite/somepost",
                        "author":null,
                        "syndication":[],
                        "replyTo":null,
                        "likeOf":null,
                        "repostOf":null,
                        "children":[]
                    },
                    {
                        "name":"Here is a reply",
                        "published":new Date("2015-08-28T08:10:00Z"),
                        "content":{"value":"Here is a reply","html":"Here is a <i>reply</i>"},
                        "url":"http://testsite/2015/8/28/2",
                        "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                        "syndication":[],
                        "replyTo":{
                            "name":null,
                            "published":null,
                            "content":null,
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
                        "children":[]
                    }
                ]);
            }).
            then(done).
            catch(done);
    });
    it('getPhotos works', function(done) {
        var html =
            '<div class="h-entry">\
                <a class="u-url" href="/2015/8/28/1"></a>\
                <time class="dt-published" datetime="2015-08-28T08:00:00Z"></time>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content">Hello <b>World!</b><img class="u-photo" src="photo.jpg"/></div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry){
                assert.deepEqual(entry.getPhotos(), ['http://testsite/photo.jpg']);
            }).
            then(done).
            catch(done);
    });
    it('isArticle works (photo without caption)', function(done) {
        var html =
            '<div class="h-entry">\
                <a class="u-url" href="/2015/8/28/1"></a>\
                <time class="dt-published" datetime="2015-08-28T08:00:00Z"></time>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content"><img class="u-photo" src="photo.jpg"/></div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry){
                assert.equal(entry.isArticle(), false);
            }).
            then(done).
            catch(done);
    });
});
