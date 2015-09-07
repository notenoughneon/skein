///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import util = require('../util');
import fs = require('fs');

describe('writeFile', function() {
    before(function() {
        util.tryDelete('test/foo/bar/baz.txt');
        util.tryDelete('test/foo/bar');
        util.tryDelete('test/foo');
    });
    it('should work', function(done) {
        util.writeFile('test/foo/bar/baz.txt', 'hello world').
            then(function () {
                assert.equal(fs.readFileSync('test/foo/bar/baz.txt'), 'hello world');
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