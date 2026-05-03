'use strict';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Customer from '../models/Customer.js';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';
import SidebarItem from '../models/SidebarItem.js';
import AuditLog from '../models/AuditLog.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  adminLoginRules,
  sidebarItemRules,
  bulkEmailRules,
  handleValidation,
} from '../middleware/validate.js';
import { sendBulkEmail } from '../config/mailer.js';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

/* ── Admin Login ────────────────────────────────────────────────────────────── */
router.get('/login', (req, res) => {
  if (req.session.role === 'admin') return res.redirect('/secure-admin');
  res.render('admin/login', { title: 'Admin Login' });
});

router.post('/login', adminLoginRules, handleValidation, async (req, res) => {
  const { email, password } = req.body;
  const admin = await Customer.findOne({ email, role: 'admin' });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    await AuditLog.create({
      action: 'admin_login_failed',
      meta: { email },
      ip: req.ip,
    });
    req.session.validationErrors = [{ msg: 'Invalid credentials.' }];
    return res.redirect('/secure-admin/login');
  }
  req.session.userId = admin._id.toString();
  req.session.role = 'admin';
  req.session.firstName = admin.firstName;
  await AuditLog.create({
    userId: admin._id,
    action: 'admin_login',
    meta: { email },
    ip: req.ip,
  });
  logger.info('Admin logged in', { email });
  res.redirect('/secure-admin');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/secure-admin/login'));
});

/* ─── All routes below require admin ─────────────────────────────────────────── */
router.use(requireAdmin);

/* ── Dashboard ──────────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  const [
    pendingSlides,
    pendingGridAds,
    customers,
    activeCarousel,
    activeGrid,
    recentLogs,
  ] = await Promise.all([
    CarouselSlide.find({ status: 'pending' })
      .populate('customerId', 'firstName lastName email')
      .lean(),
    GridAd.find({ status: 'pending' })
      .populate('customerId', 'firstName lastName email')
      .lean(),
    Customer.find({ role: 'customer' })
      .select('-passwordHash')
      .sort('-createdAt')
      .lean(),
    CarouselSlide.find({ status: 'active' })
      .select('customerId companyName expiresAt')
      .lean(),
    GridAd.find({ status: 'active' })
      .select('customerId companyName expiresAt')
      .lean(),
    AuditLog.find().sort('-createdAt').limit(100).lean(),
  ]);

  // Build a map of customerId -> active ads for quick lookup in the view
  const activeAdsByCustomer = {};
  activeCarousel.forEach((ad) => {
    const key = ad.customerId.toString();
    if (!activeAdsByCustomer[key]) activeAdsByCustomer[key] = [];
    activeAdsByCustomer[key].push({
      type: 'Carousel',
      companyName: ad.companyName,
      expiresAt: ad.expiresAt,
    });
  });
  activeGrid.forEach((ad) => {
    const key = ad.customerId.toString();
    if (!activeAdsByCustomer[key]) activeAdsByCustomer[key] = [];
    activeAdsByCustomer[key].push({
      type: 'Grid',
      companyName: ad.companyName,
      expiresAt: ad.expiresAt,
    });
  });

  res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    pendingSlides,
    pendingGridAds,
    customers,
    activeAdsByCustomer,
    recentLogs,
  });
});

/* ── Approve / Remove slides ────────────────────────────────────────────────── */
router.post('/slides/:type/:id/approve', async (req, res) => {
  const { type, id } = req.params;
  const Model = type === 'carousel' ? CarouselSlide : GridAd;
  await Model.findByIdAndUpdate(id, { status: 'active' });
  await AuditLog.create({
    userId: req.session.userId,
    action: `${type}_approved`,
    meta: { adId: id },
    ip: req.ip,
  });
  logger.info('Ad approved by admin', { type, adId: id });
  req.session.flashSuccess = 'Ad approved and now live.';
  res.redirect('/secure-admin');
});

