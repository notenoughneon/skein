var assert = require('assert');
var fs = require('fs');
var microformat = require('../microformat');
var site = require('../site').init(JSON.parse(fs.readFileSync('test/testconfig.json')),'test/testindex.db');

describe('site', function() {
    it('can post a note', function(done) {
        var url = 'http://localhost:8000/firstpost';
        var content = 'hello world';
        site.publish(new microformat.Entry({h: 'entry', url: url, content: content})).
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