import when = require('when');
import nodefn = require('when/node');
import request = require('request');

var handlers = [
    {pattern: /^https?:\/\/(www\.)?youtu\.be/i, handler: oembed('http://www.youtube.com/oembed')},
    {pattern: /^https?:\/\/(www\.)?youtube\.com/i, handler: oembed('http://www.youtube.com/oembed')},
    {pattern: /^https?:\/\/(www\.)?soundcloud\.com/i, handler: oembed('http://soundcloud.com/oembed')}
];

function oembed(apiUrl: string, options?): (string) => when.Promise<string> {
    if (options === undefined)
        options = {};
    return url => {
        options.url = url;
        options.format = 'json';
        return nodefn.call(request, {url: apiUrl, qs: options}).
            then(res => {
                if (res[0].statusCode != 200)
                    throw new Error(apiUrl + ' return status code ' + res[0].statusCode);
                var obj = JSON.parse(res[1]);
                if (obj.html === undefined)
                    throw new Error('OEmbed response missing html field');
                return obj.html;
            });
    };
}

export = function resolve(url: string): when.Promise<string> {
    var match = handlers.filter(h => h.pattern.test(url));
    return match.length ? match[0].handler(url) : when.resolve(null);
}