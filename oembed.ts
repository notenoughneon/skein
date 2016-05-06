import when = require('when');
import nodefn = require('when/node');
import request = require('request');
import cheerio = require('cheerio');
import util = require('./util');
var debug = require('debug')('oembed');

var get = function(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        request.get({url, headers: {'User-Agent': 'request'}}, (err, result) => err !== null ? reject(err) : resolve(result));
    });
}

async function getOembed(url: string) {
    var res = await get(url);
    if (res.statusCode !== 200)
        throw new Error('Server returned status ' + res.statusCode);
    var $ = cheerio.load(res.body);
    var link = $('link[rel=\'alternate\'][type=\'application/json+oembed\'],' +
        'link[rel=\'alternate\'][type=\'text/json+oembed\']').attr('href');
    if (link == null)
        throw new Error('No oembed link found');
    debug('Fetching ' + link);
    var res = await get(link);
    if (res.statusCode !== 200)
        throw new Error('Server returned status ' + res.statusCode);
    var embed = JSON.parse(res.body);
    if (embed.html == null)
        throw new Error('No html in oembed response');
    return embed.html;
}

async function wrap16x9(url: string) {
    return '<div class="thumbnail embed-responsive embed-responsive-16by9">' + await getOembed(url) + '</div>';
}

var handlers = [
    {pattern: /^https?:\/\/(www\.)?youtu\.be/i, handler: wrap16x9},
    {pattern: /^https?:\/\/(www\.)?youtube\.com/i, handler: wrap16x9},
    {pattern: /^https?:\/\/(www\.)?soundcloud\.com/i, handler: wrap16x9},
    {pattern: /^https?:\/\/(www\.)?twitter\.com/i, handler: getOembed}
];

export = async function resolve(url: string) {
    var match = handlers.filter(h => h.pattern.test(url));
    if (match.length === 0)
        throw new Error('No oembed handler for ' + url);
    return match[0].handler(url);
}