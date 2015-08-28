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
});
