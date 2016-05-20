import fs = require('fs');
import os = require('os');
import path = require('path');
import querystring = require('querystring');
import express = require('express');
var Busboy = require('busboy');
import crypto = require('crypto');
import jwt = require('jsonwebtoken');
import nodefn = require('when/node');
var debug = require('debug')('api');
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
        debug(parms);
    if (req.files !== undefined && Object.keys(req.files).length > 0)
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
    // store the last code issued by the auth endpoint in memory
    lastIssuedCode: {code: string, redirect_uri: string, client_id: string, scope: string, date: number};

    constructor(site: Site) {
        this.site = site;
        this.router = express.Router();
        this.lastIssuedCode = null;

        this.router.use(parsePost);
        this.router.use(logger);

        this.router.get('/auth', (req, res) => {
            if (req.query.response_type == null)
                req.query.response_type = 'id';
            if (req.query.client_id == null || req.query.me == null ||
                req.query.redirect_uri == null || req.query.state == null ||
                (req.query.response_type !== 'id' && req.query.response_type !== 'code') ||
                (req.query.response_type === 'code' && req.query.scope == null)) {
                res.sendStatus(400);
            } else {
                res.render('authform', req.query);
            }
        });

        this.router.post('/auth', rateLimit(6, 1000 * 60 * 10), async (req, res) => {
            try {
                if (req['post'].code != null) {
                    if (this.lastIssuedCode !== null &&
                        this.lastIssuedCode.code === req['post'].code &&
                        this.lastIssuedCode.redirect_uri === req['post'].redirect_uri &&
                        this.lastIssuedCode.client_id === req['post'].client_id &&
                        ((Date.now() - this.lastIssuedCode.date) < 60 * 1000)) {
                        res.type('application/x-www-form-urlencoded');
                        res.send(querystring.stringify({me: site.config.url}));
                        this.lastIssuedCode = null;
                    } else {
                        debug('Failed auth verification from ' + req.ip);
                        res.sendStatus(401);
                    }
                } else if (req['post'].password === site.config.password) {
                    if (req['post'].response_type === 'id')
                        req['post'].scope = '';
                    var buf = await nodefn.call(crypto.randomBytes, 18);
                    var code = buf.toString('base64');
                    this.lastIssuedCode = {
                        code: code,
                        redirect_uri: req['post'].redirect_uri,
                        client_id: req['post'].client_id,
                        scope: req['post'].scope,
                        date: Date.now()
                    };
                    res.redirect(req['post'].redirect_uri + '?' +
                        querystring.stringify({code: code, state: req['post'].state, me: site.config.url}));
                } else {
                    debug('Failed password authentication from ' + req.ip);
                    res.sendStatus(401);
                }
            } catch (e) {handleError(res, e)};

        });

        this.router.post('/token', rateLimit(3, 1000 * 60), (req, res) => {
            if (this.lastIssuedCode !== null &&
                this.lastIssuedCode.code === req['post'].code &&
                this.lastIssuedCode.redirect_uri === req['post'].redirect_uri &&
                this.lastIssuedCode.client_id === req['post'].client_id &&
               ((Date.now() - this.lastIssuedCode.date) < 60 * 1000)) {
                var token = this.generateToken(this.lastIssuedCode.client_id, this.lastIssuedCode.scope);
                res.type('application/x-www-form-urlencoded');
                res.send(querystring.stringify({access_token: token, scope: this.lastIssuedCode.scope, me: site.config.url}));
                this.lastIssuedCode = null;
            } else {
                debug('Failed token request from ' + req.ip);
                res.sendStatus(401);
            }
        });

        this.router.post('/micropub', this.requireAuth('post'), (req, res) => {
            if (req['post'].h != 'entry')
                return res.sendStatus(400);
            site.publish({
                content: req['post'].content,
                name: req['post'].name,
                replyTo: req['post']['in-reply-to'],
                likeOf: req['post']['like-of'],
                repostOf: req['post']['repost-of'],
                photo: req['files'].photo,
                audio: req['files'].audio,
                syndication: req['post'].syndication,
                category: req['post'].category,
                syndicateTo: req['post']['mp-syndicate-to'] != null ? req['post']['mp-syndicate-to'] : req['post']['syndicate-to']
            })
            .then(entry => {
                res.location(entry.url);
                res.sendStatus(201);
            })
            .catch(e => handleError(res, e));
        });

        this.router.post('/webmention', rateLimit(50, 1000 * 60 * 60), (req, res) => {
            var source = req['post'].source;
            var target = req['post'].target;
            if (source === undefined || target === undefined)
                return res.status(400).send('"source" and "target" parameters are required');
            site.receiveWebmention(source, target)
            .then(() => res.sendStatus(200))
            .catch(e => handleError(res, e));
        });

    }

    generateToken(client_id: string, scope: string) {
        return jwt.sign({client_id, scope}, this.site.config.jwtSecret);
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
            try {
                var claim = jwt.verify(token, this.site.config.jwtSecret);
                if (!claim.scope.split(' ').some(s => s === scope))
                    return denyAccess(req, res);
                next();
            } catch (err) {
                return denyAccess(req, res);
            }
        };
    }
}

export = Api;