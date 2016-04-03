///<reference path="typings/main.d.ts"/>
import when = require('when');

interface Publisher {
    put(path: string, obj: any, contentType: string): Promise<void>;
    delete(path: string, contentType: string): Promise<void>;
    get(path: string): Promise<{Body: Buffer, ContentType: string}>;
    exists(path: string): Promise<boolean>;
    list(): Promise<string[]>;
    rollback(): Promise<void>;
    commit(msg: string): Promise<void>;
}

export = Publisher;