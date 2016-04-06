///<reference path="typings/main.d.ts"/>
import fs = require('fs');
import os = require('os');
import path = require('path');
import repl = require('repl');
import querystring = require('querystring');
import express = require('express');
var Busboy = require('busboy');
var bodyParser = require('body-parser');
var app = express();
import crypto = require('crypto');
import when = require('when');
import nodefn = require('when/node');
var callbacks = require('when/callbacks');
var inspect = require('util').inspect;
import Debug = require('debug');
var debug = Debug('api');
import microformat = require('./microformat');
import Site = require('./site');
import util = require('./util');

var config = JSON.parse(fs.readFileSync(process.argv[2]).toString());
var site = new Site(config);

app.set('views', './template');
app.set('view engine', 'jade');

// in-memory list of issued tokens
var tokens: {token: string, client_id: string, scope: string}[] = [];
// store the last code issued by the auth endpoint in memory
var lastIssuedCode: {code: string, client_id: string, scope: string, date: number} = null;

var publishMutex = new util.Mutex();

function generateToken(client_id: string, scope: string) {
    return nodefn.call(crypto.randomBytes, 18).
        then(buf => {
            var token = {token: buf.toString('base64'), client_id: client_id, scope: scope};
            tokens.push(token);
            return token;
        });
}

function parsePost(req, res, next) {
    if (req.method === 'POST') {
        var busboy = new Busboy({headers: req.headers});
        req.post = {};
        req.files = {};
        busboy.on('field', function (fieldname, val) {
            // php style array properties
            if (/\[\]$/.test(fieldname)) {
                var match = /(.+)\[\]$/.exec(fieldname);
                if (!(req.post[match[1]] instanceof Array))
                    req.post[match[1]] = [];
                req.post[match[1]].push(val);
            } else if (/\[.+\]$/.test(fieldname)) {
                var match = /(.+)\[(.+)\]/.exec(fieldname);
                if (!(req.post[match[1]] instanceof Object))
                    req.post[match[1]] = {};
                req.post[match[1]][match[2]] = val;
            } else {
                req.post[fieldname] = val;
            }
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
        var found = tokens.find(t => t.token === token);
        if (found === undefined || !found.scope.split(' ').some(function(s) {return s === scope;}))
            return denyAccess(req, res);
        next();
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
        debug(inspect(req.method == 'POST' ? req.post : req.query));
    next();
}

function handleError(res, error) {
    debug(error.stack);
    res.sendStatus(500);
}

app.use(parsePost);
app.use(logger);

app.get('/auth', function(req, res) {
    if (req.query.client_id != null &&
        req.query.me != null &&
        req.query.redirect_uri != null &&
        req.query.state != null &&
        req.query.scope != null)
        res.render('authform', req.query);
    else
        res.sendStatus(400);
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
        generateToken(lastIssuedCode.client_id, lastIssuedCode.scope).
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
    var release;
    if (req['post'].h != 'entry')
        return res.sendStatus(400);
    publishMutex.lock().
        then(r => release = r).
        then(() => site.publish({
            content: req['post'].content,
            name: req['post'].name,
            replyTo: req['post']['in-reply-to'],
            photo: req['files'].photo,
            audio: req['files'].audio,
            syndication: req['post'].syndication,
            category: req['post'].category
        })).
        then(e => entry = e).
        then(() => site.generateIndex()).
        then(() => when.map(entry.category, category => site.generateTagIndex(category))).
        then(() => site.publisher.commit('publish ' + entry.url)).
        then(() => release()).
        then(() => site.sendWebmentionsFor(entry)).
        then(() => {
            res.location(entry.url);
            res.sendStatus(201);
        }).
        catch(e => {
            handleError(res, e);
            release();
        });
});

app.post('/webmention', rateLimit(50, 1000 * 60 * 60), function(req, res) {
    var release;
    var source = req['post'].source;
    var target = req['post'].target;
    if (source === undefined || target === undefined)
        return res.status(400).send('"source" and "target" parameters are required');
    publishMutex.lock().
        then(r => release = r).
        then(() => site.receiveWebmention(source, target)).
        then(() => site.publisher.commit('webmention from ' + source + ' to ' + target)).
        then(() => release()).
        then(() => res.sendStatus(200)).
        catch(e => {
            handleError(res, e);
            release();
        });
});

app.get('/entries/*', requireAuth('post'), function(req, res) {
    var url = req.params[0];
    site.get(url).
        then(entry => {
            res.type('application/json');
            res.send(entry.serialize());
        }).
        catch(e => handleError(res, e));
});

app.put('/entries', requireAuth('post'), bodyParser.json(), function(req, res) {
    var entry = req.body;
    return site.update(entry).
        catch(e => handleError(res, e));
});

app.delete('/entries/*', requireAuth('post'), function(req, res) {
    var url = req.params[0];
    site.delete(url).
        then(() => res.sendStatus(204)).
        catch(e => handleError(res, e));
});

var server = app.listen(config.port, function (){
    var address = server.address();
    debug('Listening on %s:%s', address.address, address.port);
});

if (process.argv[3] == '-i')
    repl.start('> ').context.site = site;