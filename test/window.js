const test = require('ava');
const Window = require('window');
const { CookieJar } = require('jsdom');

const cookieJar = new CookieJar();
const window = new Window({
  url: 'http://localhost:3000/',
  referrer: 'http://localhost:3000/',
  contentType: 'text/html',
  includeNodeLocations: true,
  resources: 'usable',
  cookieJar
});

const parseRequest = require('..');

test('should parse a request', t => {
  cookieJar.setCookieSync('foo=bar', window.document.URL);
  const obj = parseRequest(
    {
      req: {
        method: 'POST',
        body: {}
      }
    },
    window
  );
  t.is(obj.request.url, window.location.pathname + window.location.search);
  t.is(obj.request.headers['user-agent'], window.navigator.userAgent);
  t.is(obj.request.headers.referer, window.document.referrer);
  t.is(obj.request.headers.cookie, window.document.cookie);
  t.deepEqual(obj.request.cookies, {
    foo: 'bar'
  });
});

test('should parse request and not override', t => {
  const obj = parseRequest(
    {
      req: {
        method: 'POST',
        body: {},
        headers: {
          'User-Agent': 'foo',
          Referer: 'https://duckduckgo.com',
          Cookie: 'beep=boop'
        }
      }
    },
    window
  );
  t.is(obj.request.headers['user-agent'], 'foo');
  t.is(obj.request.headers.referer, 'https://duckduckgo.com');
  t.is(obj.request.headers.cookie, 'beep=boop');
  t.deepEqual(obj.request.cookies, {
    beep: 'boop'
  });
});

test('should not override headers.referer', t => {
  const obj = parseRequest(
    {
      req: {
        method: 'GET',
        headers: {
          referer: 'foo'
        }
      }
    },
    window
  );
  t.is(obj.request.headers.referer, 'foo');
});

test('should not override headers.referrer', t => {
  const obj = parseRequest(
    {
      req: {
        method: 'GET',
        headers: {
          referrer: 'foo'
        }
      }
    },
    window
  );
  t.is(obj.request.headers.referrer, 'foo');
});

test('should not override headers.cookie', t => {
  const obj = parseRequest(
    {
      req: {
        method: 'GEt',
        headers: {
          cookie: 'foo=bar'
        }
      }
    },
    window
  );
  t.is(obj.request.headers.cookie, 'foo=bar');
});
