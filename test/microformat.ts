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
                <a class="p-author h-card" href="http://testsite">Test User</a>\
                <div class="p-name e-content">Hello <b>World!</b></div>\
            </div>';
        microformat.getHEntry(html, 'http://testsite').
            then(function(entry) {
                var expected =
                {
                    "name":"Hello World!",
                    "content":{"value":"Hello World!","html":"Hello <b>World!</b>"},
                    "url":"http://testsite/2015/8/28/1",
                    "author":{"name":"Test User","url":"http://testsite"}
                };
                assert.deepEqual(entry, expected);
            }).
            then(done).
            catch(done);
    });
});
