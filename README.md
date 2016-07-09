# skein

[![travis][travis-image]][travis-url]
[![coverage][coverage-image]][coverage-url]
[travis-image]: https://api.travis-ci.org/notenoughneon/skein.svg?branch=master
[travis-url]: https://travis-ci.org/notenoughneon/skein
[coverage-image]: https://coveralls.io/repos/github/notenoughneon/skein/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/notenoughneon/skein?branch=master

Indieweb static site generator

Skein is a static site generator that hosts [micropub](http://micropub.net/draft/) and [webmention](http://webmention.net/draft/) endpoints. It implements the [PURR](http://notenoughneon.com/2016/5/29/purl-a-portable-content-store) pattern to reuse the published HTML + microformats as its own content store. The back-end is modular, and can publish static content to Amazon S3, Github, or local filesystem (for serving with the built in web server).

## Usage

```
node build/server.js <config.json> [-i]
```

`-i` will start the server in "interactive mode" launching the REPL. See `example-configs/` for examples of config files.

TODO: document REPL usage and config options

## Quick start

Skein isn't production ready, but if you want to try it out, this will get you started. You will need node >= 4.0.

```
git clone https://github.com/notenoughneon/skein.git
cd skein
npm install
npm run build
```

This will run the typescript compiler and build the javascript files. You can ignore the warnings. Next run the e2e test with:

```
node_modules/.bin/mocha build/test/e2e
```

This will populate an example site under build/test/static. You can run a server hosting these files with:

```
DEBUG=* node build/server.js test/config.json -i
```

and point your browser to localhost:8000. To create a post from the repl:

```
site.publish({content: 'hello world!'})
```

Note, if you don't have typings, tsc, or mocha installed globally, you should be able to run them from node_modules/.bin.
