const path = require('path');

const test = require('ava');
const Koa = require('koa');
const multer = require('@koa/multer');
const requestId = require('express-request-id');
const requestReceived = require('request-received');
const responseTime = require('response-time');
const Router = require('@koa/router');
const koaConnect = require('koa-connect');
const supertest = require('supertest');
const Cabin = require('cabin');
const { Signale } = require('signale');

const parseRequest = require('..');

const disableBodyParsing = Symbol.for('parse-request.disableBodyParsing');
const disableFileParsing = Symbol.for('parse-request.disableFileParsing');
const fixtures = path.join(__dirname, 'fixtures');
const upload = multer();

test.beforeEach.cb(t => {
  const app = new Koa();
  const cabin = new Cabin({
    axe: {
      logger: new Signale()
    }
  });
  app.use(requestReceived);
  app.use(koaConnect(responseTime()));
  app.use(koaConnect(requestId()));
  app.use(cabin.middleware);
  const router = new Router();
  router.post(
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
    ctx => {
      if (ctx.query._originalBody) ctx.request._originalBody = true;
      if (ctx.query.disableBodyParsing) ctx.req[disableBodyParsing] = true;
      if (ctx.query.disableFileParsing) ctx.req[disableFileParsing] = true;
      const obj = parseRequest({ ctx });
      ctx.logger.info('visited home page');
      ctx.body = obj;
    }
  );
  app.use(router.routes());
  app.use(router.allowedMethods());
  t.context.server = app.listen(() => {
    t.end();
  });
});

test.cb('koa', t => {
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
      t.true(typeof res.body.request.body === 'string');
      const files = JSON.parse(res.body.request.files);
      t.true(typeof files === 'object');
      t.true(typeof files.avatar === 'object' && Array.isArray(files.avatar));
      const body = JSON.parse(res.body.request.body);
      t.is(body.name, 'nifty');
      t.is(body.bank_account_number, '**********');
      t.is(body.card.number, '****-****-****-****');
      t.is(body.stripe_token, '***************');
      t.end();
    });
});

test.cb('koa with req._originalBody set', t => {
  const request = supertest(t.context.server);
  request
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
    .set('Cookie', ['foo=bar;beep=boop'])
    .end((err, res) => {
      t.is(err, null);
      t.true(typeof res.body.request.timestamp === 'string');
      t.is(res.body.request.body, 'true');
      t.end();
    });
});

test.cb('koa with body parsing disabled', t => {
  const request = supertest(t.context.server);
  request
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
    .set('Cookie', ['foo=bar;beep=boop'])
    .end((err, res) => {
      t.is(err, null);
      t.true(typeof res.body.request.timestamp === 'string');
      t.true(typeof res.body.request.body === 'undefined');
      t.end();
    });
});

test.cb('koa with file parsing disabled', t => {
  const request = supertest(t.context.server);
  request
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
    .set('Cookie', ['foo=bar;beep=boop'])
    .end((err, res) => {
      t.is(err, null);
      t.true(typeof res.body.request.timestamp === 'string');
      t.true(typeof res.body.request.files === 'undefined');
      t.end();
    });
});
