var fs = require('fs');
var path = require('path');
var when = require('when');
var nodefn = require('when/node');
var microformat = require('./microformat');
var site = require('./site');
var util = require('./util');

function regexFilter(pat, files) {
    var re = new RegExp(pat);
    return files.filter(re.exec.bind(re));
}

// import posts
util.walkDir('..\\notenoughneon.com\\2015').
    then(regexFilter.bind(null, '\.html$')).
    then(function(files) {
        return when.map(files, function (file) {
            nodefn.call(fs.readFile, file).
                then(function(html) {
                    return microformat.getHEntryWithCard(html, '');
                }).
                then(site.store);
        });
    }).
    then(site.generateIndex).
    catch(function(e) {
        console.log(e.stack);
    });

// copy photos
util.walkDir('..\\notenoughneon.com\\2015').
    then(regexFilter.bind(null, '\.(jpg|png)$')).
    then(function(files) {
        return files.map(function(file){
            //hack
            var dst = ['static'].concat(file.split(path.sep).slice(2)).join(path.sep);
            util.copy(file, dst);
        });
    }).
    catch(function(e) {
        console.log(e.stack);
    });
