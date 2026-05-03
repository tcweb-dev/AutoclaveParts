'use strict';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import indexRouter from './routes/index.js';
import authRouter from './routes/auth.js';
import advertiseRouter from './routes/advertise.js';
import paymentRouter from './routes/payment.js';
import dashboardRouter from './routes/dashboard.js';
import adminRouter from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  /* ── Security headers ──────────────────────────────────────────────────────── */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://js.stripe.com'],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://*.stripe.com'],
          frameSrc: ["'self'", 'https://js.stripe.com'],
          connectSrc: ["'self'", 'https://api.stripe.com'],
        },
      },
    }),
  );

  /* ── Rate limiting ─────────────────────────────────────────────────────────── */
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  const strictLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/login', strictLimit);
  app.use('/register', strictLimit);
  app.use('/secure-admin/login', strictLimit);

  /* ── CORS (same-origin only) ───────────────────────────────────────────────── */
  app.use(cors({ origin: false }));

  /* ── Body parsers ──────────────────────────────────────────────────────────── */
  // Stripe webhook needs the raw body for signature verification – must come before express.json
  app.use(
    '/payment/webhook',
    express.raw({ type: 'application/json', limit: '100kb' }),
  );
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: true, limit: '50kb' }));

  /* ── Session ───────────────────────────────────────────────────────────────── */
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 7 * 24 * 60 * 60,
      }),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  /* ── View engine ───────────────────────────────────────────────────────────── */
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  /* ── Static files ──────────────────────────────────────────────────────────── */
  app.use(
    express.static(path.join(__dirname, 'public'), {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    }),
  );

  /* ── Flash / locals middleware ─────────────────────────────────────────────── */
  app.use((req, res, next) => {
    res.locals.user = req.session.userId
      ? {
          id: req.session.userId,
          role: req.session.role,
          firstName: req.session.firstName,
        }
      : null;
    res.locals.currentPath = req.originalUrl || '/';
    res.locals.errors = req.session.validationErrors || [];
    res.locals.oldInput = req.session.oldInput || {};
    res.locals.flashSuccess = req.session.flashSuccess || null;
    res.locals.flashError = req.session.flashError || null;
    delete req.session.validationErrors;
    delete req.session.oldInput;
    delete req.session.flashSuccess;
    delete req.session.flashError;
    next();
  });

  /* ── Routes ────────────────────────────────────────────────────────────────── */
  app.use('/', indexRouter);
  app.use('/', authRouter);
  app.use('/advertise', advertiseRouter);
  app.use('/payment', paymentRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/secure-admin', adminRouter);

  /* ── 404 ───────────────────────────────────────────────────────────────────── */
  app.use((_req, res) =>
    res.status(404).render('404', { title: 'Page Not Found' }),
  );

  /* ── Global error handler ──────────────────────────────────────────────────── */
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).render('500', { title: 'Server Error' });
  });

  return app;
}
