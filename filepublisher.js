var fs = require('fs');
var pathlib = require('path');
var nodefn = require('when/node');
var util = require('./util');

function init(root) {
    return {
        put: function(path, obj, contentType) {
            if (contentType === 'text/html')
                path = path + '.html';
            return util.writeFile(pathlib.join(root, path), obj);
        },
        get: function(path) {
            return util.readWithFallback(pathlib.join(root, path), ['', '.html']);
        },
        exists: function(path) {
            return util.existsWithFallback(pathlib.join(root, path), ['', '.html'])
        },
        list: function() {
            return util.walkDir(root);
        }
    };
}

exports.init = init;