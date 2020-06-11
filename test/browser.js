const path = require('path');
const { readFileSync } = require('fs');
const { Script } = require('vm');
const test = require('ava');
const { JSDOM, VirtualConsole } = require('jsdom');

const virtualConsole = new VirtualConsole();
virtualConsole.sendTo(console);

const script = new Script(
  readFileSync(path.join(__dirname, '..', 'dist', 'parse-request.min.js'))
);

const dom = new JSDOM(``, {
  url: 'http://localhost:3000/',
  referrer: 'http://localhost:3000/',
  contentType: 'text/html',
  includeNodeLocations: true,
  resources: 'usable',
  runScripts: 'dangerously',
  virtualConsole
});
console.log(dom.window);

dom.runVMScript(script);

test('should parse a request', t => {
  const obj = dom.window.parseRequest({
    req: {
      method: 'POST',
      body: {}
    }
  });
  t.is(obj.request.url, undefined);
});

test('should parse request and not override', t => {
  const obj = dom.window.parseRequest({
    req: {
      method: 'POST',
      body: {},
      headers: {
        Referer: 'https://duckduckgo.com',
        'User-Agent': 'foo',
        Cookie: 'beep=boop'
      }
    }
  });
  t.is(obj.request.headers['user-agent'], 'foo');
  t.is(obj.request.headers.referer, 'https://duckduckgo.com');
  t.is(obj.request.headers.cookie, 'beep=boop');
  t.deepEqual(obj.request.cookies, {
    beep: 'boop'
  });
});

test('should not override headers.referer', t => {
  const obj = dom.window.parseRequest({
    req: {
      method: 'GET',
      headers: {
        referer: 'foo'
      }
    }
  });
  t.is(obj.request.headers.referer, 'foo');
});

test('should not override headers.referrer', t => {
  const obj = dom.window.parseRequest({
    req: {
      method: 'GET',
      headers: {
        referrer: 'foo'
      }
    }
  });
  t.is(obj.request.headers.referrer, 'foo');
});

test('should not override headers.cookie', t => {
  const obj = dom.window.parseRequest({
    req: {
      method: 'GEt',
      headers: {
        cookie: 'foo=bar'
      }
    }
  });
  t.is(obj.request.headers.cookie, 'foo=bar');
});
