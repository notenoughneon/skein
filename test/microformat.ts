///<reference path="../typings/main.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import microformat = require('../microformat');

describe('entry', function() {
    it('can be constructed with no args', function() {
        var entry = new microformat.Entry();
        assert.equal(entry.url, null);
        assert.deepEqual(entry.replyTo, []);
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
        var entry = microformat._buildEntry(mf2);
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
    serializeEntry.summary = "Summary";
    serializeEntry.category = ['indieweb'];
    serializeEntry.author = new microformat.Card();
    serializeEntry.author.name = 'Test User';
    serializeEntry.author.url = 'http://testsite';
    serializeEntry.replyTo = [new microformat.Entry('http://testsite/2015/8/28/2')];
    serializeEntry.children = [new microformat.Entry('http://testsite/2015/8/28/3')];

    var serializeJson = '{"name":"Hello World!",\
"published":"2015-08-28T08:00:00.000Z",\
"content":{"value":"Hello World!","html":"Hello <b>World!</b>"},\
"summary":"Summary",\
"url":"http://testsite/2015/8/28/2",\
"author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},\
"category":["indieweb"],\
"syndication":[],\
"replyTo":["http://testsite/2015/8/28/2"],\
"likeOf":[],\
"repostOf":[],\
"children":["http://testsite/2015/8/28/3"]}';

    it('can be serialized', function() {
        assert.equal(serializeEntry.serialize(), serializeJson);
    });

    it('can be deserialized', function() {
        assert.deepEqual(microformat.Entry.deserialize(serializeJson), serializeEntry);
    });
    
    it('can deserialize null values', function() {
        var json = '{"name":null,\
"published":null,\
"content":null,\
"url":"http://testsite/2015/10/6/1",\
"author":null,\
"category":[],\
"syndication":[],\
"replyTo":[],\
"likeOf":[],\
"repostOf":[],\
"children":[]}';
        var entry = microformat.Entry.deserialize(json);
        assert.equal(entry.name, null);
        assert.equal(entry.published, null);
        assert.equal(entry.content, null);
        assert.equal(entry.author, null);
    });

    it('err for no entry', function(done) {
       microformat.getHEntry('<html></html>', 'http://testsite')
       .then(() => assert(false))
       .catch(err => done(err.message == 'No h-entry found' ? null : err));
    });

    it('err for multiple entries', function(done) {
       microformat.getHEntry('<html><div class="h-entry"></div><div class="h-entry"></div></html>', 'http://testsite')
       .then(() => assert(false))
       .catch(err => done(err.message === 'Multiple h-entries found' ? null : err));
    });

    it('can load a note', function(done) {
        var html =
            '<div class="h-entry">\
                <a class="u-url" href="/2015/8/28/1"></a>\
                <time class="dt-published" datetime="2015-08-28T08:00:00Z"></time>\
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <span class="p-category">indieweb</span>\
                <div class="p-name e-content">Hello <b>World!</b></div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry) {
                assert.deepEqual(entry, {
                    "name":"Hello World!",
                    "published":new Date("2015-08-28T08:00:00Z"),
                    "content":{"value":"Hello World!","html":"Hello <b>World!</b>"},
                    "summary":null,
                    "url":"http://testsite/2015/8/28/1",
                    "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                    "category":["indieweb"],
                    "syndication":[],
                    "replyTo":[],
                    "likeOf":[],
                    "repostOf":[],
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
                    "summary":null,
                    "url":"http://testsite/2015/8/28/2",
                    "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                    "category":[],
                    "syndication":[],
                    "replyTo":[{
                        "name":null,
                        "published":null,
                        "content":null,
                        "summary":null,
                        "url":"http://testsite/2015/8/28/1",
                        "author":null,
                        "category":[],
                        "syndication":[],
                        "replyTo":[],
                        "likeOf":[],
                        "repostOf":[],
                        "children":[]
                    }],
                    "likeOf":[],
                    "repostOf":[],
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
                <div class="p-name e-content"><div class="p-summary">Summary</div> Hello <b>World!</b></div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry) {
                assert.deepEqual(entry, {
                    "name":"First Post",
                    "published":new Date("2015-08-28T08:00:00Z"),
                    "content":{"value":"Summary Hello World!","html":"<div class=\"p-summary\">Summary</div> Hello <b>World!</b>"},
                    "summary":"Summary",
                    "url":"http://testsite/2015/8/28/1",
                    "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                    "category":[],
                    "syndication":[],
                    "replyTo":[],
                    "likeOf":[],
                    "repostOf":[],
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
                    "summary":null,
                    "url":"http://testsite/2015/8/28/1",
                    "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                    "category":[],
                    "syndication":[],
                    "replyTo":[],
                    "likeOf":[],
                    "repostOf":[],
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
                        "summary":null,
                        "url":"http://testsite/2015/8/28/1",
                        "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                        "category":[],
                        "syndication":[],
                        "replyTo":[{
                            "name":null,
                            "published":null,
                            "content":null,
                            "summary":null,
                            "url":"http://othersite/somepost",
                            "author":null,
                            "category":[],
                            "syndication":[],
                            "replyTo":[],
                            "likeOf":[],
                            "repostOf":[],
                            "children":[]
                        }],
                        "likeOf":[],
                        "repostOf":[],
                        "children":[
                            {
                                "name":"Here is a reply",
                                "published":new Date("2015-08-28T08:10:00Z"),
                                "content":{"value":"Here is a reply","html":"Here is a <i>reply</i>"},
                                "summary":null,
                                "url":"http://testsite/2015/8/28/2",
                                "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                                "category":[],
                                "syndication":[],
                                "replyTo":[{
                                    "name":null,
                                    "published":null,
                                    "content":null,
                                    "summary":null,
                                    "url":"http://testsite/2015/8/28/1",
                                    "author":null,
                                    "category":[],
                                    "syndication":[],
                                    "replyTo":[],
                                    "likeOf":[],
                                    "repostOf":[],
                                    "children":[]
                                }],
                                "likeOf":[],
                                "repostOf":[],
                                "children":[]
                            }
                        ]
                    },
                    {
                        "name":null,
                        "published":null,
                        "content":null,
                        "summary":null,
                        "url":"http://othersite/somepost",
                        "author":null,
                        "category":[],
                        "syndication":[],
                        "replyTo":[],
                        "likeOf":[],
                        "repostOf":[],
                        "children":[]
                    },
                    {
                        "name":"Here is a reply",
                        "published":new Date("2015-08-28T08:10:00Z"),
                        "content":{"value":"Here is a reply","html":"Here is a <i>reply</i>"},
                        "summary":null,
                        "url":"http://testsite/2015/8/28/2",
                        "author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},
                        "category":[],
                        "syndication":[],
                        "replyTo":[{
                            "name":null,
                            "published":null,
                            "content":null,
                            "summary":null,
                            "url":"http://testsite/2015/8/28/1",
                            "author":null,
                            "category":[],
                            "syndication":[],
                            "replyTo":[],
                            "likeOf":[],
                            "repostOf":[],
                            "children":[]
                        }],
                        "likeOf":[],
                        "repostOf":[],
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
    it('domain works', function() {
        assert.equal((new microformat.Entry('http://somesite.com/2015/1/2/3')).domain(), 'http://somesite.com');
        assert.equal((new microformat.Entry('https://somesite.com:8080/2015/1/2/3')).domain(), 'https://somesite.com:8080');
    });
    it('deduplicate works', function() {
        var entry = new microformat.Entry('http://testsite/2015/10/6/1');
        var c1 = new microformat.Entry('http://testsite/2015/10/6/2');
        var c2 = new microformat.Entry('http://testsite/2015/10/6/3');
        entry.children.push(c1);
        entry.children.push(c2);
        entry.children.push(c1);
        entry.deduplicate();
        assert.deepEqual(entry.children, [c1,c2]);
    });
    
    it('discover authorship by rel-author', function(done) {
        var html = '<div class="h-entry"></div><a rel="author" href="/author"></a>';
        microformat.getHEntry(html, 'http://somesite')
        .then(e => {
            assert(e.author !== null);
            assert(e.author.url === 'http://somesite/author');
        })
        .then(done)
        .catch(done);
    });
    
    it('discover authorship by url', function(done) {
        var pages = {
            'http://somesite/post': '<div class="h-entry"><a class="u-author" href="/"></a></div>',
            'http://somesite/': '<a class="h-card u-uid u-url" href="/"><img class="u-photo" src="me.jpg">Test User</a>'
        };
        microformat.request = url => Promise.resolve({statusCode: 200, body: pages[url]});
        microformat.getHEntryFromUrl('http://somesite/post')
        .then(e => {
            assert(e.author !== null);
            assert(e.author.name === 'Test User');
            assert(e.author.photo === 'http://somesite/me.jpg');
        })
        .then(done)
        .catch(done);
    });
    
    it('filters non-cite from children', function(done) {
        var html = '<div class="h-entry">\
        <div class="h-cite"><a class="u-url" href="http://othersite/123"></a>a comment</div>\
        <div class="h-card"><a class="u-url" href="http://testsite"></a>a card</div>\
        </div>';
        microformat.getHEntry(html, 'http://testsite')
        .then(e => {
            assert(e.children.length === 1);
            assert(e.children[0].name === 'a comment');
        })
        .then(done)
        .catch(done);
    });
});
