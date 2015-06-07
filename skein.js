var parser = require('microformat-node');
var ejs = require('ejs');
var nodefn = require('when/node');
var request = require('request');
var util = require('util');
var fs = require('fs');
var microformat = require('./microformat');

var url = process.argv[2];

var site = {
    title: 'Dummy Site Title',
    url: 'http://dummy.site',
    author: {
        name: 'My Name',
        photo: 'http://dummy.site/photo.jpg',
        note: 'Here is my bio',
        elsewhere: [
        {name: 'Twitter', url: 'https://twitter.com/test'}
        ]
    },
    webmentionUrl: 'http://api.dummy.site/webmention',
    authUrl: 'http://api.dummy.site/auth',
    tokenUrl: 'http://api.dummy.site/token',
    micropubUrl: 'http://api.dummy.site/micropub'
};

function dump(data) {
    console.log(util.inspect(data, {depth: null}));
}

nodefn.call(request, url).
    then(function(response) {
        return microformat.getHEntryWithCard(response[1], url);
    }).
    then(function(entry) {
        dump(entry);
    }).
    catch(function(e) {
        dump(e);
    });
