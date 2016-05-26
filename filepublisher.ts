import fs = require('fs');
import pathlib = require('path');
import util = require('./util');
import Publisher from './publisher';

var readFile = util.promisify(fs.readFile);
var stat = util.promisify(fs.stat);
var unlink = util.promisify(fs.unlink);

class FilePublisher implements Publisher {
    root: string;

    constructor(config: {root: string}) {
        this.root = config.root;
    }

    private async readWithFallback(filepath, extensions): Promise<{Body: Buffer, ContentType: string}> {
        for (let ext of extensions) {
            try {
                var res = await readFile(filepath + ext);
                return {Body: res, ContentType: util.inferMimetype(filepath + ext)};
            } catch (err) {}
        }
        throw new Error(filepath + ' not found');
    }

    private async existsWithFallback(filepath, extensions): Promise<boolean> {
        for (let ext of extensions) {
            try {
                await stat(filepath + ext);
                return true;
            } catch (err) {}
        }
        return false;
    }

    put(path, obj, contentType): Promise<void> {
        if (contentType === 'text/html' && !path.endsWith('.html'))
            path = path + '.html';
        return util.writeFile(pathlib.join(this.root, path), obj);
    }
    
    async delete(path, contentType) {
        if (contentType === 'text/html' && !path.endsWith('.html'))
            path = path + '.html';
        await unlink(pathlib.join(this.root, path));
    }

    get(path): Promise<{Body: Buffer, ContentType: string}> {
        return this.readWithFallback(pathlib.join(this.root, path), ['', '.html']);
    }

    exists(path): Promise<boolean> {
        return this.existsWithFallback(pathlib.join(this.root, path), ['', '.html'])
    }

    list() {
        return util.walkDir(this.root)
        .then(paths => paths.map(p => pathlib.relative(this.root, p)))
        .then(paths => paths.filter(p => p !== 'log.txt'));
    }

    rollback(): Promise<void> {
        // NOOP
        return Promise.resolve(null);
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