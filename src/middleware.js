const isFunction = require('lodash/isFunction');
const isUndefined = require('lodash/isUndefined');
const onFinished = require('on-finished');
const parseRequest = require('parse-request');
const safeStringify = require('fast-safe-stringify');
const tmpl = require('lodash/template');

module.exports = function(...args) {
  const isExpress = !isUndefined(args[2]) && isFunction(args[2]);
  const req = isExpress ? args[0] : args[0].req;
  const res = isExpress ? args[1] : args[0].res;
  const next = isExpress ? args[2] : args[1];
  const logger = {};
  Object.keys(this.logger)
    .filter(key => isFunction(this.logger[key]))
    .forEach(key => {
      logger[key] = (...args) => {
        args[1] = this.parseArg(args[1]);
        // add `request` object to metadata
        Object.assign(args[1], parseRequest(req, this.config.userFields));
        this.logger[key](...[].slice.call(args));
      };
    });
  // store a copy of the request body
  // in case we modified it in our middleware
  // (a common practice unfortunately)
  const body = safeStringify(req.body);
  // upon completion of a response we need to log it
  onFinished(res, (err, res) => {
    if (err) return logger.error(err);
    let level = 'info';
    if (res.statusCode >= 500) level = 'error';
    else if (res.statusCode >= 400) level = 'warn';
    logger[level](
      tmpl(this.config.message, {
        ...this.config.templateSettings
      })({
        req: {
          ...req,
          body
        },
        res: isExpress ? res : args[0].response
      }).trim()
    );
  });
  // add `log` (shorthand) and `logger` methods
  // `req.log`
  // `res.log`
  // `ctx.req`
  // `ctx.res`
  // `ctx.request`
  // `ctx.response`
  // <https://github.com/pinojs/koa-pino-logger/issues/14>
  // <https://github.com/pinojs/koa-pino-logger/blob/master/logger.js#L11>
  // <https://github.com/pinojs/pino-http/blob/master/logger.js#L55>
  req.log = logger;
  res.log = logger;
  req.logger = logger;
  res.logger = logger;
  if (!isExpress) {
    const ctx = args[0];
    ctx.log = logger;
    ctx.logger = logger;
    ctx.request.log = logger;
    ctx.request.logger = logger;
    ctx.response.log = logger;
    ctx.response.logger = logger;
  }

  return next();
};
