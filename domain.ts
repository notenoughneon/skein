///<reference path="typings/tsd.d.ts"/>

interface Domain {
    put(path: string, obj: any, contentType: string): void;
    get(path: string): any;
    exists(path: string): boolean;
    list(): string[];
}

export = Domain;