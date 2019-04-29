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

The example below uses [xhook][] which is used to intercept HTTP requests made in the browser.

```html
<script src="https://polyfill.io/v3/polyfill.min.js?features=Object.getOwnPropertySymbols"></script>
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
<script src="https://polyfill.io/v3/polyfill.min.js?features=Object.getOwnPropertySymbols"></script>
```

* IE 10 requires a polyfill for `Object.getOwnPropertySymbols`

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
