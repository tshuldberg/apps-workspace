import pino from 'pino';

// ── PII redaction paths ──────────────��────────────────────���──────────────────
// Redacts sensitive fields from log output to prevent PII leakage.
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'body.password',
  'body.email',
  'body.adminPassword',
];

// ── Logger factory ───────────────────────────────────────────���───────────────
// Creates a pino logger. Pass an optional destination stream for testing.
export function createLogger(destination) {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: REDACT_PATHS,
    timestamp: pino.stdTimeFunctions.isoTime,
  }, destination);
}

// ── Default logger instance (writes to stdout) ───────��──────────────────────
export const logger = createLogger();

// ── Request logging middleware factory ──��─────────────────────────────────────
// Creates Express middleware that logs method, path, statusCode, responseTime.
// Pass a custom logger for testing; defaults to the module-level logger.
export function createRequestLogger(loggerInstance = logger) {
  return function requestLoggerMiddleware(req, res, next) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationNs = Number(process.hrtime.bigint() - start);
      const responseTimeMs = Math.round(durationNs / 1e6);

      loggerInstance.info({
        msg: 'request completed',
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTime: responseTimeMs,
      });
    });

    next();
  };
}

// ── Default request logger middleware ─────���──────────────────────────────────
export const requestLogger = createRequestLogger();
