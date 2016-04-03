///<reference path="typings/main.d.ts"/>
import fs = require('fs');
import pathlib = require('path');
import when = require('when');
import nodefn = require('when/node');
var guard = require('when/guard');
import util = require('./util');
import Publisher = require('./publisher');

var readFile = nodefn.lift(fs.readFile);
var stat = nodefn.lift(fs.stat);

class FilePublisher implements Publisher {
    root: string;

    constructor(config: {root: string}) {
        this.root = config.root;
    }

    private readWithFallback(filepath, extensions): Promise<{Body: Buffer, ContentType: string}> {
        return when.any(extensions.map(function (ext) {
            return readFile(filepath + ext).
                then(function (data) {
                    return {Body: data, ContentType: util.inferMimetype(filepath + ext)};
                });
        }));
    }

    private existsWithFallback(filepath, extensions): Promise<boolean> {
        return when.any(extensions.map(function (ext) {
            return stat(filepath + ext);
        })).
            then(function () {
                return true;
            }).
            catch(function () {
                return false;
            });
    }

    put(path, obj, contentType): Promise<void> {
        if (contentType === 'text/html')
            path = path + '.html';
        return util.writeFile(pathlib.join(this.root, path), obj);
    }
    
    async delete(path, contentType) {
        if (contentType === 'text/html')
            path = path + '.html';
        await nodefn.call(fs.unlink, pathlib.join(this.root, path));
    }

    get(path): Promise<{Body: Buffer, ContentType: string}> {
        return this.readWithFallback(pathlib.join(this.root, path), ['', '.html']);
    }

    exists(path): Promise<boolean> {
        return this.existsWithFallback(pathlib.join(this.root, path), ['', '.html'])
    }

    list() {
        return util.walkDir(this.root).
            then(paths => paths.map(p => pathlib.relative(this.root, p)));
    }

    rollback(): Promise<void> {
        // NOOP
        return new Promise(null);
    }

    commit(msg): Promise<void> {
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