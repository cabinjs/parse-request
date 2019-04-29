const Url = require('url-parse');
const cookie = require('cookie');
const safeStringify = require('fast-safe-stringify');
// <https://lacke.mn/reduce-your-bundle-js-file-size/>
// <https://github.com/lodash/babel-plugin-lodash/issues/221>
const pick = require('lodash/pick');
const isString = require('lodash/isString');
const isObject = require('lodash/isObject');
const clone = require('lodash/clone');
const cloneDeep = require('lodash/cloneDeep');
const isUndefined = require('lodash/isUndefined');
const isNull = require('lodash/isNull');
const isFunction = require('lodash/isFunction');
const isEmpty = require('lodash/isEmpty');
const isFinite = require('lodash/isFinite');
const isArray = require('lodash/isArray');
const mapValues = require('lodash/mapValues');
const creditCardType = require('credit-card-type');
const sensitiveFields = require('sensitive-fields');

// <https://github.com/braintree/credit-card-type/issues/90>
function isCreditCard(val) {
  const digits = val.replace(/\D/g, '');
  const types = creditCardType(digits);
  if (!isArray(types) || isEmpty(types)) return false;
  let match = false;
  for (let t = 0; t < types.length; t++) {
    if (match) break;
    const type = types[t];
    // can match any one of the lengths
    if (!isArray(type.lengths) || isEmpty(type.lengths)) continue;
    for (let l = 0; l < type.lengths.length; l++) {
      const len = type.lengths[l];
      if (isFinite(len) && len === digits.length) {
        match = true;
        break;
      }
    }
  }

  return match;
}

// https://stackoverflow.com/a/39087474
function maskProps(obj, props, maskCreditCards = true, isHeaders = false) {
  return mapValues(obj, (val, key) => {
    if (isObject(val)) return maskProps(val, props, maskCreditCards, isHeaders);
    if (!isString(val)) return val;
    // if it was a credit card then replace all digits with asterisk
    if (!isHeaders && maskCreditCards && isCreditCard(val))
      return val.replace(/[^\D\s]/g, '*');
    if (!props.includes(key)) return val;
    // replace only the authentication <credentials> portion with asterisk
    // Authorization: <type> <credentials>
    if (isHeaders && key === 'Authorization')
      return `${val.split(' ')[0]} ${val
        .substring(val.indexOf(' ') + 1)
        .replace(/./g, '*')}`;
    return val.replace(/./g, '*');
  });
}

// inspired by raven's parseRequest
// eslint-disable-next-line complexity
const parseRequest = (config = {}) => {
  config = {
    req: {},
    userFields: ['id', 'email', 'full_name', 'ip_address'],
    sanitizeFields: sensitiveFields,
    sanitizeHeaders: ['Authorization'],
    maskCreditCards: true,
    ...config
  };

  const {
    req,
    userFields,
    sanitizeFields,
    sanitizeHeaders,
    maskCreditCards
  } = config;

  const headers = maskProps(
    req.headers || req.header || {},
    sanitizeHeaders,
    maskCreditCards,
    true
  );
  const method = req.method || 'GET';

  // inspired from `preserve-qs` package
  let originalUrl = '';
  if (isString(req.originalUrl)) ({ originalUrl } = req);
  else if (isString(req.url)) originalUrl = req.url;
  else if (process.browser)
    originalUrl = window.location.pathname + window.location.search;
  originalUrl = new Url(originalUrl);

  // parse query, path, and origin to prepare absolute Url
  const query = Url.qs.parse(originalUrl.query);
  const path =
    originalUrl.origin === 'null'
      ? originalUrl.pathname
      : `${originalUrl.origin}${originalUrl.pathname}`;
  const qs = Url.qs.stringify(query, true);
  const absoluteUrl = path + qs;

  // default to the user object
  let user = isObject(req.user)
    ? isFunction(req.user.toObject)
      ? req.user.toObject()
      : clone(req.user)
    : {};

  let ip = '';
  if (isString(req.ip)) ({ ip } = req);
  else if (isObject(req.connection) && isString(req.connection.remoteAddress))
    ip = req.connection.remoteAddress;
  if (ip && !isString(user.ip_address)) user.ip_address = ip;

  if (isArray(userFields) && !isEmpty(userFields))
    user = pick(user, userFields);

  // recursively search through user and filter out passwords from it
  user = maskProps(user, sanitizeFields, maskCreditCards);

  let body = '';
  const originalBody = req._originalBody || req.body;

  if (!['GET', 'HEAD'].includes(method) && !isUndefined(originalBody))
    body = isString(originalBody)
      ? clone(originalBody)
      : cloneDeep(originalBody);

  // recursively search through body and filter out passwords from it
  if (isObject(body)) body = maskProps(body, sanitizeFields, maskCreditCards);

  if (!isUndefined(body) && !isNull(body) && !isString(body))
    body = safeStringify(body);

  // populate user agent and referrer if
  // we're in a browser and they're unset
  if (process.browser) {
    // set user agent
    if (
      typeof window.navigator !== 'undefined' &&
      isObject(window.navigator) &&
      isString(window.navigator.userAgent) &&
      (!isString(headers['user-agent']) || !headers['user-agent'])
    )
      headers['user-agent'] = window.navigator.userAgent;
    if (typeof window.document !== 'undefined' && isObject(window.document)) {
      // set referrer
      if (
        isString(window.document.referrer) &&
        ((!isString(headers.referer) || !headers.referer) &&
          (!isString(headers.referrer) || !headers.referrer))
      )
        headers.referer = window.document.referrer;
      // set cookie
      if (
        isString(window.document.cookie) &&
        (!isString(headers.cookie) || !headers.cookie)
      )
        headers.cookie = window.document.cookie;
    }
  }

  // parse the cookies (if any were set)
  const cookies = cookie.parse(headers.cookie || '');

  return {
    request: {
      method,
      query,
      headers,
      cookies,
      body,
      url: absoluteUrl
    },
    user
  };
};

module.exports = parseRequest;
