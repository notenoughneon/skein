import FilePublisher = require('./filepublisher');
import GitPublisher = require('./gitpublisher');
import S3Publisher = require('./s3publisher');

type Config = {
        type: "file";
        root: string;
    } |
    {
       type: "git";
       root: string;
       push: boolean;
    } |
    {
        type: "s3";
        region: string;
        bucket: string;
    };

abstract class Publisher {
    static getInstance(config): Publisher {
        switch(config.type) {
            case 'file':
                return new FilePublisher(config);
            case 'git':
                return new GitPublisher(config);
            case 's3':
                return new S3Publisher(config);
            default:
                throw new Error('Unknown publisher type ' + config.type);
        }
    }
    abstract put(path: string, obj: string | NodeJS.ReadableStream, contentType?: string): Promise<void>;
    abstract delete(path: string, contentType: string): Promise<void>;
    abstract get(path: string): Promise<{Body: Buffer, ContentType: string}>;
    abstract exists(path: string): Promise<boolean>;
    abstract list(): Promise<string[]>;
    abstract rollback(): Promise<void>;
    abstract commit(msg: string): Promise<void>;
}

export = Publisher;