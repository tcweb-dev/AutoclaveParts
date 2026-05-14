'use strict';

import Customer from '../models/Customer.js';

const ADMIN_IDLE_DEFAULT_MS = 5 * 60 * 1000; // 5 minutes

export function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

export async function requireAdmin(req, res, next) {
  try {
    if (req.session?.role !== 'admin') {
      return res.status(403).redirect('/secure-admin/login');
    }

    let idleMs = Number(req.session.adminIdleTimeout);
    if (!Number.isFinite(idleMs) || idleMs <= 0) {
      const admin = await Customer.findOne({
        _id: req.session.userId,
        role: 'admin',
      })
        .select('adminIdleTimeoutMs')
        .lean();
      idleMs =
        Number.isFinite(admin?.adminIdleTimeoutMs) &&
        admin.adminIdleTimeoutMs > 0
          ? admin.adminIdleTimeoutMs
          : ADMIN_IDLE_DEFAULT_MS;
      req.session.adminIdleTimeout = idleMs;
    }

    const now = Date.now();
    const last = req.session.adminLastActivity;

    if (last && now - last > idleMs) {
      req.session.destroy(() => {
        res.redirect('/secure-admin/login?reason=idle');
      });
      return;
    }

    req.session.adminLastActivity = now;
    next();
  } catch (err) {
    next(err);
  }
}
