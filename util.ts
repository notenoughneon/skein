import fs = require('fs');
import path = require('path');
import url = require('url');
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
    var apply = elts => Promise.all(elts.map(elt => typeof elt.then === 'function' ? elt.then(f) : f(elt)));
    return typeof elts.then === 'function' ? elts.then(apply) : apply(elts);
}

export function _try<T>(f: () => T): Promise<T>;
export function _try<T>(f: (arg: any) => T, arg: any): Promise<T>;
export function _try<T>(f: (arg: any, arg2: any) => T, arg: any, arg2: any): Promise<T>;
export function _try<T>(f: (arg: any, arg2: any, arg3: any) => T, arg: any, arg2: any, arg3: any): Promise<T>;
export function _try<T>(f: (arg: any, arg2: any, arg3: any, arg4: any) => T, arg: any, arg2: any, arg3: any, arg4: any): Promise<T>;
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

export var get = promisify(Request.get);
export var post = promisify(Request.post);

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
export function writeFile(filename: string, data: string | NodeJS.ReadableStream) {
    return _try(mkdirRecursive, path.dirname(filename)).
        then(() => {
            if (typeof data !== "string" && data.readable)
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
    var seen: Set<T> = new Set();
    for (let elt of elts) {
        if (!seen.has(elt)) {
            seen.add(elt);
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

export function range(start: number, end: number) {
    return [...function* () {
        var i = start;
        while (i <= end)
            yield i++;
    } ()];
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
        case '.txt':
            return 'text/plain';
        case '.js':
            return 'application/javascript';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.gif':
            return 'image/gif';
        case '.png':
            return 'image/png';
        case '.svg':
            return 'image/svg+xml';
        case '.mp3':
            return 'audio/mpeg';
        case '.ogg':
            return 'audio/ogg';
        default:
            return 'application/octet-stream';
    }
}

export function truncate(s, len) {
    if (s.length > len)
        return s.substr(0, len) + '...';
    return s;
}

export function collapse(s) {
    return s.replace(/\s+/g, ' ');
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

export async function getWebmentionEndpoint(target) {
    var res = await get(target);
    if (res.statusCode !== 200)
        throw new Error(target + ' returned status ' + res.statusCode);
    if (res.headers.link !== undefined) {
        for (let header of res.headers.link.split(',')) {
            let match = header.match(/<([^>]+)>;\s*rel=([^" ]+|"[^"]+")/);
            if (match !== null) {
                let rel = match[2].match(/"?([^"]+)"?/);
                if (rel !== null && rel[1].split(' ').some(r => r === 'webmention'))
                    return url.resolve(target, match[1]);
            }
        }
    }
    var mf = await parser.getAsync({html: res.body, baseUrl: target});
    if (mf.rels['webmention'] !== undefined)
        return mf.rels['webmention'][0];
    else if (mf.rels['http://webmention.org/'] !== undefined)
        return mf.rels['http://webmention.org/'][0];
    else
        throw new Error('No webmention endpoint');
}

export async function sendWebmention(source, target, opts?): Promise<string> {
    var endpoint = await getWebmentionEndpoint(target);
    var form = {source:source, target:target};
    if (opts) {
        for (let key of Object.keys(opts)) {
            form[key] = opts[key];
        }
    }
    var res = await post({uri:endpoint, form:form});
    var status = res.statusCode;
    if (!(status >= 200 && status <= 299))
        throw new Error(endpoint + ' returned status ' + status);
    return res.body;
}

export function getPage(permalink) {
    return get({uri: permalink}).
        then(function (res) {
            var status = res.statusCode;
            if (status >= 200 && status <= 299)
                return res.body;
            throw new Error('Got statusCode ' + status);
        })
}

export function delay(ms: number) {
    return new Promise<void>((res, rej) => setTimeout(res, ms));
}

export class Semaphore {
    private tasks: (() => void)[] = [];
    capacity: number;

    constructor(capacity: number) {
        this.capacity = capacity;
    }

    private sched() {
        if (this.capacity > 0 && this.tasks.length > 0) {
            this.capacity--;
            this.tasks.shift()();
        }
    }

    public lock() {
        return new Promise<() => void>((res, rej) => {
            var task = () => {
                var released = false;
                res(() => {
                    if (!released) {
                        released = true;
                        this.capacity++;
                        this.sched();
                    }
                });
            };
            this.tasks.push(task);
            process.nextTick(this.sched.bind(this));
        });
    }
}

export class Mutex extends Semaphore {
    constructor() {
        super(1);
    }
}