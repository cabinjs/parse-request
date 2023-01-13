const { Buffer } = require('node:buffer');
const { PassThrough } = require('node:stream');
const test = require('ava');

const ObjectId = require('bson-objectid');
const parseRequest = require('..');

// https://github.com/cabinjs/request-received
const startTime = Symbol.for('request-received.startTime');
const pinoHttpStartTime = Symbol.for('pino-http.startTime');

test('hides passwords', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
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
        },
        arr: [
          {
            foo: {
              beep: [
                {
                  password: 'baz'
                }
              ]
            }
          }
        ]
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.is(body.password, '*****');
  t.is(body.some.deeply.nested.password, '*******');
  t.is(body.some.deeply.password, '****');
  t.is(body.some.baz.password.password, '****');
  t.is(body.arr[0].foo.beep[0].password, '***');
});

test('parses http-version', (t) => {
  const obj = parseRequest({
    req: {
      httpVersion: '2.0'
    }
  });
  t.is(obj.request.http_version, '2.0');
});

test('parses http-version major and minor', (t) => {
  const obj = parseRequest({
    req: {
      httpVersionMajor: '1',
      httpVersionMinor: '1'
    }
  });
  t.is(obj.request.http_version, '1.1');
});

test('parses req.id', (t) => {
  const obj = parseRequest({
    req: {
      id: 'foobar'
    }
  });
  t.is(obj.request.id, 'foobar');
});

test('created an object id, timestamp, and duration', (t) => {
  const obj = parseRequest();
  t.true(typeof obj.id === 'string');
  t.true(ObjectId.isValid(obj.id));
  t.true(typeof obj.timestamp === 'string');
  t.true(typeof obj.duration === 'number');
});

test('parses responseHeaders as a string', (t) => {
  const obj = parseRequest({
    responseHeaders: [
      'HTTP/1.1 200 OK',
      'Date: Tue, 10 Jun 2014 07:19:27 GMT',
      'Connection: keep-alive',
      'Transfer-Encoding: chunked',
      '',
      'Hello World'
    ].join('\r\n')
  });
  t.is(obj.response.http_version, '1.1');
  t.is(obj.response.status_code, 200);
  t.is(obj.response.reason_phrase, 'OK');
  t.true(typeof obj.response.headers.date === 'string');
});

test('parses responseHeaders as a string w/o HTTP line', (t) => {
  const obj = parseRequest({
    responseHeaders: [
      'Date: Tue, 10 Jun 2014 07:19:27 GMT',
      'Connection: keep-alive',
      'Transfer-Encoding: chunked',
      '',
      'Hello World'
    ].join('\r\n')
  });
  t.true(typeof obj.response.status_code === 'undefined');
  t.true(typeof obj.response.headers.date === 'string');
});

test('parses start time and start date as date', (t) => {
  const req = {};
  req[startTime] = new Date();
  const obj = parseRequest({
    req,
    responseHeaders: {
      Date: new Date().toISOString(),
      'X-Response-Time': '500 ms'
    }
  });
  t.true(typeof obj.request.timestamp === 'string');
  t.true(typeof obj.response.timestamp === 'string');
  t.true(typeof obj.response.headers.date === 'string');
  t.true(typeof obj.response.duration === 'number');
});

test('works with morgan req._startTime date', (t) => {
  const req = {};
  req._startTime = new Date();
  const obj = parseRequest({
    req,
    responseHeaders: {
      Date: new Date().toISOString(),
      'X-Response-Time': '500 ms'
    }
  });
  t.true(typeof obj.request.timestamp === 'string');
  t.true(typeof obj.response.timestamp === 'string');
  t.true(typeof obj.response.headers.date === 'string');
  t.true(typeof obj.response.duration === 'number');
});

test('works with morgan req._startTime number', (t) => {
  const req = {};
  req._startTime = Date.now();
  const obj = parseRequest({
    req,
    responseHeaders: {
      Date: new Date().toISOString(),
      'X-Response-Time': '500 ms'
    }
  });
  t.true(typeof obj.request.timestamp === 'string');
  t.true(typeof obj.response.timestamp === 'string');
  t.true(typeof obj.response.headers.date === 'string');
  t.true(typeof obj.response.duration === 'number');
});

