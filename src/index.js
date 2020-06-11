const ObjectId = require('bson-objectid');
const Url = require('url-parse');
const convertHrtime = require('convert-hrtime');
const cookie = require('cookie');
const creditCardType = require('credit-card-type');
const debug = require('debug')('parse-request');
const hrtime = require('browser-hrtime');
const httpHeaders = require('http-headers');
const isArrayBuffer = require('is-array-buffer');
const isBuffer = require('is-buffer');
const isStream = require('is-stream');
const isUUID = require('is-uuid');
const ms = require('ms');
const noCase = require('no-case');
const querystring = require('qs');
const rfdc = require('rfdc');
const safeStringify = require('fast-safe-stringify');
const sensitiveFields = require('sensitive-fields');

// https://github.com/cabinjs/request-received
const startTime = Symbol.for('request-received.startTime');
const pinoHttpStartTime = Symbol.for('pino-http.startTime');

const disableBodyParsingSymbol = Symbol.for('parse-request.disableBodyParsing');
const disableQueryParsingSymbol = Symbol.for(
  'parse-request.disableQueryParsing'
);
const disableFileParsingSymbol = Symbol.for('parse-request.disableFileParsing');

const hashMapIds = {
  _id: true,
  id: true
};

const regexId = /_id$/;

function maskArray(obj, options) {
  const arr = [];
  for (const [i, element] of obj.entries()) {
    arr[i] = maskSpecialTypes(element, options);
  }

  return arr;
}

