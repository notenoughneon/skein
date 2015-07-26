var fs = require('fs');
var pathlib = require('path');
var nodefn = require('when/node');
var util = require('./util');


function readWithFallback(filepath, extensions) {
    return when.any(extensions.map(function (ext) {
        return nodefn.call(fs.readFile, filepath + ext).
            then(function(data) {
                return {Body: data, ContentType: util.inferMimetype(filepath + ext)};
            });
    }));
}

function existsWithFallback(filepath, extensions) {
    return when.any(extensions.map(function (ext) {
        return nodefn.call(fs.stat, filepath + ext);
    })).
        then(function() { return true; }).
        catch(function() { return false; });
}

function init(config) {
    return {
        put: function(path, obj, contentType) {
            if (contentType === 'text/html')
                path = path + '.html';
            return util.writeFile(pathlib.join(config.root, path), obj);
        },
        get: function(path) {
            return readWithFallback(pathlib.join(config.root, path), ['', '.html']);
        },
        exists: function(path) {
            return existsWithFallback(pathlib.join(config.root, path), ['', '.html'])
        },
        list: function() {
            return util.walkDir(root);
        }
    };
}

exports.init = init;