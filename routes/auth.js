'use strict';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import Customer from '../models/Customer.js';
import AuditLog from '../models/AuditLog.js';
import { logger } from '../config/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { renderServerError } from '../utils/renderServerError.js';
import {
  registerRules,
  loginRules,
  handleValidation,
} from '../middleware/validate.js';

const router = Router();

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const RECAPTCHA_TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

function getRecaptchaConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const siteKey =
    process.env.RECAPTCHA_SITE_KEY ||
    (isProduction ? '' : RECAPTCHA_TEST_SITE_KEY);
  const secretKey =
    process.env.RECAPTCHA_SECRET_KEY ||
    (isProduction ? '' : RECAPTCHA_TEST_SECRET_KEY);

  return {
    enabled: Boolean(siteKey && secretKey),
    siteKey,
    secretKey,
  };
}

async function verifyRecaptcha({ token, secretKey, remoteIp }) {
  if (!token || !secretKey) return false;

  const payload = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  if (remoteIp) payload.set('remoteip', remoteIp);

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

function buildRegisterOldInput(body) {
  return {
    firstName: body.firstName || '',
    lastName: body.lastName || '',
    email: body.email || '',
    phone: body.phone || '',
    companyName: body.companyName || '',
    companyWebsite: body.companyWebsite || '',
  };
}

/* ── Register ───────────────────────────────────────────────────────────────── */
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  const recaptcha = getRecaptchaConfig();
  res.render('register', {
    title: 'Create Account',
    recaptchaEnabled: recaptcha.enabled,
    recaptchaSiteKey: recaptcha.siteKey,
  });
});

router.post('/register', registerRules, handleValidation, async (req, res) => {
  try {
    const recaptcha = getRecaptchaConfig();
    if (process.env.NODE_ENV === 'production' && !recaptcha.enabled) {
      req.session.validationErrors = [
        {
          msg: 'Registration is temporarily unavailable. Please contact support.',
        },
      ];
      req.session.oldInput = buildRegisterOldInput(req.body);
      return res.redirect('/register');
    }

    if (recaptcha.enabled) {
      const captchaToken = req.body['g-recaptcha-response'];
      const isCaptchaValid = await verifyRecaptcha({
        token: captchaToken,
        secretKey: recaptcha.secretKey,
        remoteIp: req.ip,
      });

      if (!isCaptchaValid) {
        req.session.validationErrors = [
          { msg: 'Please confirm you are not a robot and try again.' },
        ];
        req.session.oldInput = buildRegisterOldInput(req.body);
        return res.redirect('/register');
      }
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      companyWebsite,
      password,
    } = req.body;
    const existing = await Customer.findOne({ email });
    if (existing) {
      req.session.validationErrors = [
        { msg: 'An account with that email already exists.' },
      ];
      req.session.oldInput = buildRegisterOldInput(req.body);
      return res.redirect('/register');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const customer = await Customer.create({
      firstName,
      lastName,
      email,
      phone,
      companyName,
      companyWebsite,
      passwordHash,
    });

    await new Promise((resolve, reject) => {
      req.session.regenerate((sessionErr) => {
        if (sessionErr) return reject(sessionErr);
        req.session.userId = customer._id.toString();
        req.session.role = customer.role;
        req.session.firstName = customer.firstName;
        resolve();
      });
    });

    await AuditLog.create({
      userId: customer._id,
      action: 'register',
      meta: { email },
      ip: req.ip,
    });
    logger.info('New customer registered', { email });
    res.redirect('/dashboard');
  } catch (err) {
    if (err?.code === 11000) {
      req.session.validationErrors = [
        { msg: 'An account with that email already exists.' },
      ];
      req.session.oldInput = buildRegisterOldInput(req.body);
      return res.redirect('/register');
    }
    logger.error('Registration error', { err: err.message });
    renderServerError(req, res, err);
  }
});

/* ── Login ──────────────────────────────────────────────────────────────────── */
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('login', { title: 'Login' });
});

router.post('/login', loginRules, handleValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    const customer = await Customer.findOne({ email, role: 'customer' });
    if (!customer || !(await bcrypt.compare(password, customer.passwordHash))) {
      req.session.validationErrors = [{ msg: 'Invalid email or password.' }];
      req.session.oldInput = { email };
      return res.redirect('/login');
    }

    if (!customer.isActive) {
      req.session.validationErrors = [
        { msg: 'Your account is inactive. Please contact support.' },
      ];
      req.session.oldInput = { email };
      return res.redirect('/login');
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((sessionErr) => {
        if (sessionErr) return reject(sessionErr);
        req.session.userId = customer._id.toString();
        req.session.role = customer.role;
        req.session.firstName = customer.firstName;
        resolve();
      });
    });

    customer.lastLogin = new Date();
    await customer.save();
    await AuditLog.create({
      userId: customer._id,
      action: 'login',
      meta: { email },
      ip: req.ip,
    });
    logger.info('Customer login', { email });
    const returnTo = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    logger.error('Login error', { err: err.message });
    renderServerError(req, res, err);
  }
});

/* ── Profile ────────────────────────────────────────────────────────────────── */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.session.userId)
      .select('-passwordHash')
      .lean();

    if (!customer) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/login');
      });
      return;
    }

    res.render('profile', {
      title: 'My Profile',
      customer,
    });
  } catch (err) {
    logger.error('Profile view error', { err: err.message });
    renderServerError(req, res, err);
  }
});

/* ── Logout ─────────────────────────────────────────────────────────────────── */
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

export default router;
