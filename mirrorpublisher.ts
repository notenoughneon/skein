import util = require('./util');
import Publisher = require('./publisher');
import S3Publisher = require('./s3publisher');
import FilePublisher = require('./filepublisher');
import GitPublisher = require('./gitpublisher');
var debug = require('debug')('mirroredpublisher');

class MirrorPublisher implements Publisher {    
    publishers: Publisher[];
    
    constructor() {
    }
    
    async put(path: string, obj: string | NodeJS.ReadableStream, contentType?: string) {
        await Promise.all(this.publishers.map(p => p.put(path, obj, contentType)));
    }
    
    async delete(path: string, contentType: string) {
        await Promise.all(this.publishers.map(p => p.delete(path, contentType)));
    }

    get(path: string) {
        return this.publishers[0].get(path);
    }
    
    exists(path: string) {
        return this.publishers[0].exists(path);
    }
    
    list() {
        return this.publishers[0].list();
    }
    
    async rollback() {
        await Promise.all(this.publishers.map(p => p.rollback()));
    }
    
    async commit(msg: string) {
        await Promise.all(this.publishers.map(p => p.commit(msg)));
    }
}

export = MirrorPublisher;