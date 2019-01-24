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
const isArray = require('lodash/isArray');
const mapValues = require('lodash/mapValues');

// https://stackoverflow.com/a/39087474
function maskPasswords(obj) {
  return mapValues(obj, (val, key) => {
    if (isObject(val)) return maskPasswords(val);
    return key === 'password' && isString(val)
      ? new Array(val.length + 1).join('*')
      : val;
  });
}

// inspired by raven's parseRequest
// eslint-disable-next-line complexity
const parseRequest = (
  originalReq = {},
  userFields = ['id', 'email', 'full_name', 'ip_address']
) => {
  const req = cloneDeep(
    pick(originalReq, [
      'method',
      'query',
      'cookies',
      'originalUrl',
      'url',
      'ip',
      'connection'
    ])
  );

  if (Object.prototype.hasOwnProperty.call(req, 'hostname') && originalReq.host)
    req.host = clone(originalReq.host);

  const headers = JSON.parse(
    safeStringify(originalReq.headers || originalReq.header || {})
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
  const query = isObject(req.query)
    ? req.query
    : Url.qs.parse(originalUrl.query);
  const path =
    originalUrl.origin === 'null'
      ? originalUrl.pathname
      : `${originalUrl.origin}${originalUrl.pathname}`;
  const qs = Url.qs.stringify(query, true);
  const absoluteUrl = path + qs;

  // default to the user object
  let user = isObject(originalReq.user)
    ? isFunction(originalReq.user.toObject)
      ? originalReq.user.toObject()
      : clone(originalReq.user)
    : {};

  let ip = '';
  if (isString(req.ip)) ({ ip } = req);
  else if (isObject(req.connection) && isString(req.connection.remoteAddress))
    ip = req.connection.remoteAddress;
  if (ip && !isString(user.ip_address)) user.ip_address = ip;

  if (isArray(userFields) && !isEmpty(userFields))
    user = pick(user, userFields);

  let body = '';

  if (!['GET', 'HEAD'].includes(method) && !isUndefined(originalReq.body))
    body = isString(originalReq.body)
      ? clone(originalReq.body)
      : cloneDeep(originalReq.body);

  // recursively search through body and filter out passwords from it
  if (isObject(body)) body = maskPasswords(body);

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
