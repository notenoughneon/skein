///<reference path="typings/tsd.d.ts"/>
import fs = require('fs');
import pathlib = require('path');
var when = require('when');
import nodefn = require('when/node');
import util = require('./util');


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

export function init(config) {
    return {
        config: config,
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
            return util.walkDir(config.root).
                then(function(paths) {
                    return paths.map(function (p) {
                        return pathlib.relative(config.root, p);
                    });
                })
        }
    };
}
