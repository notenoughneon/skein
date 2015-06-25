var fs = require('fs');
var when = require('when');
var nodefn = require('when/node');
var request = require('request');
var microformat = require('./microformat');
var site = require('./site');
var util = require('./util');

var url = process.argv[2];

nodefn.call(fs.readFile, '../notenoughneon.com/2015/5/15/1.html').
    then(function(html) {
        return microformat.getHEntryWithCard(html, 'http://notenoughneon.com');
    }).
    then(util.dump).
    catch(function(e) {
        console.log(e.stack);
    });

function filterHtml(files) {
    var re = new RegExp('.*\.html$');
    return files.filter(re.exec.bind(re));
}

//util.walkDir('../notenoughneon.com/2015').
//    then(filterHtml).
//    then(function(files) {
//        return when.map(files, function (file) {
//            nodefn.call(fs.readFile, file).
//                then(function(html) {
//                    return microformat.getHEntryWithCard(html, 'http://notenoughneon.com');
//                }).
//                then(site.store);
//        });
//    }).
//    then(site.generateIndex).
//    catch(function(e) {
//        console.log(e.stack);
//    });
