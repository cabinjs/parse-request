# parse-request

[![build status](https://img.shields.io/travis/cabinjs/parse-request.svg)](https://travis-ci.org/cabinjs/parse-request)
[![code coverage](https://img.shields.io/codecov/c/github/cabinjs/parse-request.svg)](https://codecov.io/gh/cabinjs/parse-request)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/cabinjs/parse-request.svg)](LICENSE)

> Parse requests in the Browser and Node (with added support for [Passport][]). Made for [Cabin][].


## Table of Contents

* [Install](#install)
* [How does it work](#how-does-it-work)
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

This package exports a function that accepts two arguments `(req, userFields)`.

* `req` (Object) - an HTTP request
* `userFields` (Array) - defaults to `[ 'id', 'email', 'full_name']`, list of fields to cherry-pick from the user object parsed out of `req.user`

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

Note that there is a `user` object returned, which will be parsed from `req.user` automatically.

The `user` object will also have a `ip_address` property added, but only if one does not already exists and if an IP address was actually detected.


## Usage

We highly recommend to simply use [Cabin][] as this package is built-in!

### VanillaJS

The example below uses [xhook][] which is used to intercept HTTP requests made in the browser.

```html
<script src="https://unpkg.com/xhook"></script>
<script src="https://unpkg.com/parse-request"></script>
<script type="text/javascript">
  (function() {
    xhook.after(function(req, res) {
      var req = parseRequest(req);
      console.log('req', req);
      // ...
    });
  })();
</script>
```

### Koa

```js
const parseRequest = require('parse-request');

// ...

app.get('/', (ctx, next) => {
  const req = parseRequest(ctx);
  console.log('req', req);
  // ...
});
```

### Express

```js
const parseRequest = require('parse-request');

// ...

app.get('/', (req, res, next) => {
  const req = parseRequest(req);
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
