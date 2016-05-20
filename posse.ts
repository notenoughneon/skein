import mfo = require('mf-obj');
import util = require('./util');
var debug = require('debug')('posse');

var handlers: Map<string, (e: mfo.Entry) => Promise<string>> = new Map();
    
handlers.set('twitter.com', bridgyPosseTo('http://brid.gy/publish/twitter'));
handlers.set('facebook.com', bridgyPosseTo('http://brid.gy/publish/facebook'));

function bridgyPosseTo(publishUrl: string) {
    return async function(entry: mfo.Entry) {
        let res = JSON.parse(await util.sendWebmention(entry.url, publishUrl, {'bridgy_omit_link': 'maybe'}));
        if (typeof res.url !== 'string')
            throw new Error('Couldnt decode response: ' + res);
        return res.url;
    }
}

export = async function posse(entry: mfo.Entry, to: string[]) {
    var syndications =  await util.map(to, (async (silo) => {
        try {
            return await handlers.get(silo)(entry);
        } catch (err) {
            debug('POSSE to ' + silo + ' failed: ' + err.message);
            return null;
        }
    }));
    return syndications.filter(s => s !== null);
}