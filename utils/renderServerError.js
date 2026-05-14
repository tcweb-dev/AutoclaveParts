'use strict';

function sanitizePublicErrorCode(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_.-]{2,40}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function renderServerError(req, res, err) {
  const errorCode = sanitizePublicErrorCode(err?.code || err?.name || null);

  return res.status(500).render('500', {
    title: 'Server Error',
    errorSummary:
      'We could not complete your request because the server encountered an unexpected condition.',
    errorCode,
    requestId: req.requestId || null,
    requestMethod: req.method || null,
    requestPath: req.originalUrl || req.path || null,
    requestTimeUtc: new Date().toISOString(),
  });
}