test('parses start time and start date as number', (t) => {
  const req = {};
  req[startTime] = Date.now();
  const obj = parseRequest({
    req,
    responseHeaders: {
      Date: new Date().toISOString(),
      'X-Response-Time': '500 ms'
    }
  });
  t.true(typeof obj.request.timestamp === 'string');
  t.true(typeof obj.response.timestamp === 'string');
  t.true(typeof obj.response.headers.date === 'string');
  t.true(typeof obj.response.duration === 'number');
});

test('parses pino start time and start date', (t) => {
  const req = {};
  req[pinoHttpStartTime] = Date.now();
  const obj = parseRequest({
    req,
    responseHeaders: {
      Date: new Date().toISOString(),
      'X-Response-Time': '500 ms'
    }
  });
  t.true(typeof obj.request.timestamp === 'string');
  t.true(typeof obj.response.timestamp === 'string');
  t.true(typeof obj.response.headers.date === 'string');
  t.true(typeof obj.response.duration === 'number');
});

test('uses req.url', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: {
        foo: new PassThrough()
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.deepEqual(body.foo, { type: 'Stream' });
});

test('masks referrer if referer is set', (t) => {
  const obj = parseRequest({
    req: {
      method: 'GET',
      headers: {
        referrer: 'foo'
      }
    },
    sanitizeHeaders: ['referer']
  });
  t.is(obj.request.headers.referrer, '***');
});

test('masks referer if referrer is set', (t) => {
  const obj = parseRequest({
    req: {
      method: 'GET',
      headers: {
        referer: 'foo'
      }
    },
    sanitizeHeaders: ['referrer']
  });
  t.is(obj.request.headers.referer, '***');
});

test('does not parse body', (t) => {
  const body = 'test';
  const obj = parseRequest({
    req: {
      method: 'POST',
      body
    },
    parseBody: false
  });
  t.true(typeof obj.request.body === 'undefined');
});

test('does not parse files', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      file: {
        fieldname: 'test',
        originalname: 'test',
        buffer: Buffer.from('abc')
      },
      files: [
        {
          fieldname: 'test',
          stream: new PassThrough()
        },
        {
          fieldname: 'test',
          buffer: Buffer.from('xyz')
        }
      ]
    },
    parseFiles: false
  });
  t.true(typeof obj.request.file === 'undefined');
  t.true(typeof obj.request.files === 'undefined');
});

test('hides authentication header', (t) => {
  let obj = parseRequest({
    req: {
      method: 'GET',
      headers: {
        authorization: 'Bearer foobar'
      }
    }
  });
  t.is(obj.request.headers.authorization, 'Bearer ******');

  obj = parseRequest({
    req: {
      method: 'GET',
      headers: {
        authorization: 'Bearer foobar foobar foobar'
      }
    }
  });
  t.is(obj.request.headers.authorization, 'Bearer ********************');
});

test('works with multer req.file and req.files', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      file: {
        fieldname: 'test',
        originalname: 'test',
        buffer: Buffer.from('abc')
      },
      files: [
        {
          fieldname: 'test',
          stream: new PassThrough()
        },
        {
          fieldname: 'test',
          buffer: Buffer.from('xyz')
        }
      ]
    }
  });
  const file = JSON.parse(obj.request.file);
  const files = JSON.parse(obj.request.files);
  t.deepEqual(file, {
    fieldname: 'test',
    originalname: 'test',
    buffer: { type: 'Buffer', byteLength: 3 }
  });
  t.deepEqual(files, [
    { fieldname: 'test', stream: { type: 'Stream' } },
    { fieldname: 'test', buffer: { type: 'Buffer', byteLength: 3 } }
  ]);
});

test('does not clone streams', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: {
        foo: new PassThrough()
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.deepEqual(body.foo, { type: 'Stream' });
});

test('does not clone buffers', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: {
        buffer: Buffer.from('bar'),
        beep: 'boop',
        baz: {
          some: 'thing',
          nested: [{ foo: 'bar' }, Buffer.from('beep')]
        },
        foo: [[new ArrayBuffer(6), [new ArrayBuffer(10)]]],
        boop: {
          baz: new ArrayBuffer(3),
          ox: [new ArrayBuffer(1), { deer: new ArrayBuffer(1) }]
        },
        duck: new ArrayBuffer(2)
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.deepEqual(body, {
    buffer: { type: 'Buffer', byteLength: 3 },
    beep: 'boop',
    baz: {
      some: 'thing',
      nested: [{ foo: 'bar' }, { type: 'Buffer', byteLength: 4 }]
    },
    foo: [
      [
        { type: 'ArrayBuffer', byteLength: 6 },
        [{ type: 'ArrayBuffer', byteLength: 10 }]
      ]
    ],
    boop: {
      baz: { type: 'ArrayBuffer', byteLength: 3 },
      ox: [
        { type: 'ArrayBuffer', byteLength: 1 },
        {
          deer: {
            type: 'ArrayBuffer',
            byteLength: 1
          }
        }
      ]
    },
    duck: { type: 'ArrayBuffer', byteLength: 2 }
  });
});

