var fs = require('fs');
var path = require('path');
var util = require('util');
var when = require('when');
var nodefn = require('when/node');

var readFile = nodefn.lift(fs.readFile);
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

function readWithFallback(filepath, extensions) {
    return when.any(extensions.map(function (ext) {
        return readFile(filepath + ext);
    }));
}

function copy(src, dst) {
    return fs.createReadStream(src).pipe(fs.createWriteStream(dst));
}

exports.dump = dump;
exports.flatten = flatten;
exports.writeFile = writeFile;
exports.walkDir = walkDir;
exports.readWithFallback = readWithFallback;
exports.copy = copy;