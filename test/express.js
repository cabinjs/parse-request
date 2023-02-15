const path = require('node:path');

const test = require('ava');
const express = require('express');
const multer = require('@ladjs/multer');
const requestId = require('express-request-id');
const requestReceived = require('request-received');
const responseTime = require('response-time');
const supertest = require('supertest');
const Cabin = require('cabin');
const { Signale } = require('signale');
const getPort = require('get-port');

const parseRequest = require('..');

const disableBodyParsing = Symbol.for('parse-request.disableBodyParsing');
const disableFileParsing = Symbol.for('parse-request.disableFileParsing');
const fixtures = path.join(__dirname, 'fixtures');
const upload = multer();

test.beforeEach(async (t) => {
  const app = express();
  const cabin = new Cabin({
    axe: {
      logger: new Signale()
    }
  });
  app.use(requestReceived);
  app.use(responseTime());
  app.use(requestId());
  app.use(cabin.middleware);
  app.post(
    '/',
    upload.fields([
      {
        name: 'avatar',
        maxCount: 1
      },
      {
        name: 'boop',
        maxCount: 2
      }
    ]),
    (req, res) => {
      if (req.query._originalBody) req._originalBody = true;
      if (req.query.disableBodyParsing) req[disableBodyParsing] = true;
      if (req.query.disableFileParsing) req[disableFileParsing] = true;
      const obj = parseRequest({ req });
      req.logger.info('visited home page');
      res.json(obj);
    }
  );
  const port = await getPort();
  t.context.agent = supertest.agent(app.listen(port));
});

test('express', async (t) => {
  const res = await t.context.agent
    .post('/?foo=bar&beep=boop')
    .auth('user', 'password')
    .set('Accept', 'application/json')
    .field('product_id', '5d0350ef2ca74d11ee6e4f00')
    .field('name', 'nifty')
    .field('surname', 'lettuce')
    .field('bank_account_number', '1234567890')
    .field('card[number]', '4242-4242-4242-4242')
    .field('stripe_token', 'some-token-here')
    .field('favorite_color', 'green')
    .attach('avatar', path.join(fixtures, 'avatar.png'))
    .attach('boop', path.join(fixtures, 'boop-1.txt'))
    .attach('boop', path.join(fixtures, 'boop-2.txt'))
    .set('Cookie', ['foo=bar;beep=boop']);
  t.true(typeof res.body.request.timestamp === 'string');
  t.true(typeof res.body.request.body === 'string');
  const files = JSON.parse(res.body.request.files);
  t.true(typeof files === 'object');
  t.true(typeof files.avatar === 'object' && Array.isArray(files.avatar));
  const body = JSON.parse(res.body.request.body);
  t.is(body.name, 'nifty');
  t.is(body.bank_account_number, '**********');
  t.is(body.card.number, '****-****-****-****');
  t.is(body.stripe_token, '***************');
});

test('express with req._originalBody set', async (t) => {
  const res = await t.context.agent
    .post('/?_originalBody=true')
    .auth('user', 'password')
    .set('Accept', 'application/json')
    .field('product_id', '5d0350ef2ca74d11ee6e4f00')
    .field('name', 'nifty')
    .field('surname', 'lettuce')
    .field('bank_account_number', '1234567890')
    .field('card[number]', '4242-4242-4242-4242')
    .field('stripe_token', 'some-token-here')
    .field('favorite_color', 'green')
    .attach('avatar', path.join(fixtures, 'avatar.png'))
    .attach('boop', path.join(fixtures, 'boop-1.txt'))
    .attach('boop', path.join(fixtures, 'boop-2.txt'))
    .set('Cookie', ['foo=bar;beep=boop']);
  t.true(typeof res.body.request.timestamp === 'string');
  t.is(res.body.request.body, 'true');
});

test('express with body parsing disabled', async (t) => {
  const res = await t.context.agent
    .post('/?disableBodyParsing=true')
    .auth('user', 'password')
    .set('Accept', 'application/json')
    .field('product_id', '5d0350ef2ca74d11ee6e4f00')
    .field('name', 'nifty')
    .field('surname', 'lettuce')
    .field('bank_account_number', '1234567890')
    .field('card[number]', '4242-4242-4242-4242')
    .field('stripe_token', 'some-token-here')
    .field('favorite_color', 'green')
    .attach('avatar', path.join(fixtures, 'avatar.png'))
    .attach('boop', path.join(fixtures, 'boop-1.txt'))
    .attach('boop', path.join(fixtures, 'boop-2.txt'))
    .set('Cookie', ['foo=bar;beep=boop']);
  t.true(typeof res.body.request.timestamp === 'string');
  t.true(typeof res.body.request.body === 'undefined');
});

test('express with file parsing disabled', async (t) => {
  const res = await t.context.agent
    .post('/?disableFileParsing=true')
    .auth('user', 'password')
    .set('Accept', 'application/json')
    .field('product_id', '5d0350ef2ca74d11ee6e4f00')
    .field('name', 'nifty')
    .field('surname', 'lettuce')
    .field('bank_account_number', '1234567890')
    .field('card[number]', '4242-4242-4242-4242')
    .field('stripe_token', 'some-token-here')
    .field('favorite_color', 'green')
    .attach('avatar', path.join(fixtures, 'avatar.png'))
    .attach('boop', path.join(fixtures, 'boop-1.txt'))
    .attach('boop', path.join(fixtures, 'boop-2.txt'))
    .set('Cookie', ['foo=bar;beep=boop']);
  t.true(typeof res.body.request.timestamp === 'string');
  t.true(typeof res.body.request.files === 'undefined');
});