test('does not mask uuid', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: {
        foo: 'c51c80c2-66a1-442a-91e2-4f55b4256a72'
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.is(body.foo, 'c51c80c2-66a1-442a-91e2-4f55b4256a72');
});

test('does not mask cuid', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: {
        cuid: 'c4242-4242x4242*4242',
        notCuid: 'c2345'
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.deepEqual(body, {
    cuid: 'c4242-4242x4242*4242',
    notCuid: 'c2345'
  });
});

test('masks a string passed as body', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: '4242-4242-4242-4242'
    }
  });
  t.is(obj.request.body, '****-****-****-****');
});

test('masks an array passed as body', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: [
        {
          'card[number]': '0000000000000000'
        },
        [
          [
            {
              'card[number]': '0000000000000000'
            }
          ]
        ]
      ]
    }
  });
  const body = JSON.parse(obj.request.body);
  t.is(body[0]['card[number]'], '****************');
  t.is(body[1][0][0]['card[number]'], '****************');
});

test('does not mask specific objectid', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: {
        product: '5abbbacf04e4872d3ae344c1'
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.is(body.product, '5abbbacf04e4872d3ae344c1');
});

test('does not mask MongoDB ObjectId', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: {
        foo: '542f9cabed89afee4aaf2e61',
        baz: new ObjectId('542f9cabed89afee4aaf2e61')
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.is(body.foo, '542f9cabed89afee4aaf2e61');
  t.is(body.baz, '542f9cabed89afee4aaf2e61');
});

test('does not mask properties closely resembling a primary ID', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: {
        _id: '4242424242424242',
        id: '4242424242424242',
        ID: '4242424242424242',
        Id: '4242424242424242',
        product_id: '4242424242424242',
        'product-id': '4242424242424242',
        'product[id]': '4242424242424242',
        productId: '4242424242424242',
        productID: '4242424242424242'
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.deepEqual(body, {
    _id: '4242424242424242',
    id: '4242424242424242',
    ID: '4242424242424242',
    Id: '4242424242424242',
    product_id: '4242424242424242',
    'product-id': '4242424242424242',
    'product[id]': '4242424242424242',
    productId: '4242424242424242',
    productID: '4242424242424242'
  });
});

test('hides credit card number', (t) => {
  const obj = parseRequest({
    req: {
      method: 'POST',
      body: {
        'card[number]': '0000000000000000',
        myVisaCard: '4242-4242x4242*4242',
        // <https://stripe.com/docs/testing#cards>
        amex: '3714 496 3539 8431',
        jcb: '35 66 00 20 20 36 05 05',
        foo: [
          {
            baz: ['4242-4242x4242*4242']
          },
          {
            beep: '4242-4242x4242*4242'
          },
          '4242-4242x4242*4242'
        ]
      }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.is(body['card[number]'], '****************');
  t.is(body.myVisaCard, '****-****x*********');
  t.is(body.amex, '**** *** **** ****');
  t.is(body.jcb, '** ** ** ** ** ** ** **');
  t.is(body.foo[0].baz[0], '****-****x*********');
  t.is(body.foo[1].beep, '****-****x*********');
  t.is(body.foo[2], '****-****x*********');
});

test('GET/HEAD empty String `request.body`', (t) => {
  t.is(
    parseRequest({
      req: {
        method: 'GET',
        body: 'hello world'
      }
    }).request.body,
    undefined
  );
  t.is(
    parseRequest({
      req: {
        method: 'HEAD',
        body: 'hello world'
      }
    }).request.body,
    undefined
  );
});

test('POST with Object is parsed to `request.body`', (t) => {
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

test('POST with Number is parsed to `request.body`', (t) => {
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

test('POST with String is parsed to `request.body`', (t) => {
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

test('parses user object', (t) => {
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

test('parses ip address', (t) => {
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

test('preserves error code', (t) => {
  const err = new Error('oops');
  err.code = 1;
  const obj = parseRequest({
    req: {
      body: { err }
    }
  });
  const body = JSON.parse(obj.request.body);
  t.is(body.err.code, 1);
});
