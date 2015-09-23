///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import util = require('../util');
import fs = require('fs');

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
            m.lock(release => {
                task1running = true;
                setTimeout(() => {
                    assert(!task2running);
                    task1running = false;
                    release();
                }, 10);
            });
            m.lock(release => {
                assert(!task1running);
                task2running = true;
                setTimeout(() => {
                    task2running = false;
                    release();
                }, 50);
            });
            m.lock(release => {
                assert(!task1running);
                assert(!task2running);
                done();
            });
            assert(!task1running);
            assert(!task2running);
        });
    });
});