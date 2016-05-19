import assert = require('assert');
import child_process = require('child_process');
import GitPublisher = require('../gitpublisher');
import util = require('../util');

var exec = util.promisify(child_process.exec);

var root = 'build/test/git-static';

describe.skip('gitpublisher', function() {
    var publisher: GitPublisher;
    
    before(function(done) {
        publisher = new GitPublisher({root: root, push: false});
        exec('rm -rf ' + root)
        .then(() => exec('mkdir ' + root))
        .then(() => exec('git init ' + root))
        .then(() => done())
        .catch(done);
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
            assert.deepEqual(res, ['hello.txt', 'post.html']);
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
        publisher.commit('initial commit')
        .then(() => publisher.commit('nothing changed (should not commit)'))
        .then(() => publisher.put('hello2.txt', 'hello world 2', 'text/plain'))
        .then(() => publisher.commit('added hello2.txt'))
        .then(done)
        .catch(done);
    });
    
    it('commit msg opt injection', function(done) {
        publisher.put('hello3.txt', 'hello world', 'text/plain')
        .then(() => publisher.commit('test --dry-run'))
        .then(done)
        .catch(done);
    });
    
    it('commit msg quote escape', function(done) {
        publisher.put('hello4.txt', 'hello world', 'text/plain')
        .then(() => publisher.commit('test" --dry-run "'))
        .then(done)
        .catch(done);
    });    

    it('commit msg shell escape', function(done) {
        publisher.put('hello5.txt', 'hello world', 'text/plain')
        .then(() => publisher.commit('test; touch foo.txt'))
        .then(done)
        .catch(done);
    });

    it('commit msg multiline', function(done) {
        publisher.put('hello6.txt', 'hello world', 'text/plain')
        .then(() => publisher.commit('test\nmulti line'))
        .then(done)
        .catch(done);
    });
    
    it('delete', async function(done) {
        try {
            await publisher.delete('hello.txt', 'text/plain');
            assert.equal(await publisher.exists('hello.txt'), false);

            await publisher.delete('hello2.txt', 'text/plain');
            assert.equal(await publisher.exists('hello2.txt'), false);

            await publisher.delete('post', 'text/html');
            assert.equal(await publisher.exists('post.html'), false);

            await publisher.commit('delete content');
            
            done();
        } catch (err) {
            done(err);
        }
    });
    
    describe.skip('stress tests', function() {
        var objects: string[];
        it('put', function(done) {
            this.timeout(0);
            objects = util.range(1, 100).map(i => 'post' + i + '.txt');
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