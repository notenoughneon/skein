///<reference path="typings/main.d.ts"/>
import fs = require('fs');
import pathlib = require('path');
import child_process = require('child_process');
import when = require('when');
import nodefn = require('when/node');
import util = require('./util');
import FilePublisher = require('./filepublisher');

var exec = nodefn.lift(child_process.exec);

class GitPublisher extends FilePublisher {
    push: boolean;
    
    constructor(config: {root: string, push: boolean}) {
        super(config);
        this.push = config.push;
    }
    rollback(): Promise<{}> {
        var gitcheckout = 'git -C ' + this.root + ' checkout .';
        return exec(gitcheckout).
            then(() => undefined);
    }

    commit(msg): Promise<{}> {
        var gitcommit = 'git -C ' + this.root + ' commit -a -m \'' + msg + '\'';
        var gitpush = 'git -C ' + this.root + ' push';
        return exec(gitcommit).
            then(() => {
                if (this.push)
                    exec(gitpush);
            }).
            then(() => undefined);
    }
}

export = GitPublisher;