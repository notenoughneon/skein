///<reference path="typings/tsd.d.ts"/>
var AWS = require('aws-sdk');
var nodefn = require('when/node');
import request = require('request');
import Domain = require('./domain');

class WebDomain implements Domain {
    put(path:string, obj:any, contentType:string):void {
        throw new Error('Put not supported');
    }

    get(path:string):any {
        return nodefn.call(request, path).
            then(res => res[1]);
    }

    exists(path:string):boolean {
        return nodefn.call(request, path).
            then(res => res[0].statusCode === 200);
    }

    list():string[] {
        throw new Error('Not implemented');
    }

}

export = WebDomain;