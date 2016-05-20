import stream = require('stream');
import Publisher from './publisher';

class MirrorPublisher implements Publisher {    
    publishers: Publisher[];
    
    constructor(config: {primary: any, secondary: any}) {
        this.publishers = [config.primary, config.secondary].map(c => Publisher.getInstance(c));
    }
    
    async put(path: string, obj: string | NodeJS.ReadableStream, contentType?: string) {
        await Promise.all(this.publishers.map(p => {
            if (typeof obj === 'string') {
                return p.put(path, obj, contentType);
            } else {
                let clone = new stream.PassThrough();
                obj.pipe(clone);
                // work around aws-sdk kludge
                if (typeof obj.path === 'string') {
                    clone.path = obj.path;
                }
                return p.put(path, clone, contentType);
            }
        }));
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