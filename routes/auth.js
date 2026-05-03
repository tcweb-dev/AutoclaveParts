'use strict';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import Customer from '../models/Customer.js';
import AuditLog from '../models/AuditLog.js';
import { logger } from '../config/logger.js';
import { requireAuth } from '../middleware/auth.js';
import {
  registerRules,
  loginRules,
  handleValidation,
} from '../middleware/validate.js';

const router = Router();

/* ── Register ───────────────────────────────────────────────────────────────── */
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('register', { title: 'Create Account' });
});

router.post('/register', registerRules, handleValidation, async (req, res) => {
  try {
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
      req.session.oldInput = req.body;
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
      req.session.oldInput = req.body;
      return res.redirect('/register');
    }
    logger.error('Registration error', { err: err.message });
    res.status(500).render('500', { title: 'Server Error' });
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
    res.status(500).render('500', { title: 'Server Error' });
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
    res.status(500).render('500', { title: 'Server Error' });
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
