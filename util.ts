///<reference path="typings/main.d.ts"/>
import fs = require('fs');
import path = require('path');
import util = require('util');
import cheerio = require('cheerio');
import Request = require('request');
var parser = require('microformat-node');

export function promisify<T>(f: (cb: (err: NodeJS.ErrnoException, res: T) => void) => void): () => Promise<T>;
export function promisify<A,T>(f: (arg: A, cb: (err: NodeJS.ErrnoException, res: T) => void) => void): (arg: A) => Promise<T>;
export function promisify<A,A2,T>(f: (arg: A, arg2: A2, cb: (err: NodeJS.ErrnoException, res: T) => void) => void): (arg: A, arg2: A2) => Promise<T>;
export function promisify<A,A2,A3,T>(f: (arg: A, arg2: A2, arg3: A3, cb: (err: NodeJS.ErrnoException, res: T) => void) => void): (arg: A, arg2: A2, arg3: A3) => Promise<T>;
export function promisify<A,A2,A3,A4,T>(f: (arg: A, arg2: A2, arg3: A3, arg4: A4, cb: (err: NodeJS.ErrnoException, res: T) => void) => void): (arg: A, arg2: A2, arg3: A3, arg4: A4) => Promise<T>;

export function promisify(f) {
    return function() {
        return new Promise((resolve, reject) => {
            var args = Array.prototype.slice.call(arguments);
            args.push((err, result) => err !== null ? reject(err) : resolve(result));
            f.apply(null, args);
        });
    }
}

export function map<T,U>(elts: PromiseLike<PromiseLike<T>[]>, f: (T) => U | PromiseLike<U>): Promise<U[]>;
export function map<T,U>(elts: PromiseLike<T[]>, f: (T) => U | PromiseLike<U>): Promise<U[]>;
export function map<T,U>(elts: PromiseLike<T>[], f: (T) => U | PromiseLike<U>): Promise<U[]>;
export function map<T,U>(elts: T[], f: (T) => U | PromiseLike<U>): Promise<U[]>;
export function map(elts, f) {
    var apply = elts => Promise.all(elts.map(elt => (typeof elt.then === 'function') ? elt.then(f) : f(elt)));
    return (typeof elts.then) === 'function' ? elts.then(apply) : apply(elts);
}

export function _try<T>(f: () => T): Promise<T>;
export function _try<T>(f: (arg: any) => T): Promise<T>;
export function _try<T>(f: (arg: any, arg2: any) => T): Promise<T>;
export function _try(f) {
    return new Promise((res, rej) => {
        try {
            var args = Array.prototype.slice.call(arguments);
            args.shift();
            res(f.apply(null, args));
        } catch (err) {
            rej(err);
        }
    });
}

var stat = promisify(fs.stat);
var readdir = promisify(fs.readdir);
var _writeFile = promisify(fs.writeFile);

var request = promisify(Request.get);

export function dump(data) {
    console.log(util.inspect(data, {depth: null}));
}

export function tryDelete(p) {
    try {
        fs.unlinkSync(p);
    } catch (e) {}
}

function mkdirRecursive(dir) {
    try {
        var stats = fs.statSync(dir);
    } catch (err) {
        if (err.code == 'ENOENT') {
            mkdirRecursive(path.dirname(dir));
            fs.mkdirSync(dir);
            return;
        } else
            throw err;
    }
    if (!stats.isDirectory())
        throw(new Error(dir + ' is not a directory'));
}

/* writeFile with recursive parent dir creation */
export function writeFile(filename, data) {
    return _try(mkdirRecursive, path.dirname(filename)).
        then(() => {
            if (data.readable)
                data.pipe(fs.createWriteStream(filename));
            else
                return _writeFile(filename, data);
        });
}

export function flatten<T>(arrarr: T[][]) {
    if (arrarr.length == 0)
        return [];
    return arrarr.reduce(function(a, b) { return a.concat(b); });
}

