///<reference path="../typings/main.d.ts"/>
import assert = require('assert');
import util = require('../util');
import fs = require('fs');
import callbacks = require('when/callbacks');

describe('util', function() {
    describe('writeFile', function() {
        before(function() {
            util.tryDelete('build/test/foo/bar/baz.txt');
            util.tryDelete('build/test/foo/bar');
            util.tryDelete('build/test/foo');
        });
        it('should work', function(done) {
            util.writeFile('build/test/foo/bar/baz.txt', 'hello world').
                then(function () {
                    assert.equal(fs.readFileSync('build/test/foo/bar/baz.txt'), 'hello world');
                }).
                then(done).
                catch(done);
        }) ;
    });

    describe('walkDir', () => {
        it('should work', done => {
            util.walkDir('skel').
            then(elts => {
                assert.deepEqual(elts, [
                    'skel/author.png',
                    'skel/css/blog.css',
                    'skel/css/bootstrap.min.css',
                    'skel/js/blog.js',
                    'skel/js/bootstrap.min.js',
                    'skel/js/jquery.min.js'
                ]);
            }).
            then(done).
            catch(done);
        });
    });

    describe('flatten', function() {
        it('should return [] for ([])', function() {
            assert.deepEqual(util.flatten([]), []);
        });
        it('should return [] for ([[]])', function() {
            assert.deepEqual(util.flatten([[]]), []);
        });
        it('should return [1,2] for ([[1,2]])', function() {
            assert.deepEqual(util.flatten([[1,2]]), [1,2]);
        });
        it('should return [1,2,3] for ([[1,2],[3]])', function() {
            assert.deepEqual(util.flatten([[1,2],[3]]), [1,2,3]);
        });
    });

    describe('unique', function() {
        it('should return [] for ([])', function() {
            assert.deepEqual(util.unique([]), []);
        });
        it('should return [1,2,3] for ([1,2,3])', function() {
            assert.deepEqual(util.unique([1,2,3]), [1,2,3]);
        });
        it('should return [1,2,3] for ([1,2,1,3,3])', function() {
            assert.deepEqual(util.unique([1,2,1,3,3]), [1,2,3]);
        });
    });

    describe('chunk', function() {
        it('should return [] for (3, [])', function () {
            assert.deepEqual(util.chunk(3, []), []);
        });
        it('should return [[1,2,3],[4,5]] for (3, [1,2,3,4,5])', function () {
            assert.deepEqual(util.chunk(3, [1,2,3,4,5]), [[1,2,3],[4,5]]);
        })
    });

    describe('getLinks', function() {
        it('works on no links', function() {
            assert.deepEqual(util.getLinks('<b>hello</b>'), []);
        });
        it('works on single link', function() {
            assert.deepEqual(util.getLinks('<a href="foo/bar">hi</a>'), ['foo/bar']);
        });
        it('works on multiple links', function() {
            assert.deepEqual(util.getLinks('<div><a href="foo/bar">hi</a></div><a href="baz">there</a>'),
                ['foo/bar', 'baz']);
        });
    });

    describe('mutex', function() {
        it('tasks do not overlap', function(done) {
            var m = new util.Mutex();
            var lock = callbacks.lift(m.lock.bind(m));
            var task1running = false;
            var task2running = false;
            lock().then(release => {
                task1running = true;
                setTimeout(() => {
                    assert(!task2running);
                    task1running = false;
                    release();
                }, 10);
            });
            lock().then(release => {
                assert(!task1running);
                task2running = true;
                setTimeout(() => {
                    task2running = false;
                    release();
                }, 50);
            });
            lock().then(release => {
                assert(!task1running);
                assert(!task2running);
                done();
            });
            assert(!task1running);
            assert(!task2running);
        });
        it('double release ok', function(done) {
            var release;
            var m = new util.Mutex();
            var lock = callbacks.lift(m.lock.bind(m));
            lock().
                then(r => release = r).
                then(() => release()).
                then(() => release());
            lock().
                then(r => done());
        });
    });
});