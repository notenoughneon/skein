///<reference path="../typings/main.d.ts"/>
import assert = require('assert');
import fs = require('fs');
import microformat = require('../microformat');

describe('entry', function() {
    var orig_request;
    
    before(function() {
        orig_request = microformat.request;
    });
    
    after(function() {
        microformat.request = orig_request;
    });
    
    it('can be constructed with no args', function() {
        var entry = new microformat.Entry();
        assert.equal(entry.url, null);
        assert.equal(entry.replyTo, null);
        assert.deepEqual(entry.getChildren(), []);
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
    serializeEntry.replyTo = new microformat.Entry('http://testsite/2015/8/28/2');
    serializeEntry.addChild(new microformat.Entry('http://testsite/2015/8/28/3'));

    var serializeJson = '{"name":"Hello World!",\
"published":"2015-08-28T08:00:00.000Z",\
"content":{"value":"Hello World!","html":"Hello <b>World!</b>"},\
"summary":"Summary",\
"url":"http://testsite/2015/8/28/2",\
"author":{"name":"Test User","photo":null,"url":"http://testsite","uid":null},\
"category":["indieweb"],\
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
    
    it('can deserialize null values', function() {
        var json = '{"name":null,\
"published":null,\
"content":null,\
"url":"http://testsite/2015/10/6/1",\
"author":null,\
"category":[],\
"syndication":[],\
"replyTo":null,\
"likeOf":null,\
"repostOf":null,\
"children":[]}';
        var entry = microformat.Entry.deserialize(json);
        assert.equal(entry.name, null);
        assert.equal(entry.published, null);
        assert.equal(entry.content, null);
        assert.equal(entry.author, null);
    });

    it('err for no entry', function(done) {
       microformat.getEntry('<html></html>', 'http://testsite')
       .then(() => assert(false))
       .catch(err => done(err.message == 'No h-entry found' ? null : err));
    });

    it('err for multiple entries', function(done) {
       microformat.getEntry('<html><div class="h-entry"></div><div class="h-entry"></div></html>', 'http://testsite')
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
        microformat.getEntry(html, 'http://testsite').
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
        microformat.getEntry(html, 'http://testsite').
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
                    "replyTo":{
                        "name":null,
                        "published":null,
                        "content":null,
                        "summary":null,
                        "url":"http://testsite/2015/8/28/1",
                        "author":null,
                        "category":[],
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
                <div class="p-name e-content"><div class="p-summary">Summary</div> Hello <b>World!</b></div>\
            </div>';
        microformat.getEntry(html, 'http://testsite').
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
                    "replyTo":null,
                    "likeOf":null,
                    "repostOf":null,
                    "children":[]
                });
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
        microformat.getEntry(html, 'http://testsite').
            then(function(entry){
                assert.equal(entry.isArticle(), false);
            }).
            then(done).
            catch(done);
    });
    
    it('domain works', function() {
        assert.equal((new microformat.Entry('http://somesite.com/2015/1/2/3')).getDomain(), 'http://somesite.com');
        assert.equal((new microformat.Entry('https://somesite.com:8080/2015/1/2/3')).getDomain(), 'https://somesite.com:8080');
    });
    
    it('deduplicate works', function() {
        var entry = new microformat.Entry('http://testsite/2015/10/6/1');
        var c1 = new microformat.Entry('http://testsite/2015/10/6/2');
        var c2 = new microformat.Entry('http://testsite/2015/10/6/3');
        entry.addChild(c1);
        entry.addChild(c2);
        entry.addChild(c1);
        assert.deepEqual(entry.getChildren(), [c1,c2]);
    });
    
    it('getEntryFromUrl', function(done) {
        var pages = {
            'http://somesite/post': '<div class="h-entry">Test post</div>',
        };
        microformat.request = url => Promise.resolve({statusCode: 200, body: pages[url]});
        microformat.getEntryFromUrl('http://somesite/post')
        .then(e => {
            assert(e.name === 'Test post');
        })
        .then(done)
        .catch(done);
    });
    
    it('getEntryFromUrl 404', function(done) {
        microformat.request = url => Promise.resolve({statusCode: 404, body: ''});
        microformat.getEntryFromUrl('http://somesite/post')
       .then(() => assert(false))
       .catch(err => done(err.message == 'Server returned status 404' ? null : err));
    });

    it('authorship author-page by url', function(done) {
        var html = '<div class="h-entry"><a class="u-author" href="/author"></a></div>';
        microformat.getEntry(html, 'http://somesite/post')
        .then(e => {
            assert(e.author !== null);
            assert(e.author.url === 'http://somesite/author');
        })
        .then(done)
        .catch(done);
    });
        
    it('authorship author-page by rel-author', function(done) {
        var html = '<div class="h-entry"></div><a rel="author" href="/author"></a>';
        microformat.getEntry(html, 'http://somesite/post')
        .then(e => {
            assert(e.author !== null);
            assert(e.author.url === 'http://somesite/author');
        })
        .then(done)
        .catch(done);
    });
    
    it('authorship author-page url/uid', function(done) {
        var pages = {
            'http://somesite/post': '<div class="h-entry"><a class="u-author" href="/"></a></div>',
            'http://somesite/': '<div class="h-card"><a class="u-uid" href="/"><img src="me.jpg">Test User</a></div>'
        };
        microformat.request = url => Promise.resolve({statusCode: 200, body: pages[url]});
        microformat.getEntryFromUrl('http://somesite/post')
        .then(e => {
            assert(e.author !== null);
            assert(e.author.name === 'Test User');
            assert(e.author.photo === 'http://somesite/me.jpg');
        })
        .then(done)
        .catch(done);
    });
    
    it('authorship author-page rel-me', function(done) {
        var pages = {
            'http://somesite/post': '<div class="h-entry"><a class="u-author" href="/"></a></div>',
            'http://somesite/': '<a class="h-card" rel="me" href="/"><img src="me.jpg">Test User</a>'
        };
        microformat.request = url => Promise.resolve({statusCode: 200, body: pages[url]});
        microformat.getEntryFromUrl('http://somesite/post')
        .then(e => {
            assert(e.author !== null);
            assert(e.author.name === 'Test User');
            assert(e.author.photo === 'http://somesite/me.jpg');
        })
        .then(done)
        .catch(done);
    });
    
    it('authorship author-page url only', function(done) {
        var pages = {
            'http://somesite/post': '<div class="h-entry"><a class="u-author" href="/"></a></div>',
            'http://somesite/': '<a class="h-card" href="/"><img src="me.jpg">Test User</a>'
        };
        microformat.request = url => Promise.resolve({statusCode: 200, body: pages[url]});
        microformat.getEntryFromUrl('http://somesite/post')
        .then(e => {
            assert(e.author !== null);
            assert(e.author.name === 'Test User');
            assert(e.author.photo === 'http://somesite/me.jpg');
        })
        .then(done)
        .catch(done);
    });
    
    it('authorship author-page no match', function(done) {
        var pages = {
            'http://somesite/post': '<div class="h-entry"><a class="u-author" href="/"></a></div>',
            'http://somesite/': '<a class="h-card" href="/notme"><img src="me.jpg">Test User</a>'
        };
        microformat.request = url => Promise.resolve({statusCode: 200, body: pages[url]});
        microformat.getEntryFromUrl('http://somesite/post')
        .then(e => {
            assert(e.author !== null);
            assert(e.author.name === null);
            assert(e.author.photo === null);
        })
        .then(done)
        .catch(done);
    });
    
    it('authorship author-page 404', function(done) {
        var pages = {
            'http://somesite/post': '<div class="h-entry"><a class="u-author" href="/"></a></div>'
        };
        microformat.request = url => Promise.resolve(pages[url] ? {statusCode: 200, body: pages[url]} : {statusCode: 404, body: ''});
        microformat.getEntryFromUrl('http://somesite/post')
        .then(e => {
            assert(e.author !== null);
            assert(e.author.name === null);
            assert(e.author.photo === null);
        })
        .then(done)
        .catch(done);
    });
    
    it('filters non-cite from children', function(done) {
        var html = '<div class="h-entry">\
        <div class="h-cite"><a class="u-url" href="http://othersite/123"></a>a comment</div>\
        <div class="h-card"><a class="u-url" href="http://testsite"></a>a card</div>\
        </div>';
        microformat.getEntry(html, 'http://testsite')
        .then(e => {
            assert(e.getChildren().length === 1);
            assert(e.getChildren()[0].name === 'a comment');
        })
        .then(done)
        .catch(done);
    });
});
