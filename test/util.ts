///<reference path="../typings/main.d.ts"/>
import assert = require('assert');
import util = require('../util');
import fs = require('fs');
import callbacks = require('when/callbacks');

describe('util', function() {
    describe('map', function() {
        var elts = [1, 2, 3];
        var f: (n) => Promise<number> = n => new Promise((res,rej) => res(n * n));
        var expected = [1, 4, 9];

        it('array of values', function(done) {
            util.map(elts, f)
            .then(res => assert.deepEqual(res, expected))
            .then(done);
        });

        it('array of promises', function(done) {
            var eltps = elts.map(elt => new Promise((res, rej) => res(elt)));
            util.map(eltps, f)
            .then(res => assert.deepEqual(res, expected))
            .then(done);
        });

        it('promise of array of values', function(done) {
            var pelts = new Promise((res,rej) => res(elts));
            util.map(pelts, f)
            .then(res => assert.deepEqual(res, expected))
            .then(done);
        });

        it('promise of array of promises', function(done) {
            var peltps = new Promise((res,rej) => res(elts.map(elt => new Promise((res, rej) => res(elt)))));
            util.map(peltps, f)
            .then(res => assert.deepEqual(res, expected))
            .then(done);
        });
    });

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
            var task1running = false;
            var task2running = false;
            var task1ran = false;
            var task2ran = false;
            Promise.all([
                m.lock()
                .then(release => {
                    task1running = true;
                    task1ran = true;
                    return util.delay(10)
                    .then(() => {
                        assert(!task2running);
                        task1running = false;
                        release();
                    });
                }),
                m.lock().
                then(release => {
                    assert(!task1running);
                    task2running = true;
                    task2ran = true;
                    return util.delay(10)
                    .then(() => {
                        task2running = false;
                        release();
                    });
                })
            ])
            .then(() => {
                assert(!task1running);
                assert(!task2running);
                assert(task1ran);
                assert(task2ran);
                done();
            })
            .catch(done);
        });
        it('double lock deadlocks', function(done) {
            var m = new util.Mutex();
            m.lock()
            .then(r => m.lock())
            .then(r => assert(false))
            .catch(done);
            util.delay(10)
            .then(done);
        });
        it('double release ok', function(done) {
            var release;
            var m = new util.Mutex();
            m.lock().
                then(r => release = r).
                then(() => release()).
                then(() => release());
            m.lock().
                then(r => done());
        });
    });
});