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

    private readWithFallback(filepath, extensions): when.Promise<{Body: Buffer, ContentType: string}> {
        return when.any(extensions.map(function (ext) {
            return nodefn.call(fs.readFile, filepath + ext).
                then(function (data) {
                    return {Body: data, ContentType: util.inferMimetype(filepath + ext)};
                });
        }));
    }

    private existsWithFallback(filepath, extensions): when.Promise<boolean> {
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

    put(path, obj, contentType): when.Promise<{}> {
        if (contentType === 'text/html')
            path = path + '.html';
        return util.writeFile(pathlib.join(this.config.root, path), obj);
    }

    get(path): when.Promise<{Body: Buffer, ContentType: string}> {
        return this.readWithFallback(pathlib.join(this.config.root, path), ['', '.html']);
    }

    exists(path): when.Promise<boolean> {
        return this.existsWithFallback(pathlib.join(this.config.root, path), ['', '.html'])
    }

    list() {
        return util.walkDir(this.config.root).
            then(paths => paths.map(p => pathlib.relative(this.config.root, p)));
    }

    rollback(): when.Promise<{}> {
        // NOOP
        return when(undefined);
    }

    commit(msg): when.Promise<{}> {
        return this.exists('log.txt').
            then(exists => exists ? this.get('log.txt').then(obj => obj.Body.toString()) : '').
            then(text => {
                var log = text + new Date().toLocaleString() + ' ' + msg + '\n';
                return this.put('log.txt', log, 'text/plain');
            }).
            then(() => undefined);
    }
}

export = FilePublisher;