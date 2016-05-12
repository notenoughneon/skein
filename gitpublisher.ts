import fs = require('fs');
import pathlib = require('path');
import child_process = require('child_process');
import util = require('./util');
import FilePublisher = require('./filepublisher');
var debug = require('debug')('gitpublisher');

class GitPublisher extends FilePublisher {
    push: boolean;
    
    constructor(config: {root: string, push: boolean}) {
        super(config);
        this.push = config.push;
    }
    
    private exec(cmd: string, args: string[]) {
        return new Promise((res, rej) => {
            var buf = '';
            var child = child_process.spawn(cmd, args, {cwd: this.root});
            child.stdout.on('data', data => buf += data);
            child.on('close', code => code === 0 ? res(buf) : rej(cmd + ' exited with status ' + code));
        });
    }
    
    list() {
        return super.list()
        .then(paths => paths.filter(p => !p.startsWith('.git')));
    }
    
    async rollback(): Promise<void> {
        debug('rollback');
        await this.exec('git', ['checkout', '.']);
    }

    async commit(msg): Promise<void> {
        debug('commit');
        await this.exec('git', ['add', '.']);
        var res = await this.exec('git', ['status','--porcelain']);
        if (res === '') {
            debug('Nothing to commit');
            return;
        }
        debug('Staged changes:\n' + res);
        await this.exec('git', ['commit', '-m', msg]);
        if (this.push)
            await this.exec('git', ['push']);
    }
}

export = GitPublisher;