function maskSpecialTypes(obj, options) {
  options = Object.assign(
    {
      maskBuffers: true,
      maskStreams: true,
      checkObjectId: true
    },
    options
  );
  if (typeof obj !== 'object') return obj;

  // we need to return an array if passed an array
  if (Array.isArray(obj)) return maskArray(obj, options);

  // if it was a bson objectid return early
  if (options.checkObjectId && ObjectId.isValid(obj)) return obj.toString();

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
  return typeof val === 'object' && val !== null && !Array.isArray(val);
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
  for (const type of types) {
    if (match) break;
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

function isID(val, options) {
  // if it was an objectid return early
  if (options.checkObjectId && ObjectId.isValid(val)) return true;

  // if it was a cuid return early
  // <https://github.com/ericelliott/cuid/issues/88#issuecomment-339848922>
  if (options.checkCuid && val.indexOf('c') === 0 && val.length >= 7)
    return true;

  // if it was a uuid v1-5 return early
  if (options.checkUUID && isUUID.anyNonNil(val)) return true;

  return false;
}

function maskString(key, val, props, options) {
  const isKeyString = isString(key);

  if (options.isHeaders) {
    // headers are case-insensitive
    props = props.map(prop => prop.toLowerCase());
    if (props.includes('referer') || props.includes('referrer')) {
      if (!props.includes('referer')) props.push('referer');
      if (!props.includes('referrer')) props.push('referrer');
    }
  }

  const notIncludedInProps = !isKeyString || !props.includes(key);

  if (!options.isHeaders) {
    // check if it closely resembles a primary ID and return early if so
    if (isKeyString && options.checkId) {
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

    // if it was an objectid, cuid, or uuid return early
    if (isID(val, options) && notIncludedInProps) return val;

    // if it was a credit card then replace all digits with asterisk
    if (options.maskCreditCards && isCreditCard(val))
      return val.replace(/[^\D\s]/g, '*');
  }

  if (notIncludedInProps) return val;

  // replace only the authentication <credentials> portion with asterisk
  // Authorization: <type> <credentials>
  if (options.isHeaders && key === 'authorization')
    return `${val.split(' ')[0]} ${val
      .slice(val.indexOf(' ') + 1)
      .replace(/./g, '*')}`;
  return val.replace(/./g, '*');
}

function headersToLowerCase(headers) {
  if (typeof headers !== 'object' || Array.isArray(headers)) return headers;
  const lowerCasedHeaders = {};
  for (const header in headers) {
    if (isString(headers[header]))
      lowerCasedHeaders[header.toLowerCase()] = headers[header];
  }

  return lowerCasedHeaders;
}

function maskProps(obj, props, options) {
  options = Object.assign(
    {
      maskCreditCards: true,
      isHeaders: false,
      checkId: true,
      checkCuid: true,
      checkObjectId: true,
      checkUUID: true
    },
    options
  );

  if (isString(obj)) return maskString(null, obj, props, options);

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
  const start = hrtime();
  const id = new ObjectId();

  config = Object.assign(
    {
      req: false,
      ctx: false,
      responseHeaders: '',
      userFields: ['id', 'email', 'full_name', 'ip_address'],
      sanitizeFields: sensitiveFields,
      sanitizeHeaders: ['authorization'],
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
      parseQuery: true,
      parseFiles: true
    },
    config
  );

  const clone = rfdc(config.rfdc);

  const {
    req,
    ctx,
    responseHeaders,
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
    parseQuery,
    parseFiles
  } = config;

  // do not allow both `req` and `ctx` to be specified
  if (req && ctx)
    throw new Error(
      'You must either use `req` (Express/Connect) or `ctx` (Koa) option, but not both'
    );

  const nodeReq = ctx ? ctx.req : req ? req : {};

  const maskPropsOptions = {
    maskCreditCards,
    checkId,
    checkCuid,
    checkObjectId,
    checkUUID
  };

  const maskSpecialTypesOptions = {
    maskBuffers,
    maskStreams,
    checkObjectId
  };

  const requestHeaders = nodeReq.headers;
  let headers;

  if (requestHeaders)
    headers = maskProps(headersToLowerCase(requestHeaders), sanitizeHeaders, {
      isHeaders: true
    });

  let method;
  if (ctx) method = ctx.method;
  else if (req) method = req.method;

  // inspired from `preserve-qs` package
  let originalUrl;
  if (ctx) originalUrl = ctx.originalUrl || ctx.url;
  else if (req) originalUrl = req.originalUrl || req.url;

  let query;
  let absoluteUrl;
  if (originalUrl) {
    originalUrl = new Url(originalUrl, {});

    // parse query, path, and origin to prepare absolute Url
    query = Url.qs.parse(originalUrl.query);
    const path =
      originalUrl.origin === 'null'
        ? originalUrl.pathname
        : `${originalUrl.origin}${originalUrl.pathname}`;
    const qs = Url.qs.stringify(query, true);
    absoluteUrl = path + qs;
  }

  // default to the user object
  let user = {};

  let parsedUser;
  if (ctx && isObject(ctx.state.user)) parsedUser = ctx.state.user;
  else if (req && isObject(req.user)) parsedUser = req.user;

  if (parsedUser) {
    try {
      user =
        typeof parsedUser.toJSON === 'function'
          ? parsedUser.toJSON()
          : typeof parsedUser.toObject === 'function'
          ? parsedUser.toObject()
          : clone(parsedUser);
    } catch (err) {
      debug(err);
      try {
        user = JSON.parse(safeStringify(parsedUser));
      } catch (err) {
        debug(err);
      }
    }
  }

  const ip = ctx ? ctx.ip : req ? req.ip : null;

  if (ip && !isString(user.ip_address)) user.ip_address = ip;

  if (user && Array.isArray(userFields) && userFields.length > 0)
    user = pick(user, userFields);

  // recursively search through user and filter out passwords from it
  if (user) user = maskProps(user, sanitizeFields, maskPropsOptions);

  let body;
  const originalBody = ctx
    ? ctx.request._originalBody || ctx.request.body
    : req
    ? req._originalBody || req.body
    : null;

  if (originalBody && parseBody && !nodeReq[disableBodyParsingSymbol]) {
    //
    // recursively search through body and filter out passwords from it
    // <https://github.com/niftylettuce/frisbee/issues/68>
    // <https://github.com/bitinn/node-fetch/blob/master/src/request.js#L75-L78>
    //
    if (!['GET', 'HEAD'].includes(method) && !isUndefined(originalBody))
      body = clone(
        maskBuffers || maskStreams
          ? maskSpecialTypes(originalBody, maskSpecialTypesOptions)
          : originalBody
      );
    body = maskProps(body, sanitizeFields, maskPropsOptions);
    if (!isUndefined(body) && !isNull(body) && !isString(body))
      body = safeStringify(body);
  }

  // parse the cookies (if any were set)
  let cookies;
  if (headers && headers.cookie) cookies = cookie.parse(headers.cookie);

  const result = {
    id: id.toString(),
    //
    // NOTE: regarding the naming convention of `timestamp`, it seems to be the
    // most widely used and supported property name across logging services
    //
    timestamp: id.getTimestamp().toISOString()
  };

  if (ctx || req) result.request = {};
  if (method) result.request.method = method;
  if (headers) result.request.headers = headers;
  if (cookies) result.request.cookies = cookies;
  if (absoluteUrl) result.request.url = absoluteUrl;
  if (user) result.user = user;

  if (query) {
    if (parseQuery && !nodeReq[disableQueryParsingSymbol])
      query = maskProps(querystring.parse(query), sanitizeFields);
    result.request.query = query;
  }

  if (originalBody && parseBody && body && !nodeReq[disableBodyParsingSymbol])
    result.request.body = body;

  //
  // Also note that there is no standard for setting a request received time.
  //
  // Examples:
  //
  // 1) koa-req-logger uses `ctx.start`
  // <https://github.com/DrBarnabus/koa-req-logger/blob/master/src/index.ts#L198>
  //
  // 2) morgan uses `req._startAt` and `req._startTime` which are not
  // req._startAt = process.hrtime()
  // req._startTime = new Date()
  // <https://github.com/expressjs/morgan/blob/master/index.js#L500-L508>
  //
  // 3) pino uses `Symbol('startTime')` but it does not expose it easily
  // <https://github.com/pinojs/pino-http/issues/65>
  //
  // 4) response-time does not expose anything
  // <https://github.com/expressjs/response-time/pull/18>
  //
  // Therefore we created `request-received` middleware that is required
  // to be used in order for `request.timestamp` to be populated with ISO-8601
  // <https://github.com/cabinjs/request-received>
  //
  // We also opened the following PR's in an attempt to make this a drop-in:
  //
  // * https://github.com/pinojs/pino-http/pull/67
  // * https://github.com/expressjs/morgan/pull/201
  // * https://github.com/expressjs/response-time/pull/20
  // * https://github.com/DataDog/node-connect-datadog/pull/7
  // * https://github.com/DrBarnabus/koa-req-logger/pull/2
  //

  // add request.timestamp (parse req[$x] variable)
  if (nodeReq[startTime] instanceof Date)
    result.request.timestamp = nodeReq[startTime].toISOString();
  else if (typeof nodeReq[startTime] === 'number')
    result.request.timestamp = new Date(nodeReq[startTime]).toISOString();
  else if (typeof nodeReq[pinoHttpStartTime] === 'number')
    result.request.timestamp = new Date(
      nodeReq[pinoHttpStartTime]
    ).toISOString();
  else if (nodeReq._startTime instanceof Date)
    result.request.timestamp = nodeReq._startTime.toISOString();
  else if (typeof nodeReq._startTime === 'number')
    result.request.timestamp = new Date(nodeReq._startTime).toISOString();

  //
  // conditionally add a `response` object if and only if
  // `responseHeaders` option was passed, and it was a non-empty string or object
  //

  if (isObject(responseHeaders) && Object.keys(responseHeaders).length > 0) {
    result.response = {};
    result.response.headers = clone(responseHeaders);
  } else if (isString(responseHeaders)) {
    // <https://github.com/nodejs/node/issues/28302>
    const parsedHeaders = httpHeaders(responseHeaders);
    result.response = {};
    if (isObject(parsedHeaders.headers)) {
      result.response.headers = parsedHeaders.headers;
      // parse the status line
      // <https://www.w3.org/Protocols/rfc2616/rfc2616-sec6.html#sec6.1>
      if (
        isObject(parsedHeaders.version) &&
        typeof parsedHeaders.version.major === 'number' &&
        typeof parsedHeaders.version.minor === 'number'
      )
        result.response.http_version = `${parsedHeaders.version.major}.${parsedHeaders.version.minor}`;
      if (typeof parsedHeaders.statusCode === 'number')
        result.response.status_code = parsedHeaders.statusCode;
      if (isString(parsedHeaders.statusMessage))
        result.response.reason_phrase = parsedHeaders.statusMessage;
    } else {
      result.response.headers = parsedHeaders;
    }
  }

  if (result.response && result.response.headers) {
    result.response.headers = maskProps(
      headersToLowerCase(result.response.headers),
      sanitizeHeaders,
      { isHeaders: true }
    );
    if (
      result.response.headers &&
      Object.keys(result.response.headers).length === 0
    ) {
      delete result.response;
    } else {
      // add response.timestamp (response Date header)
      try {
        if (result.response.headers.date)
          result.response.timestamp = new Date(
            result.response.headers.date
          ).toISOString();
      } catch (err) {
        debug(err);
      }

      // add response.duration (parsed from response X-Response-Time header)
      try {
        if (result.response.headers['x-response-time']) {
          const duration = ms(result.response.headers['x-response-time']);
          if (typeof duration === 'number') result.response.duration = duration;
        }
      } catch (err) {
        debug(err);
      }
    }
  }

  // add request's id if available from `req.id`
  let requestId;
  if (ctx) {
    if (isString(ctx.id)) requestId = ctx.id;
    else if (isString(ctx.request.id)) requestId = ctx.request.id;
    else if (isString(ctx.req.id)) requestId = ctx.req.id;
    else if (isString(ctx.state.reqId)) requestId = ctx.state.reqId;
    else if (isString(ctx.state.id)) requestId = ctx.state.id;
  } else if (req && isString(req.id)) {
    requestId = req.id;
  }

  // TODO: we should probably validate this id somehow
  // (e.g. like we do with checking if cuid or uuid or objectid)
  if (requestId) result.request.id = requestId;
  else if (headers && headers['x-request-id'])
    result.request.id = headers['x-request-id'];

  // add httpVersion if possible (server-side only)
  const { httpVersion, httpVersionMajor, httpVersionMinor } = nodeReq;

  if (isString(httpVersion)) result.request.http_version = httpVersion;
  else if (
    (typeof httpVersionMajor === 'number' &&
      typeof httpVersionMinor === 'number') ||
    (isString(httpVersionMajor) && isString(httpVersionMinor))
  )
    result.request.http_version = `${httpVersionMajor}.${httpVersionMinor}`;

  // parse `req.file` and `req.files` for multer v1.x and v2.x
  if (parseFiles && !nodeReq[disableFileParsingSymbol]) {
    // koa-multer@1.x binded to `ctx.req`
    // and then koa-multer was forked by @niftylettuce to @koajs/multer
    // and the 2.0.0 release changed it so it uses `ctx.file` and `ctx.files`
    // (so it doesn't bind to the `ctx.req` Node original request object
    // <https://github.com/koa-modules/multer/pull/15>
    let file;
    let files;
    if (ctx) {
      file = ctx.file || ctx.request.file || ctx.req.file;
      files = ctx.files || ctx.request.files || ctx.req.files;
    } else if (req) {
      file = req.file;
      files = req.files;
    }

    if (typeof file === 'object')
      result.request.file = safeStringify(
        clone(maskSpecialTypes(file, maskSpecialTypesOptions))
      );
    if (typeof files === 'object')
      result.request.files = safeStringify(
        clone(maskSpecialTypes(files, maskSpecialTypesOptions))
      );
  }

  result.duration = convertHrtime(hrtime(start)).milliseconds;

  return result;
};

module.exports = parseRequest;
