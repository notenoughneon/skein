var AWS = require('aws-sdk');
var nodefn = require('when/node');

// S3 doesn't like leading slashes
function normalizePath(p) {
    return p.split('/').filter(function(elt) { return elt != ''; }).join('/');
}

function init(config) {
    var s3 = new AWS.S3({region: config.region});
    var putObject = nodefn.lift(s3.putObject.bind(s3));
    var getObject = nodefn.lift(s3.getObject.bind(s3));
    var headObject = nodefn.lift(s3.headObject.bind(s3));
    var listObjects = nodefn.lift(s3.listObjects.bind(s3));
    return {
        put: function(path, obj, contentType) {
            var params = {Bucket: config.bucket, Key: normalizePath(path), Body: obj};
            params.ContentType = contentType !== undefined ? contentType : inferMimetype(path);
            return putObject(params);
        },
        get: function(path) {
            return getObject({Bucket: config.bucket, Key: normalizePath(path)});
        },
        exists: function(path) {
            return headObject({Bucket: config.bucket, Key: normalizePath(path)}).
                then(function() {
                    return true;
                }).
                catch(function() {
                    return false;
                });
        },
        list: function() {
            // FIXME: handle truncated results
            return listObjects({Bucket: config.bucket}).
                then(function(data) {
                    return data.Contents.map(function(o) {
                       return o.Key;
                    });
                })
        }
    };
}

exports.init = init;