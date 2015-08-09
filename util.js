var fs = require('fs');
var path = require('path');
var util = require('util');
var when = require('when');
var nodefn = require('when/node');
var cheerio = require('cheerio');
var request = require('request');
var parser = require('microformat-node');

var readdir = nodefn.lift(fs.readdir);
var stat = nodefn.lift(fs.stat);

function dump(data) {
    console.log(util.inspect(data, {depth: null}));
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
function writeFile(filename, data, options) {
    return when.try(mkdirRecursive, path.dirname(filename)).
        then(nodefn.lift(fs.writeFile, filename, data, options));
}

/* flatten an array of arrays */
function flatten(arrarr) {
    if (arrarr.length == 0)
        return [];
    return arrarr.reduce(function(a, b) { return a.concat(b); });
}

function chunk(size, arr) {
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
function walkDir(d) {
    return stat(d).
        then(function(stats){
            if (stats.isDirectory())
                return readdir(d).
                    then(function (files) {
                        return when.map(files, function (file) {
                            return walkDir(path.join(d, file));
                        }).
                            then(flatten);
                    });
            else
                return [d];
        });
}

function copy(src, dst) {
    return fs.createReadStream(src).pipe(fs.createWriteStream(dst));
}

function inferMimetype(filename) {
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
            break;
        case '.gif':
            return 'image/gif';
            break;
        case '.png':
            return 'image/png';
            break;
        case '.mp3':
            return 'audio/mpeg';
            break;
        case '.ogg':
            return 'audio/ogg';
            break;

        default:
            return 'application/octet-stream';
    }
}

function kebabCase(str) {
    str = str.toLowerCase();
    str = str.replace(/[^a-z0-9 ]/g, ' ');
    str = str.replace(/ +/g, '-');
    return str;
}

function escapeHtml(str) {
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

function autoLink(str) {
    return str.replace(urlRe, replacer);
}

function getLinks(html) {
    var $ = cheerio.load(html);
    return $('a').toArray().map(function(a){return a.attribs.href;});
}

function isMentionOf(html, permalink) {
    return getLinks(html).some(function(l){return l === permalink;});
}

function getWebmentionEndpoint(target) {
    return nodefn.call(request, target).
        then(function (res) {
            return nodefn.call(parser.parseHtml, res[1], {baseUrl: target});
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

function sendWebmention(source, target) {
    return getWebmentionEndpoint(target).
        then(function (endpoint) {
            return nodefn.call(request, {uri:endpoint, method:'POST', form:{source:source, target:target}}).
                then(function (res) {
                    var status = res[0].statusCode;
                    if (status !== 200 && status !== 202)
                        throw new Error('Webmention endpoint returned status ' + status);
                    return;
                });
        });
}

function getPage(permalink) {
    return nodefn.call(request, {uri: permalink}).
        then(function (res) {
            var status = res[0].statusCode;
            if (status >= 200 && status <= 299)
                return res[1];
            throw new Error('Got statusCode ' + status);
        })
}


exports.dump = dump;
exports.flatten = flatten;
exports.chunk = chunk;
exports.writeFile = writeFile;
exports.walkDir = walkDir;
exports.copy = copy;
exports.inferMimetype = inferMimetype;
exports.kebabCase = kebabCase;
exports.escapeHtml = escapeHtml;
exports.autoLink = autoLink;
exports.getLinks = getLinks;
exports.isMentionOf = isMentionOf;
exports.sendWebmention = sendWebmention;
exports.getPage = getPage;