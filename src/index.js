const Url = require('url-parse');
const cookie = require('cookie');
const creditCardType = require('credit-card-type');
const isArrayBuffer = require('is-array-buffer');
const isBuffer = require('is-buffer');
const isUUID = require('is-uuid');
const objectId = require('validate-objectid');
const rfdc = require('rfdc');
const safeStringify = require('fast-safe-stringify');
const sensitiveFields = require('sensitive-fields');
const isStream = require('is-stream');
const noCase = require('no-case');

const hashMapIds = {
  _id: true,
  id: true
};

const regexId = /_id$/;

function maskSpecialTypes(obj, options) {
  options = {
    maskBuffers: true,
    maskStreams: true,
    checkObjectId: true,
    ...options
  };
  if (typeof obj !== 'object') return obj;

  // we need to return an array if passed an array
  if (Array.isArray(obj)) {
    const arr = [];
    for (let i = 0; i < obj.length; i++) {
      arr[i] = maskSpecialTypes(obj[i], options);
    }

    return arr;
  }

  // if it was a bson objectid return early
  if (options.checkObjectId && objectId(obj)) return obj.toString();

  // check if it was a stream
  if (options.maskStreams && isStream(obj)) return { type: 'Stream' };

  // check if it was a buffer or array buffer
  // before iterating over the object's keys
  if (options.maskBuffers) {
    if (isBuffer(obj))
      return {
        type: 'Buffer',
        byteLength: obj.byteLength
      };

    if (isArrayBuffer(obj))
      return {
        type: 'ArrayBuffer',
        byteLength: obj.byteLength
      };
  }

  // we need to return an object if passed an object
  const masked = {};
  // for...in is much faster than Object.entries or any alternative
  // TODO: we should optimize this further in the future
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      if (Array.isArray(obj[key])) {
        masked[key] = maskSpecialTypes(obj[key], options);
      } else if (options.maskStreams && isStream(obj[key])) {
        masked[key] = { type: 'Stream' };
      } else if (options.maskBuffers && isBuffer(obj[key])) {
        masked[key] = {
          type: 'Buffer',
          byteLength: obj[key].byteLength
        };
      } else if (options.maskBuffers && isArrayBuffer(obj[key])) {
        masked[key] = {
          type: 'ArrayBuffer',
          byteLength: obj[key].byteLength
        };
      } else {
        masked[key] = maskSpecialTypes(obj[key], options);
      }
    } else {
      masked[key] = obj[key];
    }
  }

  return masked;
}

function pick(object, keys) {
  return keys.reduce((obj, key) => {
    if (object && Object.prototype.hasOwnProperty.call(object, key)) {
      obj[key] = object[key];
    }

    return obj;
  }, {});
}

function isNull(val) {
  return val === null;
}

function isUndefined(val) {
  return typeof val === 'undefined';
}

function isObject(val) {
  return typeof val === 'object' && !Array.isArray(val);
}

function isString(val) {
  return typeof val === 'string';
}

// <https://github.com/braintree/credit-card-type/issues/90>
function isCreditCard(val) {
  const digits = val.replace(/\D/g, '');
  const types = creditCardType(digits);
  if (!Array.isArray(types) || types.length === 0) return false;
  let match = false;
  for (let t = 0; t < types.length; t++) {
    if (match) break;
    const type = types[t];
    // can match any one of the lengths
    if (!Array.isArray(type.lengths) || type.lengths.length === 0) continue;
    for (let l = 0; l < type.lengths.length; l++) {
      const len = type.lengths[l];
      if (Number.isFinite(len) && len === digits.length) {
        match = true;
        break;
      }
    }
  }

  return match;
}

