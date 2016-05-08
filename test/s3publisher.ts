import assert = require('assert');
import Publisher = require('../Publisher');
import S3Publisher = require('../s3publisher');


describe.skip('s3publisher', function() {
    var publisher: Publisher;
    
    before(function() {
        publisher = new S3Publisher({region: 'us-west-2', bucket: 'test.notenoughneon.com'});
    });
    
    it('list (empty)', function(done) {
        publisher.list()
        .then(res => {
            assert.deepEqual(res, []);
        })
        .then(done)
        .catch(done);
    });
    
    it('put', function(done) {
        publisher.put('hello.txt', 'Hello world', 'text/plain')
        .then(() => {
            return publisher.put('post', '<html><body>hi</body></html>', 'text/html');
        })
        .then(done)
        .catch(done);
    });
    
    it('list', function(done) {
        publisher.list()
        .then(res => {
            assert.deepEqual(res, ['hello.txt', 'post', 'post.html']);
        })
        .then(done)
        .catch(done);
    });
    
    it('exists', function(done) {
        publisher.exists('hello.txt')
        .then(res => {
            assert.equal(res, true);
            return publisher.exists('nope.txt');
        })
        .then(res => {
            assert.equal(res, false);
        })
        .then(done)
        .catch(done);
    });
    
    it('get', function(done) {
        publisher.get('hello.txt')
        .then(res => {
            assert.equal(res.ContentType, 'text/plain');
            assert.equal(res.Body, 'Hello world');
            return publisher.get('post');
        })
        .then(res => {
            assert.equal(res.ContentType, 'text/html');
            assert.equal(res.Body, '<html><body>hi</body></html>');
            return publisher.get('post.html');
        })
        .then(res => {
            assert.equal(res.ContentType, 'text/html');
            assert.equal(res.Body, '<html><body>hi</body></html>');
        })
        .then(done)
        .catch(done);
    });
    
    it('delete', function(done) {
        publisher.delete('hello.txt', 'text/plain')
        .then(() => {
            return publisher.exists('hello.txt');
        })
        .then(res => {
            assert.equal(res, false);
            return publisher.delete('post', 'text/html');
        })
        .then(() => {
            return publisher.exists('post');
        })
        .then(res => {
            assert.equal(res, false);
            return publisher.exists('post.html');
        })
        .then(res => {
            assert.equal(res, false);
        })
        .then(done)
        .catch(done);
    });
    
    var objects;
    
});