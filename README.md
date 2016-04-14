# skein

[![travis][travis-image]][travis-url]
[travis-image]: https://api.travis-ci.org/notenoughneon/skein.svg?branch=master
[travis-url]: https://travis-ci.org/notenoughneon/skein

Indieweb static site generator

* Publish to Amazon S3, git, or local filesystem
* OAuth, Micropub, and Webmention endpoint
* Post types:
  * Notes
  * Replies
  * Likes
  * Reposts
  * Articles
  * Photos
  * Audio

## Building

```
npm run build
```

## Quick start

Running the end-to-end test will populate a sample site under build/test/static.

```
mocha build/test/e2e
```

You can then start the static file and API server on localhost:8000 by running:

```
node build/server.js test/config.json
```
