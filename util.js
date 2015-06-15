var fs = require('fs');
var path = require('path');
var nodefn = require('when/node');

function mkdirRecursive(dir, callback) {
    fs.stat(dir, function (err, stats) {
        if (err && err.code == 'ENOENT') {
            mkdirRecursive(path.dirname(dir), function (err) {
                if (err)
                    callback(err);
                else
                    fs.mkdir(dir, callback);
            });
        } else if (!err && stats.isDirectory()) {
            callback(null);
        } else if (!err) {
            callback(new Error(dir + ' is not a directory'));
        } else {
            callback(err);
        }
    });
}

/* writeFile with recursive parent dir creation */
function writeFile(filename, data, options, callback) {
    mkdirRecursive(path.dirname(filename), function (err) {
        if (err)
            callback(err);
        else
            fs.writeFile(filename, data, options, callback);
    });
}

exports.writeFile = writeFile;
exports.writeFileP = nodefn.lift(writeFile);