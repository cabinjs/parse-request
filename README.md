# parse-request

[![build status](https://img.shields.io/travis/cabinjs/parse-request.svg)](https://travis-ci.org/cabinjs/parse-request)
[![code coverage](https://img.shields.io/codecov/c/github/cabinjs/parse-request.svg)](https://codecov.io/gh/cabinjs/parse-request)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/cabinjs/parse-request.svg)](LICENSE)

> Parse requests in the Browser and Node (with added support for [multer][] and [passport][]). Made for [Cabin][].


## Table of Contents

* [Install](#install)
* [How does it work](#how-does-it-work)
  * [Credit Card Masking](#credit-card-masking)
  * [Sensitive Field Names Automatically Masked](#sensitive-field-names-automatically-masked)
  * [Sensitive Header Names Automatically Masked](#sensitive-header-names-automatically-masked)
* [Usage](#usage)
  * [VanillaJS](#vanillajs)
  * [Koa](#koa)
  * [Express](#express)
* [Contributors](#contributors)
* [License](#license)


## Install

[npm][]:

```sh
npm install parse-request
```

[yarn][]:

```sh
yarn add parse-request
```


## How does it work

This package exports a function that accepts an Object argument with options:

* `req` (Object) - an HTTP request
* `userFields` (Array) - defaults to `[ 'id', 'email', 'full_name', 'ip_address' ]`, list of fields to cherry-pick from the user object parsed out of `req.user`
* `sanitizeFields` (Array) - defaults to the list of Strings provided under [Sensitive Field Names Automatically Masked](#sensitive-field-names-automatically-masked) below
* `sanitizeHeaders` (Array) - defaults to the list of Strings provided under [Sensitive Header Names Automatically Masked](#sensitive-header-names-automatically-masked) below (case insensitive)
* `maskCreditCards` (Boolean) - defaults to `true`, and specifies whether or not credit card numbers are masked
* `maskBuffers` (Boolean) - defaults to `true`, and will rewrite `Buffer`'s, `ArrayBuffer`'s, and `SharedArrayBuffer`'s recursively as an object of `{ type: <String>, byteLength: <Number> }`.  Note that this will save you on disk log storage size as logs will not output verbose stringified buffers – e.g. imagine a 10MB file image upload sent across the request body as a Buffer!)
* `maskStreams` (Boolean) - defauls to `true`, and will rewrite `Stream`'s to `{ type: 'Stream' }` (this is useful for those using multer v2.x (streams version), or those that have streams in `req.body`, `req.file`, or `req.files`)
* `checkId` (Boolean) - defaults to `true`, and prevents Strings that closely resemble primary key ID's from being masked (e.g. properties named `_id`, `id`, `ID`, `product_id`, `product-id`, `productId`, `productID`, and `product[id]` won't get masked or show as a false-positive for a credit card check)
* `checkCuid` (Boolean) - defaults to `true`, and prevents [cuid][] values from being masked
* `checkObjectId` (Boolean) - defaults to `true`, and prevents [MongoDB BSON ObjectId][bson-objectid] from being masked
* `checkUUID` (Boolean) - defaults to `true`, and prevents [uuid][] values from being masked
* `rfdc` (Object) - defaults to `{ proto: false, circles: false }` (you should not need to customize this, but if necessary refer to [rfdc][] documentation)
* `parseBody` (Boolean) - defaults to `true`, if you set to `false` we will not parse nor clone the request `body` property (this overrides all other parsing settings related)
* `parseFiles` (Boolean) - defaults to `true`, if you set to `false` we will not parse nor clone the request `file` nor `files` properties (this overrides all other parsing settings related)

It automatically detects whether the request is from the Browser, Koa, or Express, and return a parsed object with populated properties.

Here's an example object parsed:

```js
{
  request: {
    method: 'POST',
    query: {
      foo: 'bar',
      beep: 'boop'
    },
    headers: {
      host: '127.0.0.1:63955',
      'accept-encoding': 'gzip, deflate',
      'user-agent': 'node-superagent/3.8.3',
      authorization: 'Basic ********************',
      accept: 'application/json',
      cookie: 'foo=bar;beep=boop',
      'content-type': 'multipart/form-data; boundary=--------------------------930511303948232291410214',
      'content-length': '1599',
      connection: 'close'
    },
    cookies: {
      foo: 'bar',
      beep: 'boop'
    },
    body: '{"product_id":"5d0350ef2ca74d11ee6e4f00","name":"nifty","surname":"lettuce","bank_account_number":"1234567890","card":{"number":"****-****-****-****"},"stripe_token":"***************","favorite_color":"green"}',
    url: '/?foo=bar&beep=boop',
    timestamp: '2019-06-14T07:46:55.568Z',
    id: 'fd6225ed-8db0-4862-8566-0c0ad6f4c7c9',
    http_version: '1.1',
    files: '{"avatar":[{"fieldname":"avatar","originalname":"avatar.png","encoding":"7bit","mimetype":"image/png","buffer":{"type":"Buffer","byteLength":216},"size":216}],"boop":[{"fieldname":"boop","originalname":"boop-1.txt","encoding":"7bit","mimetype":"text/plain","buffer":{"type":"Buffer","byteLength":7},"size":7},{"fieldname":"boop","originalname":"boop-2.txt","encoding":"7bit","mimetype":"text/plain","buffer":{"type":"Buffer","byteLength":7},"size":7}]}'
  },
  user: {
    ip_address: '::ffff:127.0.0.1'
  },
  id: '5d0350ef2ca74d11ee6e4f01',
  timestamp: '2019-06-14T07:46:55.000Z',
  duration: 6.651317
}
```

A few extra details about the above properties:

* `id` is a newly created BSON ObjectId used to uniquely identify this log
* `timestamp` is the [ISO-8601][] date time string parsed from the `id` (thanks to MongoDB BSON `ObjectID.getTimestamp` method)
* `duration` is the number of milliseconds that `parseRequest` took to parse the request object (this is incredibly useful for alerting) – note that this uses `process.hrtime` which this package polyfills thanks to [browser-process-hrtime][]
* `user` is parsed from the user object on `req.user` automatically (e.g. you are using [passport][])
* `user` object will have an `ip_address` property added
* `request.id` is conditionally added if `req.id` is a String – we highly recommend that you use [express-request-id][] in your project, which will automatically add this property if `X-Request-Id` if it is set, otherwise it will generate it as a new UUID
* `request.file` and `request.files` are conditionally added if you have a `req.file` or `req.files` property (e.g. you are using [multer][])
* `request.http_version` is parsed from `req.httpVersion` or `req.httpVersionMajor` and `req.httpVersionMinor`
* `request.timestamp` is the [ISO-8601][] date time string parsed from `req[startTime]` – note that you **must be using the [request-received][] package for this property to be automatically added**
* `request.duration` is the number of milliseconds that it took to send a response, and it is parsed from `X-Response-Time` header from `request.headers` - note that you must have `X-Response-Time` header (e.g. via [response-time][]) for this property to be automatically added

Please see [Credit Card Masking](#credit-card-masking) and [Sensitive Field Names Automatically Masked](#sensitive-field-names-automatically-masked) below for more information about how `request.body`, `request.file`, and `request.files` are parsed and conditionally masked for security.

### Credit Card Masking

We also have built-in credit-card number detection and masking using the [credit-card-type][] library.

This means that credit card numbers (or fields that are very similar to a credit card) will be automatically masked.  If you'd like to turn this off, pass `false` to `maskCreditCards`\*\*

### Sensitive Field Names Automatically Masked

See [sensitive-fields][] for the complete list.

### Sensitive Header Names Automatically Masked

The `Authorization` HTTP header has its `<credentials>` portion automatically masked.

This means that if you are using BasicAuth or JSON Web Tokens ("JWT"), then your tokens will be hidden.


## Usage

We highly recommend to simply use [Cabin][] as this package is built-in!

### VanillaJS

**The browser-ready bundle is only 17 KB (minified and gzipped)**.

The example below uses [xhook][] which is used to intercept HTTP requests made in the browser.

```html
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6,Number.isFinite,Object.getOwnPropertySymbols,Symbol.iterator,Symbol.prototype,Symbol.for"></script>
<script src="https://unpkg.com/xhook"></script>
<script src="https://unpkg.com/parse-request"></script>
<script type="text/javascript">
  (function() {
    xhook.after(function(req, res) {
      var req = parseRequest({ req });
      console.log('req', req);
      // ...
    });
  })();
</script>
```

#### Required Browser Features

We recommend using <https://polyfill.io> (specifically with the bundle mentioned in [VanillaJS](#vanillajs) above):

```html
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6,Number.isFinite,Object.getOwnPropertySymbols,Symbol.iterator,Symbol.prototype,Symbol.for"></script>
```

* Number.isFinite() is not supported in IE 10
* Object.getOwnPropertySymbols() is not supported in IE 10
* Symbol.iterator() is not supported in IE 10
* Symbol.prototype() is not supported in IE 10
* Symbol.for() is not supported in IE 10

### Koa

```js
const parseRequest = require('parse-request');

// ...

app.get('/', (ctx, next) => {
  const req = parseRequest({ req: ctx });
  console.log('req', req);
  // ...
});
```

### Express

```js
const parseRequest = require('parse-request');

// ...

app.get('/', (req, res, next) => {
  const req = parseRequest({ req });
  console.log('req', req);
  // ...
});
```

#### If you override req.body and need to preserve original in logs

Sometimes developers overwrite `req.body` or `req.body` properties – therefore if you want to preserve the original request, you can add `req._originalBody = req.body` at the top of your route middleware (or as a global route middleware).


## Contributors

| Name           | Website                    |
| -------------- | -------------------------- |
| **Nick Baugh** | <http://niftylettuce.com/> |


## License

[MIT](LICENSE) © [Nick Baugh](http://niftylettuce.com/)


## 

[npm]: https://www.npmjs.com/

[yarn]: https://yarnpkg.com/

[passport]: http://www.passportjs.org/

[cabin]: https://cabinjs.com

[xhook]: https://github.com/jpillora/xhook

[credit-card-type]: https://github.com/braintree/credit-card-type

[sensitive-fields]: https://github.com/cabinjs/sensitive-fields

[cuid]: https://github.com/ericelliott/cuid

[bson-objectid]: https://docs.mongodb.com/manual/reference/method/ObjectId/

[uuid]: https://github.com/kelektiv/node-uuid#uuid-

[multer]: https://github.com/expressjs/multer

[rfdc]: https://github.com/davidmarkclements/rfdc

[request-received]: https://github.com/cabinjs/request-received

[express-request-id]: https://github.com/floatdrop/express-request-id

[browser-process-hrtime]: https://github.com/kumavis/browser-process-hrtime/

[iso-8601]: https://en.wikipedia.org/wiki/ISO_8601

[response-time]: https://github.com/expressjs/response-time
