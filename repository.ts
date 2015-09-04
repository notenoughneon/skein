///<reference path="typings/tsd.d.ts"/>
import microformat = require('./microformat');
import Domain = require('./domain');

class Repository {
    registerDomainHandler(url: string, domain: Domain) {
        throw new Error('Not implemented');
    }

    get(url: string): microformat.Entry {
        throw new Error('Not implemented');
    }

    exists(url: string): boolean {
        throw new Error('Not implemented');
    }

    put(entry: microformat.Entry) {
        throw new Error('Not implemented');
    }

    queryByDomain(domain: string): microformat.Entry[] {
        throw new Error('Not implemented');
    }
}

export = Repository;