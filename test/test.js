const { PassThrough } = require('stream');
const test = require('ava');

const ObjectId = require('bson-objectid');
const parseRequest = require('..');

test('hides passwords', t => {
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

test('works with multer req.file and req.files', t => {
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

test('does not clone streams', t => {
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

test('does not clone buffers', t => {
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
        foo: [[new ArrayBuffer(6), [new ArrayBuffer(10)]]]
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
    ]
  });
});

test('does not mask uuid', t => {
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

test('does not mask cuid', t => {
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

test('does not mask MongoDB ObjectID', t => {
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

test('does not mask properties closely resembling a primary ID', t => {
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

test('hides credit card number', t => {
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
