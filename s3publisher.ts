///<reference path="typings/tsd.d.ts"/>
var AWS = require('aws-sdk');
import when = require('when');
import nodefn = require('when/node');
import util = require('./util');
import Publisher = require('./publisher');

// S3 doesn't like leading slashes
function normalizePath(p) {
    return p.split('/').filter(function (elt) {
        return elt != '';
    }).join('/');
}

class S3Publisher implements Publisher {
    config: any;
    putObject: any;
    getObject: any;
    headObject: any;
    listObjects: any;

    constructor(config) {
        this.config = config;
        var s3 = new AWS.S3({region: config.region});
        this.putObject = nodefn.lift(s3.putObject.bind(s3));
        this.getObject = nodefn.lift(s3.getObject.bind(s3));
        this.headObject = nodefn.lift(s3.headObject.bind(s3));
        this.listObjects = nodefn.lift(s3.listObjects.bind(s3));
    }

    put(path, obj, contentType): when.Promise<void> {
        var params = {
            Bucket: this.config.bucket,
            Key: normalizePath(path),
            Body: obj,
            ContentType: contentType !== undefined ? contentType : util.inferMimetype(path)
        };
        return this.putObject(params).
            then(function () {
                // S3 doesn't infer '.html' on filenames,
                // so we have to put both 'path' and 'path.html'
                if (params.ContentType === 'text/html' && !/\.html$/.test(params.Key)) {
                    params.Key = params.Key + '.html';
                    return this.putObject(params);
                }
            });
    }

    get(path): when.Promise<Buffer> {
        return this.getObject({Bucket: this.config.bucket, Key: normalizePath(path)});
    }

    exists(path): when.Promise<boolean> {
        return this.headObject({Bucket: this.config.bucket, Key: normalizePath(path)}).
            then(function () {
                return true;
            }).
            catch(function () {
                return false;
            });
    }

    list(): when.Promise<string[]> {
        // FIXME: handle truncated results
        return this.listObjects({Bucket: this.config.bucket}).
            then(function (data) {
                return data.Contents.map(function (o) {
                    return o.Key;
                });
            })
    }

    //TODO: transactions could be implemented using s3 versioning
    begin(): when.Promise<boolean> {
        // NOOP
        return when(false);
    }

    rollback(): when.Promise<boolean> {
        // NOOP
        return when(false);
    }

    commit(msg): when.Promise<boolean> {
        // NOOP
        return when(false);
    }
}

export = S3Publisher;