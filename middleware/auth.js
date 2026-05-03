'use strict';

export function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

export function requireAdmin(req, res, next) {
  if (req.session?.role === 'admin') return next();
  res.status(403).redirect('/secure-admin/login');
}
