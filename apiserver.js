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

function logger(req, res, next) {
    util.log(util.format('%s %s\n%s', req.method, req.url,
        util.inspect(req.method == 'POST' ? req.post : req.query)));
    next();
}

app.use(parsePost);
app.use(logger);

app.get('/auth', function(req, res) {
    res.render('authform', req.query);
});

app.post('/auth', function(req, res) {
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
        res.status(403).send('Incorrect password');
    }
});

app.post('/token', function(req, res) {
    if (lastIssuedCode !== null &&
        lastIssuedCode.code === req.post.code &&
        ((new Date() - lastIssuedCode.date) < 60 * 1000)) {
        site.generateToken(lastIssuedCode.client_id, lastIssuedCode.scope).
            then(function (result) {
                lastIssuedCode = null;
                if (result === undefined) {
                    res.status(500);
                } else {
                    res.type('application/x-www-form-urlencoded');
                    res.send(querystring.stringify({access_token: result.token, scope: result.scope, me: site.url}));
                }
            });
    } else {
        res.status(401);
    }
});

app.post('/micropub', function(req, res) {
    site.hasAuthorization(req, 'post').
        then(function(authorized) {
            if (!authorized)
                return res.status(401);
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
                then(res.status(200).send('Created'));
        });
});

app.get('/tokens', function(req, res) {
    site.listTokens().then(res.json.bind(res));
});

app.get('/tokens/:id', function(req, res) {
    site.getToken(req.params.id).then(res.json.bind(res));
});

var server = app.listen(80, function (){
    var address = server.address();
    console.log('Listening on %s:%s', address.address, address.port);
});
