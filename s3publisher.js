var AWS = require('aws-sdk');
var nodefn = require('when/node');
var pathlib = require('path');

// S3 doesn't like leading slashes
function normalizePath(p) {
    return p.split('/').filter(function(elt) { return elt != ''; }).join('/');
}

function config(region, bucket) {
    var s3 = new AWS.S3({region: region});
    var putObject = nodefn.lift(s3.putObject.bind(s3));
    var getObject = nodefn.lift(s3.getObject.bind(s3));
    var listObjects = nodefn.lift(s3.listObjects.bind(s3));
    return {
        put: function(path, obj, contentType) {
            var params = {Bucket: bucket, Key: normalizePath(path), Body: obj};
            if (contentType !== undefined)
                params.ContentType = contentType;
            else {
                //try to guess from file extension
                switch (pathlib.extname(path).toLowerCase()) {
                    case '.jpg':
                    case '.jpeg':
                        params.ContentType = 'image/jpeg';
                        break;
                    case '.gif':
                        params.ContentType = 'image/gif';
                        break;
                    case '.png':
                        params.ContentType = 'image/png';
                        break;
                    case '.mp3':
                        params.ContentType = 'audio/mpeg';
                        break;
                    case '.ogg':
                        params.ContentType = 'audio/ogg';
                        break;
                }
            }
            return putObject(params);
        },
        get: function(path) {
            return getObject({Bucket: bucket, Key: normalizePath(path)}).
                then(function(data) {
                    return data.Body;
                });
        },
        list: function() {
            // FIXME: handle truncated results
            return listObjects({Bucket: bucket}).
                then(function(data) {
                    return data.Contents.map(function(o) {
                       return o.Key;
                    });
                })
        }
    };
}

exports.config = config;