var nodefn = require('when/node');
var request = require('request');
var util = require('util');
var microformat = require('./microformat');
var site = require('./site');

var url = process.argv[2];

function dump(data) {
    console.log(util.inspect(data, {depth: null}));
}

nodefn.call(request, url).
    then(function(response) {
        return microformat.getHEntryWithCard(response[1], url);
    }).
    //then(site.generateIndex).
    then(site.store).
    then(function(elt) {
        dump(elt);
    }).
    catch(function(e) {
        console.log(e.stack);
    });