export function unique<T>(elts: T[]) {
    var tmp: T[] = [];
    var seen = {};
    for (let elt of elts) {
        if (!seen[elt]) {
            seen[elt] = true;
            tmp.push(elt);
        }
    }
    return tmp;
}

export function chunk(size, arr) {
    var chunks = [];
    var b = 0;
    var c = arr.slice(b, b + size);
    while (c.length > 0)
    {
        chunks.push(c);
        b += size;
        c = arr.slice(b, b + size);
    }
    return chunks;
}

/* walk directory recursively and return list of files */
export async function walkDir(d) {
    var stats = await stat(d);
    if (stats.isDirectory()) {
        var files = [];
        for (let file of await readdir(d)) {
            files = files.concat(await walkDir(path.join(d, file)));
        }
        return files;
    } else {
        return [d];
    }
}

export function copy(src, dst) {
    return fs.createReadStream(src).pipe(fs.createWriteStream(dst));
}

export function inferMimetype(filename) {
    switch (path.extname(filename).toLowerCase()) {
        case '.html':
            return 'text/html';
        case '.css':
            return 'text/css';
        case '.js':
            return 'application/javascript';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.gif':
            return 'image/gif';
        case '.png':
            return 'image/png';
        case '.mp3':
            return 'audio/mpeg';
        case '.ogg':
            return 'audio/ogg';

        default:
            return 'application/octet-stream';
    }
}

export function kebabCase(str) {
    str = str.toLowerCase();
    str = str.replace(/[^a-z0-9 ]/g, ' ');
    str = str.replace(/ +/g, '-');
    return str;
}

export function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;');
}

var urlRe = /(https?:\/\/[\w-]+(\.[\w-]+)*(:[0-9]+)?(\/[\w\.\/%+?=&,;@#~()-]*)?)/ig;

function replacer(match, p1) {
    // un-html-escape &'s in url
    var fixedUrl = p1.replace('&amp;', '&');
    return '<a href="' + fixedUrl + '">' + p1 + '</a>';
}

export function autoLink(str) {
    return str.replace(urlRe, replacer);
}

export function getLinks(html) {
    var $ = cheerio.load(html);
    return $('a').toArray().map(a => a.attribs['href']);
}

export function stripHtml(html) {
    var $ = cheerio.load(html);
    return $.root().text();
}

export function isMentionOf(html, permalink) {
    return getLinks(html).some(function(l){return l === permalink;});
}

function getWebmentionEndpoint(target) {
    return request(target).
        then(function (res) {
            return parser.getAsync({html: res[1], baseUrl: target});
        }).
        then(function (mf) {
            if (mf.rels['webmention'] !== undefined)
                return mf.rels['webmention'][0];
            else if (mf.rels['http://webmention.org/'] !== undefined)
                return mf.rels['http://webmention.org/'][0];
            else
                throw new Error('No webmention endpoint');
        });
}

export function sendWebmention(source, target) {
    return getWebmentionEndpoint(target).
        then(function (endpoint) {
            return request({uri:endpoint, method:'POST', form:{source:source, target:target}}).
                then(function (res) {
                    var status = res[0].statusCode;
                    if (status !== 200 && status !== 202)
                        throw new Error('Webmention endpoint returned status ' + status);
                    return;
                });
        });
}

export function getPage(permalink) {
    return request({uri: permalink}).
        then(function (res) {
            var status = res[0].statusCode;
            if (status >= 200 && status <= 299)
                return res[1];
            throw new Error('Got statusCode ' + status);
        })
}

export class Mutex {
    private tasks: (() => void)[] = [];

    public lock(callback: (release: () => void) => void) {
        var task = callback.bind(null, () => {
            this.tasks.shift();
            if (this.tasks.length > 0)
                this.tasks[0]();
        });
        this.tasks.push(task);
        if (this.tasks.length == 1)
            process.nextTick(this.tasks[0]);
    }
}