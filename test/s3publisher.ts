import assert = require('assert');
import S3Publisher = require('../s3publisher');
import util = require('../util');


describe.skip('s3publisher', function() {
    var publisher: S3Publisher;
    
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
    
    it('commit', function(done) {
        publisher.commit('commit msg 1')
        .then(() => publisher.commit('commit msg 2'))
        .then(() => publisher.get('log.txt'))
        .then(res => {
            assert.equal(res.ContentType, 'text/plain');
            assert(res.Body.toString().indexOf('commit msg 1') !== -1);
            assert(res.Body.toString().indexOf('commit msg 2') !== -1);
        })
        .then(done)
        .catch(done);
    });
    
    it('delete', async function(done) {
        try {
            await publisher.delete('hello.txt', 'text/plain');
            assert.equal(await publisher.exists('hello.txt'), false);

            await publisher.delete('post', 'text/html');
            assert.equal(await publisher.exists('post'), false);
            assert.equal(await publisher.exists('post.html'), false);

            await publisher.delete('log.txt', 'text/plain');
            assert.equal(await publisher.exists('log.txt'), false);

            done();
        } catch (err) {
            done(err);
        }
    });
    
    describe('stress tests', function() {
        var objects: string[];
        it('put', function(done) {
            this.timeout(0);
            objects = util.range(1, 100).map(i => 'post' + i);
            objects.sort();
            Promise.all(objects.map(o => publisher.put(o, 'stress test', 'text/plain')))
            .then(() => done())
            .catch(done);
        });
        
        it('list', function(done) {
            this.timeout(0);
            publisher.list()
            .then(res => {
                res.sort();
                assert.deepEqual(res, objects);
            })
            .then(done)
            .catch(done);
        });
        
        it('get', function(done) {
            this.timeout(0);
            Promise.all(objects.map(o => 
                publisher.get(o)
                .then(res => {
                    assert.equal(res.ContentType, 'text/plain');
                    assert.equal(res.Body, 'stress test');
                })
            ))
            .then(() => done())
            .catch(done);
        });
        
        it('delete', function(done) {
            this.timeout(0);
            Promise.all(objects.map(o => publisher.delete(o, 'text/plain')))
            .then(() => publisher.list())
            .then(res => {
                assert.deepEqual(res, []);
            })
            .then(done)
            .catch(done);
        });
        
    });

});