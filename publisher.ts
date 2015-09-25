///<reference path="typings/tsd.d.ts"/>
import when = require('when');

interface Publisher {
    put(path: string, obj: any, contentType: string): when.Promise<void>;
    get(path: string): when.Promise<{Body: Buffer, ContentType: string}>;
    exists(path: string): when.Promise<boolean>;
    list(): when.Promise<string[]>;
    rollback(): when.Promise<boolean>;
    commit(msg: string): when.Promise<boolean>;
}

export = Publisher;