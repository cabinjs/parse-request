const test = require('ava');

const parseRequest = require('..');

test('hides passwords', t => {
  const obj = parseRequest({
    req: {
      body: {
        password: 'hello',
        some: {
          deeply: {
            nested: {
              password: 'foobeep'
            },
            password: 'beep'
          },
          baz: {
            password: {
              password: 'boop'
            }
          }
        }
      },
      method: 'POST'
    }
  });
  const body = JSON.parse(obj.request.body);
  t.is(body.password, '*****');
  t.is(body.some.deeply.nested.password, '*******');
  t.is(body.some.deeply.password, '****');
  t.is(body.some.baz.password.password, '****');
});

test('hides authentication header', t => {
  let obj = parseRequest({
    req: {
      method: 'GET',
      headers: {
        Authorization: 'Bearer foobar'
      }
    }
  });
  t.is(obj.request.headers.Authorization, 'Bearer ******');

  obj = parseRequest({
    req: {
      method: 'GET',
      headers: {
        Authorization: 'Bearer foobar foobar foobar'
      }
    }
  });
  t.is(obj.request.headers.Authorization, 'Bearer ********************');
});

test('hides credit card number', t => {
  const obj = parseRequest({
    req: {
      body: {
        'card[number]': '0000000000000000',
        myVisaCard: '4242-4242x4242*4242',
        // <https://stripe.com/docs/testing#cards>
        amex: '3714 496 3539 8431',
        jcb: '35 66 00 20 20 36 05 05'
      },
      method: 'POST'
    }
  });
  const body = JSON.parse(obj.request.body);
  t.is(body['card[number]'], '****************');
  t.is(body.myVisaCard, '****-****x*********');
  t.is(body.amex, '**** *** **** ****');
  t.is(body.jcb, '** ** ** ** ** ** ** **');
});

test('GET/HEAD empty String `request.body`', t => {
  t.is(
    parseRequest({
      req: {
        method: 'GET',
        body: 'hello world'
      }
    }).request.body,
    ''
  );
  t.is(
    parseRequest({
      req: {
        method: 'HEAD',
        body: 'hello world'
      }
    }).request.body,
    ''
  );
});

test('POST with Object is parsed to `request.body`', t => {
  t.is(
    parseRequest({
      req: {
        method: 'POST',
        body: { hello: 'world' }
      }
    }).request.body,
    JSON.stringify({ hello: 'world' })
  );
});

test('POST with Number is parsed to `request.body`', t => {
  t.is(
    parseRequest({
      req: {
        method: 'POST',
        body: 1
      }
    }).request.body,
    '1'
  );
});

test('POST with String is parsed to `request.body`', t => {
  t.is(
    parseRequest({
      req: {
        method: 'POST',
        body: 'hello world'
      }
    }).request.body,
    'hello world'
  );
});

test('parses user object', t => {
  t.is(
    parseRequest({
      req: {
        method: 'GET',
        user: {
          id: '123'
        }
      }
    }).user.id,
    '123'
  );
});

test('parses ip address', t => {
  t.is(
    parseRequest({
      req: {
        method: 'GET',
        ip: '127.0.0.1'
      }
    }).user.ip_address,
    '127.0.0.1'
  );
});
