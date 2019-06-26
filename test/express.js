const path = require('path');

const test = require('ava');
const express = require('express');
const multer = require('multer');
const requestId = require('express-request-id');
const requestReceived = require('request-received');
const responseTime = require('response-time');
const supertest = require('supertest');
const Cabin = require('cabin');

const parseRequest = require('..');

const fixtures = path.join(__dirname, 'fixtures');
const upload = multer();

test.beforeEach.cb(t => {
  const app = express();
  const cabin = new Cabin();
  app.use(requestReceived);
  app.use(responseTime());
  app.use(requestId());
  app.use(cabin.middleware);
  console.log('cabin', cabin);
  console.log('cabin.config', cabin.config);
  t.context.app = app;
  t.context.server = app.listen(() => {
    t.end();
  });
});

test.cb('express', t => {
  t.context.app.post(
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
      const obj = parseRequest({ req });
      req.logger.info('visited home page');
      res.json(obj);
    }
  );
  const request = supertest(t.context.server);
  request
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
    .set('Cookie', ['foo=bar;beep=boop'])
    .end((err, res) => {
      t.is(err, null);
      t.true(typeof res.body.request.timestamp === 'string');
      t.end();
    });
});
