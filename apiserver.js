var querystring = require('querystring');
var express = require('express');
var Busboy = require('busboy');
var app = express();
var ejs = require('ejs');
var nodefn = require('when/node');
var site = require('./site');
var util = require('util');

app.set('views', './template');
app.set('view engine', 'ejs');

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

app.get('/test', function(req, res) {
    res.end();
});

app.get('/auth', function(req, res) {
    res.render('authform', {me: req.query.me,
        client_id: req.query.client_id,
        redirect_uri: req.query.redirect_uri,
        state: req.query.state,
        response_type: req.query.response_type,
        scope: req.query.scope});
});

app.post('/auth', function(req, res) {
    if (req.post.password !== undefined) {
        // post target for auth form
        if (req.post.password === site.password) {
            site.generateToken(req.post.client_id, req.post.scope).
                then(function (code) {
                    res.redirect(req.post.redirect_uri + '?' +
                        querystring.stringify({code: code, state: req.post.state, me: req.post.me}));
                });
        } else {
            res.status(403).send('Incorrect password');
        }
    } else {
        // verification callback from remote web app
        site.verifyToken(req.post.code, req.post.redirect_uri, req.post.client_id, req.post.state).
            then(function (result) {
                if (result === undefined) {
                    res.status(404).send('Not found');
                } else {
                    res.type('application/x-www-form-urlencoded');
                    res.send(querystring.stringify(result));
                }
    });
    }
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
