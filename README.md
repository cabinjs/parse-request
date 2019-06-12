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
* `sanitizeHeaders` (Array) - defaults to the list of Strings provided under [Sensitive Header Names Automatically Masked](#sensitive-header-names-automatically-masked) below
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

It automatically detects whether the request is from the Browser, Koa, or Express, and return a parsed object with these fields populated:

```js
{
  request: {
    method: 'GET',
    query: {},
    headers: {},
    cookies: {},
    body: '',
    url: ''
  },
  user: {}
}
```

Two additional (conditionally) added properties will appear if you are using [multer][] or utilizing `req.file` or `req.files` in your application.  The two properties are `file` and `files` respectively, and are only added if they exist on the original request object.

Note that there is a `user` object returned, which will be parsed from `req.user` automatically for you.

The `user` object will also have a `ip_address` property added, but only if one does not already exists and if an IP address was actually detected.

Also note that this function will mask passwords and commonly used sensitive field names, so a `req.body.password` or a `req.user.password` property with a value of `foobar123` will become `*********`.

See [Sensitive Field Names Automatically Masked](#sensitive-field-names-automatically-masked) below for the complete list.

### Credit Card Masking

We also have built-in credit-card number detection and masking using the [credit-card-type][] library.

This means that credit card numbers (or fields that are very similar to a credit card) will be automatically masked.  If you'd like to turn this off, pass `false` to `maskCreditCards`\*\*

### Sensitive Field Names Automatically Masked

See [sensitive-fields][] for the complete list.

### Sensitive Header Names Automatically Masked

* `Authorization`


## Usage

We highly recommend to simply use [Cabin][] as this package is built-in!

### VanillaJS

**The browser-ready bundle is only 17 KB (minified and gzipped)**.

The example below uses [xhook][] which is used to intercept HTTP requests made in the browser.

```html
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6,Number.isFinite,Object.getOwnPropertySymbols,Symbol.iterator,Symbol.prototype"></script>
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
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6,Number.isFinite,Object.getOwnPropertySymbols,Symbol.iterator,Symbol.prototype"></script>
```

* Number.isFinite() is not supported in IE 10
* Object.getOwnPropertySymbols() is not supported in IE 10
* Symbol.iterator() is not supported in IE 10
* Symbol.prototype() is not supported in IE 10

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
