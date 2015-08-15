var assert = require('assert');
var util = require('../util');

describe('chunk', function() {
    it('should return [] for (3, [])', function () {
        assert.deepEqual(util.chunk(3, []), []);
    });
    it('should return [[1,2,3],[4,5]] for (3, [1,2,3,4,5])', function () {
        assert.deepEqual(util.chunk(3, [1,2,3,4,5]), [[1,2,3],[4,5]]);
    })
});