function maskString(key, val, props, options) {
  if (!options.isHeaders) {
    // check if it closely resembles a primary ID and return early if so
    if (options.checkId) {
      // _id
      // id
      // ID
      // Id
      if (hashMapIds[key.toLowerCase()]) return val;
      // product_id
      // product-id
      // product[id]
      // productId
      // productID
      const snakeCase = noCase(key, null, '_');
      if (regexId.test(snakeCase)) return val;
    }

    // if it was a cuid return early
    // <https://github.com/ericelliott/cuid/issues/88#issuecomment-339848922>
    if (options.checkCuid && val.indexOf('c') === 0 && val.length >= 7)
      return val;

    // if it was a uuid v1-5 return early
    if (options.checkUUID && isUUID.anyNonNil(val)) return val;

    // if it was a credit card then replace all digits with asterisk
    if (options.maskCreditCards && isCreditCard(val))
      return val.replace(/[^\D\s]/g, '*');
  }

  if (props.indexOf(key) === -1) return val;
  // replace only the authentication <credentials> portion with asterisk
  // Authorization: <type> <credentials>
  if (options.isHeaders && key === 'Authorization')
    return `${val.split(' ')[0]} ${val
      .substring(val.indexOf(' ') + 1)
      .replace(/./g, '*')}`;
  return val.replace(/./g, '*');
}

function maskProps(obj, props, options) {
  options = {
    maskCreditCards: true,
    isHeaders: false,
    checkId: true,
    checkCuid: true,
    checkUUID: true,
    ...options
  };
  // for...in is much faster than Object.entries or any alternative
  for (const key in obj) {
    if (typeof obj[key] === 'object')
      obj[key] = maskProps(obj[key], props, options);
    else if (isString(obj[key]))
      obj[key] = maskString(key, obj[key], props, options);
  }

  return obj;
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
    maskBuffers: true,
    maskStreams: true,
    checkId: true,
    checkCuid: true,
    checkObjectId: true,
    checkUUID: true,
    // <https://github.com/davidmarkclements/rfdc>
    rfdc: {
      proto: false,
      circles: false
    },
    parseBody: true,
    parseFiles: true,
    ...config
  };

  const clone = rfdc(config.rfdc);

  const {
    req,
    userFields,
    sanitizeFields,
    sanitizeHeaders,
    maskCreditCards,
    maskBuffers,
    maskStreams,
    checkId,
    checkCuid,
    checkObjectId,
    checkUUID,
    parseBody,
    parseFiles
  } = config;

  const maskPropsOptions = {
    maskCreditCards,
    checkId,
    checkCuid,
    checkUUID
  };

  const maskSpecialTypesOptions = {
    maskBuffers,
    maskStreams,
    checkObjectId
  };

  const headers = maskProps(req.headers || req.header || {}, sanitizeHeaders, {
    isHeaders: true
  });
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
    ? typeof req.user.toObject === 'function'
      ? req.user.toObject()
      : clone(req.user)
    : {};

  let ip = '';
  if (isString(req.ip)) ({ ip } = req);
  else if (isObject(req.connection) && isString(req.connection.remoteAddress))
    ip = req.connection.remoteAddress;
  if (ip && !isString(user.ip_address)) user.ip_address = ip;

  if (Array.isArray(userFields) && userFields.length > 0)
    user = pick(user, userFields);

  // recursively search through user and filter out passwords from it
  user = maskProps(user, sanitizeFields, maskPropsOptions);

  let body = '';
  const originalBody = req._originalBody || req.body;

  if (parseBody) {
    // <https://github.com/niftylettuce/frisbee/issues/68>
    // <https://github.com/bitinn/node-fetch/blob/master/src/request.js#L75-L78>
    if (['GET', 'HEAD'].indexOf(method) === -1 && !isUndefined(originalBody))
      body = clone(
        maskBuffers || maskStreams
          ? maskSpecialTypes(originalBody, maskSpecialTypesOptions)
          : originalBody
      );

    // recursively search through body and filter out passwords from it
    if (isObject(body))
      body = maskProps(body, sanitizeFields, maskPropsOptions);

    if (!isUndefined(body) && !isNull(body) && !isString(body))
      body = safeStringify(body);
  } else {
    body = originalBody;
  }

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

  const result = {
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

  // parse `req.file` and `req.files` for multer v1.x and v2.x
  if (parseFiles) {
    if (typeof req.file === 'object')
      result.request.file = safeStringify(
        clone(maskSpecialTypes(req.file, maskSpecialTypesOptions))
      );
    if (Array.isArray(req.files))
      result.request.files = safeStringify(
        clone(maskSpecialTypes(req.files, maskSpecialTypesOptions))
      );
  }

  return result;
};

module.exports = parseRequest;
