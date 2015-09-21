///<reference path="typings/tsd.d.ts"/>
import fs = require('fs');
import os = require('os');
import path = require('path');
import querystring = require('querystring');
import express = require('express');
var Busboy = require('busboy');
var app = express();
var ejs = require('ejs');
import crypto = require('crypto');
var nodefn = require('when/node');
import util = require('util');
import Debug = require('debug');
var debug = Debug('api');
import microformat = require('./microformat');
import Db = require('./db');
import Site = require('./site');

if (process.argv[3] === undefined)
    var configFile = 'config.json';
else
    configFile = process.argv[3];
var db = new Db('index.db');
db.init();
var config = JSON.parse(fs.readFileSync(configFile).toString());
var site = new Site(config, db);

app.set('views', './template');
app.set('view engine', 'ejs');

// store the last code issued by the auth endpoint in memory
var lastIssuedCode = null;

function parsePost(req, res, next) {
    if (req.method === 'POST') {
        var busboy = new Busboy({headers: req.headers});
        req.post = {};
        req.files = {};
        busboy.on('field', function (fieldname, val) {
            req.post[fieldname] = val;
        });
        busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
            var tmpfile = path.join(os.tmpdir(), path.basename(filename));
            req.files[fieldname] = {tmpfile: tmpfile, filename: filename, mimetype: mimetype};
            file.pipe(fs.createWriteStream(tmpfile));
        });
        busboy.on('finish', function () {
            next();
        });
        req.pipe(busboy);
    } else {
        next();
    }
}

function denyAccess(req, res) {
    debug('Access denied');
    res.sendStatus(401);
}

function requireAuth(scope) {
    return function(req, res, next) {
        var token;
        if (req.headers.authorization !== undefined) {
            var re = /^bearer (.+)/i;
            var match = re.exec(req.headers.authorization);
            if (match === null || match[1] === undefined)
                return denyAccess(req, res);
            token = match[1];
        } else if (req.post !== undefined && req.post.access_token !== undefined) {
            token = req.post.access_token;
        } else {
            return denyAccess(req, res);
        }
        site.db.getToken(token).
            then(function (row) {
                if (row === undefined || !row.scope.split(' ').some(function(s) {return s === scope;}))
                    return denyAccess(req, res);
                next();
            });

    };
}

function rateLimit(count, cooldown) {
    var lastreq = Date.now();
    var capacity = count;
    return function(req, res, next) {
        capacity = Math.min(capacity + (Date.now() - lastreq) * (count / cooldown), count);
        if (capacity >= 1) {
            capacity--;
            lastreq = Date.now();
            next();
        } else {
            res.sendStatus(429);
        }
    };
}

function logger(req, res, next) {
    var parms = (req.method == 'POST' ? req.post : req.query);
    debug('%s %s %s', req.ip, req.method, req.url);
    if (Object.keys(parms).length > 0)
        debug(util.inspect(req.method == 'POST' ? req.post : req.query));
    next();
}

function handleError(res, error) {
    debug(error.stack);
    res.sendStatus(500);
}

app.use(parsePost);
app.use(logger);

app.get('/auth', function(req, res) {
    res.render('authform', req.query);
});

app.post('/auth', rateLimit(3, 1000 * 60 * 10), function(req, res) {
    if (req['post'].password === site.config.password) {
        nodefn.call(crypto.randomBytes, 18).
            then(function (buf) {
                var code = buf.toString('base64');
                lastIssuedCode = {
                    code: code,
                    client_id: req['post'].client_id,
                    scope: req['post'].scope,
                    date: Date.now()
                };
                res.redirect(req['post'].redirect_uri + '?' +
                querystring.stringify({code: code, state: req['post'].state, me: site.config.url}));
            }).
            catch(function (e) {
                handleError(res, e);
            });
    } else {
        debug('Failed password authentication from ' + req.ip);
        res.sendStatus(401);
    }
});

app.post('/token', rateLimit(3, 1000 * 60), function(req, res) {
    if (lastIssuedCode !== null &&
        lastIssuedCode.code === req['post'].code &&
        ((Date.now() - lastIssuedCode.date) < 60 * 1000)) {
        site.generateToken(lastIssuedCode.client_id, lastIssuedCode.scope).
            then(function (result) {
                lastIssuedCode = null;
                if (result === undefined) {
                    res.sendStatus(500);
                } else {
                    res.type('application/x-www-form-urlencoded');
                    res.send(querystring.stringify({access_token: result.token, scope: result.scope, me: site.config.url}));
                }
            }).
            catch(function (e) {
                handleError(res, e);
            });
    } else {
        debug('Failed token request from ' + req.ip);
        res.sendStatus(401);
    }
});

app.post('/micropub', requireAuth('post'), function(req, res) {
    var entry: microformat.Entry;
    //req.['files'].photo.filename, .tmpfile, .mimetype
    site.publish({
        content: req['post'].content,
        name: req['post'].name,
        replyTo: req['post']['in-reply-to']
        }).
        then(e => entry = e).
        then(() => site.generateIndex()).
        then(() => site.sendWebmentionsFor(entry)).
        then(() => {
            res.location(entry.url);
            res.sendStatus(201);
        }).
        catch(e => handleError(res, e));
});

app.post('/webmention', rateLimit(50, 1000 * 60 * 60), function(req, res) {
    if (req['post'].source === undefined || req['post'].target === undefined)
        return res.status(400).send('"source" and "target" parameters are required');
    site.receiveWebmention(req['post'].source, req['post'].target).
        then(() => res.sendStatus(200)).
        catch(e => handleError(res, e));
});

app.get('/tokens', requireAuth('admin'), function(req, res) {
    site.db.listTokens().
        then(res.json.bind(res)).
        catch(function (e) {
            handleError(res, e);
        });
});

app.delete('/tokens/*', requireAuth('admin'), function(req, res) {
    site.db.deleteToken(req.params[0]).
        then(res.json.bind(res)).
        catch(function (e) {
            handleError(res, e);
        });
});

var server = app.listen(process.argv[2], function (){
    var address = server.address();
    debug('Listening on %s:%s', address.address, address.port);
});
