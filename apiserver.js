var querystring = require('querystring');
var express = require('express');
var Busboy = require('busboy');
var app = express();
var ejs = require('ejs');
var crypto = require('crypto');
var nodefn = require('when/node');
var site = require('./site');
var util = require('util');
var microformat = require('./microformat');

app.set('views', './template');
app.set('view engine', 'ejs');

// store the last code issued by the auth endpoint in memory
var lastIssuedCode = null;

function parsePost(req, res, next) {
    if (req.method === 'POST') {
        var busboy = new Busboy({headers: req.headers});
        req.post = {};
        busboy.on('field', function (fieldname, val) {
            req.post[fieldname] = val;
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
    util.log('Access denied');
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
        } else if (req.post.access_token !== undefined) {
            token = req.post.access_token;
        } else {
            return denyAccess(req, res);
        }
        site.getToken(token).
            then(function (row) {
                if (row === undefined || row.scope !== scope)
                    return denyAccess(req, res);
                next();
            });

    };
}

function rateLimit(count, cooldown) {
    var lastreq = new Date();
    var capacity = count;
    return function(req, res, next) {
        capacity = Math.min(capacity + (new Date() - lastreq) * (count / cooldown), count);
        if (capacity >= 1) {
            capacity--;
            lastreq = new Date();
            next();
        } else {
            res.sendStatus(429);
        }
    };
}

function logger(req, res, next) {
    var parms = (req.method == 'POST' ? req.post : req.query);
    util.log(util.format('%s %s %s', req.ip, req.method, req.url));
    if (Object.keys(parms).length > 0)
        console.log(util.format('%s', util.inspect(req.method == 'POST' ? req.post : req.query)));
    next();
}

app.use(parsePost);
app.use(logger);

app.get('/auth', function(req, res) {
    res.render('authform', req.query);
});

app.post('/auth', rateLimit(3, 1000 * 60 * 10), function(req, res) {
    if (req.post.password === site.password) {
        nodefn.call(crypto.randomBytes, 18).
            then(function (buf) {
                var code = buf.toString('base64');
                lastIssuedCode = {
                    code: code,
                    client_id: req.post.client_id,
                    scope: req.post.scope,
                    date: new Date()
                };
                res.redirect(req.post.redirect_uri + '?' +
                querystring.stringify({code: code, state: req.post.state, me: site.url}));
            });
    } else {
        util.log('Failed password authentication from ' + req.ip);
        res.sendStatus(401);
    }
});

app.post('/token', rateLimit(3, 1000 * 60), function(req, res) {
    if (lastIssuedCode !== null &&
        lastIssuedCode.code === req.post.code &&
        ((new Date() - lastIssuedCode.date) < 60 * 1000)) {
        site.generateToken(lastIssuedCode.client_id, lastIssuedCode.scope).
            then(function (result) {
                lastIssuedCode = null;
                if (result === undefined) {
                    res.sendStatus(500);
                } else {
                    res.type('application/x-www-form-urlencoded');
                    res.send(querystring.stringify({access_token: result.token, scope: result.scope, me: site.url}));
                }
            });
    } else {
        util.log('Failed token request from ' + req.ip);
        res.sendStatus(401);
    }
});

app.post('/micropub', requireAuth('post'), function(req, res) {
    site.getSlug(null).
        then(function (slug) {
            var entry = new microformat.Entry(slug);
            entry.published[0] = new Date().toISOString();
            entry.author[0] = {
                url: [site.url]
            };
            entry.content[0] = {
                value: req.post.content,
                html: req.post.content
            };
            return entry;
        }).
        then(site.store).
        then(site.generateIndex).
        then(function () {
            res.sendStatus(201);
        });
});

//app.get('/tokens', function(req, res) {
//    site.listTokens().then(res.json.bind(res));
//});

var server = app.listen(process.argv[2], function (){
    var address = server.address();
    console.log('Listening on %s:%s', address.address, address.port);
});
