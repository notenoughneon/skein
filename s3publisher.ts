var AWS = require('aws-sdk');
import nodefn = require('when/node');
var guard = require('when/guard');
var debug = require('debug')('s3publisher');
import util = require('./util');
import Publisher from './publisher';

// S3 doesn't like leading slashes
function normalizePath(p) {
    return p.split('/').filter(function (elt) {
        return elt != '';
    }).join('/');
}

class S3Publisher implements Publisher {
    bucket: string;
    putObject: any;
    deleteObject: any;
    getObject: any;
    headObject: any;
    listObjects: any;

    constructor(config: {region: string, bucket: string}) {
        this.bucket = config.bucket;
        var s3 = new AWS.S3({region: config.region});
        this.putObject = guard(guard.n(10), nodefn.lift(s3.putObject.bind(s3)));
        this.deleteObject = guard(guard.n(10), nodefn.lift(s3.deleteObject.bind(s3)));
        this.getObject = guard(guard.n(10), nodefn.lift(s3.getObject.bind(s3)));
        this.headObject = guard(guard.n(10), nodefn.lift(s3.headObject.bind(s3)));
        this.listObjects = guard(guard.n(1), nodefn.lift(s3.listObjects.bind(s3)));
    }

    async put(path, obj, contentType): Promise<void> {
        var params = {
            Bucket: this.bucket,
            Key: normalizePath(path),
            Body: obj,
            ContentType: contentType !== undefined ? contentType : util.inferMimetype(path)
        };
        await this.putObject(params);
        debug('put ' + params.Key);
        // S3 doesn't infer '.html' on filenames,
        // so we have to put both 'path' and 'path.html'
        if (params.ContentType === 'text/html' && !/\.html$/.test(params.Key)) {
            params.Key = params.Key + '.html';
            await this.putObject(params);
            debug('put ' + params.Key);
        }
    }
    
    async delete(path, contentType): Promise<void> {
        await this.deleteObject({Bucket: this.bucket, Key: path});
        debug('delete ' + path);
        if (contentType == 'text/html' && !/\.html$/.test(path)) {
            await this.deleteObject({Bucket: this.bucket, Key: path + '.html'});
            debug('delete ' + path + '.html');
        }
    }

    async get(path): Promise<{Body: Buffer, ContentType: string}> {
        var res = await this.getObject({Bucket: this.bucket, Key: normalizePath(path)});
        debug('get ' + path);
        return res;
    }

    async exists(path): Promise<boolean> {
        debug('exists ' + path);
        try {
            await this.headObject({Bucket: this.bucket, Key: normalizePath(path)});
            return true;
        } catch (err) {
            return false;
        }
    }

    async list(): Promise<string[]> {
        var keys = [];
        var parms: {Bucket: string, MaxKeys?: number, Marker?: string} = {Bucket: this.bucket};
        debug('list');
        do {
            if (keys.length > 0)
                parms.Marker = keys[keys.length - 1];
            var data = await this.listObjects(parms);
            debug('Got ' + data.Contents.length + ' entries');
            keys = keys.concat(data.Contents.map(o => o.Key));
        } while (data.IsTruncated);
        return keys;
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
            then(() => null);
    }
}

export = S3Publisher;