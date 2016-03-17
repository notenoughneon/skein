///<reference path="typings/main.d.ts"/>
import when = require('when');

interface Publisher {
    put(path: string, obj: any, contentType: string): when.Promise<{}>;
    delete(path: string, contentType: string): when.Promise<{}>;
    get(path: string): when.Promise<{Body: Buffer, ContentType: string}>;
    exists(path: string): when.Promise<boolean>;
    list(): when.Promise<string[]>;
    rollback(): when.Promise<{}>;
    commit(msg: string): when.Promise<{}>;
}

export = Publisher;