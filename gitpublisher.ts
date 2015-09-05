///<reference path="typings/tsd.d.ts"/>
import fs = require('fs');
import pathlib = require('path');
import child_process = require('child_process');
import when = require('when');
import nodefn = require('when/node');
import util = require('./util');
import FilePublisher = require('./filepublisher');

var exec = nodefn.lift(child_process.exec);

class GitPublisher extends FilePublisher {
    begin() {
        // FIXME: this will need to acquire lock
        return when(false);
    }

    rollback() {
        var gitcheckout = 'git -C ' + this.config.root + ' checkout .';
        return exec(gitcheckout).
            then(() => true);
    }

    commit(msg) {
        var gitcommit = 'git -C ' + this.config.root + ' commit -a -m \'' + msg + '\'';
        var gitpush = 'git -C ' + this.config.root + ' push';
        return exec(gitcommit).
            then(() => exec(gitpush)).
            then(() => true);
    }
}

export = GitPublisher;