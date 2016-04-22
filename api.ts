///<reference path="typings/main.d.ts"/>
import fs = require('fs');
import os = require('os');
import path = require('path');
import querystring = require('querystring');
import express = require('express');
var Busboy = require('busboy');
var bodyParser = require('body-parser');
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

function parsePost(req, res, next) {
    if (req.method === 'POST') {
        var busboy = new Busboy({
            headers: req.headers,
            limits: {
                files: 1,
                fileSize: 10 * 1000 * 1000
            }
        });
        var tmpfiles = [];
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
            tmpfiles.push(tmpfile);
            file.pipe(fs.createWriteStream(tmpfile));
        });
        busboy.on('finish', function () {
            next();
        });
        res.on('finish', function() {
            for (let file of tmpfiles) {
                debug('Cleaning up ' + file);
                fs.unlink(file);
            }
        });
        req.pipe(busboy);
    } else {
        next();
    }
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
        debug(req.method == 'POST' ? req.post : req.query);
    if (Object.keys(req.files).length > 0)
        debug(req.files);
    next();
}

function denyAccess(req, res) {
    debug('Access denied');
    res.sendStatus(401);
}

function handleError(res, error) {
    debug('Server error: ' + error);
    res.sendStatus(500);
}

class Api {
    site: Site;
    router: express.Router;
    // in-memory list of issued tokens
    tokens: {token: string, client_id: string, scope: string}[];
    // store the last code issued by the auth endpoint in memory
    lastIssuedCode: {code: string, client_id: string, scope: string, date: number};
    publishMutex: util.Mutex;

    constructor(site: Site) {
        this.site = site;
        this.router = express.Router();
        this.tokens = [];
        this.lastIssuedCode = null;
        this.publishMutex = new util.Mutex();

        this.router.use(parsePost);
        this.router.use(logger);

        this.router.get('/auth', (req, res) => {
            if (req.query.client_id != null &&
                req.query.me != null &&
                req.query.redirect_uri != null &&
                req.query.state != null &&
                req.query.scope != null)
                res.render('authform', req.query);
            else
                res.sendStatus(400);
        });

        this.router.post('/auth', rateLimit(3, 1000 * 60 * 10), (req, res) => {
            if (req['post'].password === site.config.password) {
                nodefn.call(crypto.randomBytes, 18).
                    then((buf) => {
                        var code = buf.toString('base64');
                        this.lastIssuedCode = {
                            code: code,
                            client_id: req['post'].client_id,
                            scope: req['post'].scope,
                            date: Date.now()
                        };
                        res.redirect(req['post'].redirect_uri + '?' +
                        querystring.stringify({code: code, state: req['post'].state, me: site.config.url}));
                    }).
                    catch(e => handleError(res, e));
            } else {
                debug('Failed password authentication from ' + req.ip);
                res.sendStatus(401);
            }
        });

        this.router.post('/token', rateLimit(3, 1000 * 60), (req, res) => {
            if (this.lastIssuedCode !== null &&
                this.lastIssuedCode.code === req['post'].code &&
                ((Date.now() - this.lastIssuedCode.date) < 60 * 1000)) {
                this.generateToken(this.lastIssuedCode.client_id, this.lastIssuedCode.scope).
                    then((result) => {
                        this.lastIssuedCode = null;
                        if (result === undefined) {
                            res.sendStatus(500);
                        } else {
                            res.type('application/x-www-form-urlencoded');
                            res.send(querystring.stringify({access_token: result.token, scope: result.scope, me: site.config.url}));
                        }
                    }).
                    catch(e => handleError(res, e));
            } else {
                debug('Failed token request from ' + req.ip);
                res.sendStatus(401);
            }
        });

        this.router.post('/micropub', this.requireAuth('post'), (req, res) => {
            var entry: microformat.Entry;
            var release;
            if (req['post'].h != 'entry')
                return res.sendStatus(400);
            this.publishMutex.lock().
                then(r => release = r).
                then(() => site.publish({
                    content: req['post'].content,
                    name: req['post'].name,
                    replyTo: req['post']['in-reply-to'],
                    likeOf: req['post']['like-of'],
                    repostOf: req['post']['repost-of'],
                    photo: req['files'].photo,
                    audio: req['files'].audio,
                    syndication: req['post'].syndication,
                    category: req['post'].category
                })).
                then(e => entry = e).
                then(() => site.generateStream()).
                then(() => when.map(entry.category, category => site.generateTagIndex(category))).
                then(() => {
                    if (entry.isArticle())
                        return site.generateArticleIndex();
                }).
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

        this.router.post('/webmention', rateLimit(50, 1000 * 60 * 60), (req, res) => {
            var release;
            var source = req['post'].source;
            var target = req['post'].target;
            if (source === undefined || target === undefined)
                return res.status(400).send('"source" and "target" parameters are required');
            this.publishMutex.lock().
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

        this.router.get('/entries/*', this.requireAuth('post'), (req, res) => {
            var url = req.params[0];
            site.get(url).
                then(entry => {
                    res.type('application/json');
                    res.send(entry.serialize());
                }).
                catch(e => handleError(res, e));
        });

        this.router.put('/entries', this.requireAuth('post'), bodyParser.json(), (req, res) => {
            var entry = req.body;
            return site.update(entry).
                catch(e => handleError(res, e));
        });

        this.router.delete('/entries/*', this.requireAuth('post'), (req, res) => {
            var url = req.params[0];
            site.delete(url).
                then(() => res.sendStatus(204)).
                catch(e => handleError(res, e));
        });

    }

    generateToken(client_id: string, scope: string) {
        return nodefn.call(crypto.randomBytes, 18).
            then(buf => {
                var token = {token: buf.toString('base64'), client_id: client_id, scope: scope};
                this.tokens.push(token);
                return token;
            });
    }

    requireAuth(scope) {
        return (req, res, next) => {
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
            var found = this.tokens.find(t => t.token === token);
            if (found === undefined || !found.scope.split(' ').some(s => s === scope))
                return denyAccess(req, res);
            next();
        };
    }
}

export = Api;