router.post('/slides/:type/:id/remove', async (req, res) => {
  const { type, id } = req.params;
  const Model = type === 'carousel' ? CarouselSlide : GridAd;
  const ad = await Model.findByIdAndUpdate(
    id,
    { status: 'cancelled' },
    { new: true },
  );
  await AuditLog.create({
    userId: req.session.userId,
    action: `${type}_removed_by_admin`,
    meta: { adId: id },
    ip: req.ip,
  });
  logger.info('Ad removed by admin', { type, adId: id });
  req.session.flashSuccess = 'Ad removed.';
  res.redirect('/secure-admin');
});

/* ── Sidebar ────────────────────────────────────────────────────────────────── */
router.get('/sidebar', async (req, res) => {
  const items = await SidebarItem.find().sort('order').lean();
  res.render('admin/sidebar', { title: 'Manage Sidebar', items });
});

router.post(
  '/sidebar',
  sidebarItemRules,
  handleValidation,
  async (req, res) => {
    const { label, hrefUrl, order } = req.body;
    await SidebarItem.create({
      label,
      hrefUrl: hrefUrl || '',
      order: Number(order) || 0,
    });
    await AuditLog.create({
      userId: req.session.userId,
      action: 'sidebar_item_added',
      meta: { label },
      ip: req.ip,
    });
    req.session.flashSuccess = 'Sidebar item added.';
    res.redirect('/secure-admin/sidebar');
  },
);

router.post('/sidebar/:id/delete', async (req, res) => {
  await SidebarItem.findByIdAndDelete(req.params.id);
  await AuditLog.create({
    userId: req.session.userId,
    action: 'sidebar_item_removed',
    meta: { id: req.params.id },
    ip: req.ip,
  });
  req.session.flashSuccess = 'Sidebar item removed.';
  res.redirect('/secure-admin/sidebar');
});

/* ── Logs viewer ────────────────────────────────────────────────────────────── */
router.get('/logs', async (req, res) => {
  const logFile = path.join(__dirname, '..', 'logs', 'combined.log');
  let logContent = '';
  try {
    const raw = fs.readFileSync(logFile, 'utf8');
    // Return last 200 lines
    logContent = raw.split('\n').filter(Boolean).slice(-200).join('\n');
  } catch {
    logContent = 'No log file found yet.';
  }
  res.render('admin/logs', { title: 'Audit Logs', logContent });
});

/* ── Bulk Email ─────────────────────────────────────────────────────────────── */
router.get('/email', (req, res) => {
  res.render('admin/email', { title: 'Send Bulk Email' });
});

router.post('/email', bulkEmailRules, handleValidation, async (req, res) => {
  const { subject, bodyText, bodyHtml } = req.body;
  const customers = await Customer.find({ role: 'customer', isActive: true })
    .select('email')
    .lean();
  const recipients = customers.map((c) => c.email);
  if (!recipients.length) {
    req.session.flashError = 'No active customers found.';
    return res.redirect('/secure-admin/email');
  }
  const { sent, failed } = await sendBulkEmail({
    subject,
    text: bodyText,
    html: bodyHtml || `<p>${bodyText}</p>`,
    recipients,
  });
  await AuditLog.create({
    userId: req.session.userId,
    action: 'bulk_email_sent',
    meta: { subject, sent, failed, total: recipients.length },
    ip: req.ip,
  });
  logger.info('Admin bulk email', { subject, sent, failed });
  req.session.flashSuccess = `Bulk email sent: ${sent} delivered, ${failed} failed.`;
  res.redirect('/secure-admin/email');
});

/* ── Dev test page ──────────────────────────────────────────────────────────── */
router.get('/test', (req, res) => {
  if (process.env.NODE_ENV !== 'development')
    return res.status(404).render('404', { title: 'Not Found' });
  res.render('admin/test', { title: 'Dev Test Tools' });
});

router.post('/test/seed', async (req, res) => {
  if (process.env.NODE_ENV !== 'development')
    return res.status(404).send('Not found');
  await import('../scripts/seed.js').then((m) => m.seed());
  req.session.flashSuccess = 'Test data seeded.';
  res.redirect('/secure-admin/test');
});

export default router;
