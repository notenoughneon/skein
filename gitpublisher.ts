///<reference path="typings/main.d.ts"/>
import fs = require('fs');
import pathlib = require('path');
import child_process = require('child_process');
import util = require('./util');
import FilePublisher = require('./filepublisher');

var exec = util.promisify(child_process.exec);

class GitPublisher extends FilePublisher {
    push: boolean;
    
    constructor(config: {root: string, push: boolean}) {
        super(config);
        this.push = config.push;
    }
    async rollback(): Promise<void> {
        var gitcheckout = 'git -C ' + this.root + ' checkout .';
        await exec(gitcheckout);
    }

    async commit(msg): Promise<void> {
        var gitcommit = 'git -C ' + this.root + ' commit -a -m \'' + msg + '\'';
        var gitpush = 'git -C ' + this.root + ' push';
        await exec(gitcommit);
        if (this.push)
            await exec(gitpush);
    }
}

export = GitPublisher;