///<reference path="typings/tsd.d.ts"/>
import fs = require('fs');
import pathlib = require('path');
import child_process = require('child_process');
import when = require('when');
import nodefn = require('when/node');
import util = require('./util');
import Publisher = require('./publisher');

var exec = nodefn.lift(child_process.exec);

class GitPublisher implements Publisher {
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

    begin() {
        // FIXME: this will need to acquire lock
        return when(false);
    }

    rollback() {
        var gitcheckout = 'git -C ' + this.config.root + ' checkout .';
        return exec(gitcheckout).
            then(() => true);
    }

    commit(msg) {
        var gitcommit = 'git -C ' + this.config.root + ' commit -a -m \'' + msg + '\'';
        var gitpush = 'git -C ' + this.config.root + ' push';
        return exec(gitcommit).
            then(() => exec(gitpush)).
            then(() => true);
    }
}

export = GitPublisher;