const test = require('ava');

const parseRequest = require('../lib');

test('hides passwords', t => {
  const obj = parseRequest({
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
  });
  const body = JSON.parse(obj.request.body);
  t.is(body.password, '*****');
  t.is(body.some.deeply.nested.password, '*******');
  t.is(body.some.deeply.password, '****');
  t.is(body.some.baz.password.password, '****');
});
