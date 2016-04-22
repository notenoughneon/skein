///<reference path="typings/main.d.ts"/>
import fs = require('fs');
import pathlib = require('path');
import child_process = require('child_process');
import util = require('./util');
import FilePublisher = require('./filepublisher');

class GitPublisher extends FilePublisher {
    push: boolean;
    
    constructor(config: {root: string, push: boolean}) {
        super(config);
        this.push = config.push;
    }
    
    private exec(cmd: string, args: string[]) {
        return new Promise((res, rej) => {
            var child = child_process.spawn(cmd, args, {cwd: this.root});
            child.on('close', code => code === 0 ? res() : rej(cmd + ' exited with status ' + code));
        });
    }
    
    async rollback(): Promise<void> {
        await this.exec('git', ['checkout', '.']);
    }

    async commit(msg): Promise<void> {
        await this.exec('git', ['add', '.']);
        await this.exec('git', ['commit', '-m', msg]);
        if (this.push)
            await this.exec('git', ['push']);
    }
}

export = GitPublisher;