import FilePublisher = require('./filepublisher');
import GitPublisher = require('./gitpublisher');
import S3Publisher = require('./s3publisher');
import MirrorPublisher = require('./mirrorpublisher');

// type Config = {
//         type: "file";
//         root: string;
//     } |
//     {
//        type: "git";
//        root: string;
//        push: boolean;
//     } |
//     {
//         type: "s3";
//         region: string;
//         bucket: string;
//     } |
//     {
//         type: 'mirror';
//         primary: Config;
//         secondary: Config;
//     };

abstract class Publisher {
    abstract put(path: string, obj: string | NodeJS.ReadableStream, contentType?: string): Promise<void>;
    abstract delete(path: string, contentType: string): Promise<void>;
    abstract get(path: string): Promise<{Body: Buffer, ContentType: string}>;
    abstract exists(path: string): Promise<boolean>;
    abstract list(): Promise<string[]>;
    abstract rollback(): Promise<void>;
    abstract commit(msg: string): Promise<void>;
    
    static getInstance(config): Publisher {
        switch(config.type) {
            case 'file':
                return new FilePublisher(config);
            case 'git':
                return new GitPublisher(config);
            case 's3':
                return new S3Publisher(config);
            case 'mirror':
                return new MirrorPublisher(config);
            default:
                throw new Error('Unknown publisher type ' + config.type);
        }
    }

}

export default Publisher;