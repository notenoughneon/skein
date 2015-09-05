///<reference path="typings/tsd.d.ts"/>
import fs = require('fs');
import pathlib = require('path');
import when = require('when');
import nodefn = require('when/node');
import util = require('./util');
import Publisher = require('./publisher');

class FilePublisher implements Publisher {
    config: any;

    constructor(config) {
        this.config = config;
    }

    private readWithFallback(filepath, extensions) {
        return when.any(extensions.map(function (ext) {
            return nodefn.call(fs.readFile, filepath + ext).
                then(function (data) {
                    return {Body: data, ContentType: util.inferMimetype(filepath + ext)};
                });
        }));
    }

    private existsWithFallback(filepath, extensions) {
        return when.any(extensions.map(function (ext) {
            return nodefn.call(fs.stat, filepath + ext);
        })).
            then(function () {
                return true;
            }).
            catch(function () {
                return false;
            });
    }

    put(path, obj, contentType) {
        if (contentType === 'text/html')
            path = path + '.html';
        return util.writeFile(pathlib.join(this.config.root, path), obj);
    }

    get(path) {
        return this.readWithFallback(pathlib.join(this.config.root, path), ['', '.html']);
    }

    exists(path) {
        return this.existsWithFallback(pathlib.join(this.config.root, path), ['', '.html'])
    }

    list() {
        return util.walkDir(this.config.root).
            then(function (paths) {
                return paths.map(function (p) {
                    return pathlib.relative(this.config.root, p);
                });
            })
    }

    begin(): when.Promise<boolean> {
        // NOOP
        return when(false);
    }

    rollback(): when.Promise<boolean> {
        // NOOP
        return when(false);
    }

    commit(msg): when.Promise<boolean> {
        // NOOP
        return when(false);
    }
}

export = FilePublisher;