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
import { decodeHtmlEntities } from '../utils/decodeHtmlEntities.js';
import { sendBulkEmail } from '../config/mailer.js';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

/* ── Admin Login ────────────────────────────────────────────────────────────── */
router.get('/login', (req, res) => {
  if (req.session.role === 'admin') return res.redirect('/secure-admin');
  res.render('admin/login', { title: 'Admin Login', query: req.query });
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
  req.session.adminIdleTimeout =
    Number.isFinite(admin.adminIdleTimeoutMs) && admin.adminIdleTimeoutMs > 0
      ? admin.adminIdleTimeoutMs
      : 5 * 60 * 1000;
  req.session.adminLastActivity = Date.now();
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
  req.session.destroy(() => res.redirect('/'));
});

/* ─── All routes below require admin ─────────────────────────────────────────── */
router.use(requireAdmin);

/* ── Dashboard ──────────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  const inactiveStatuses = ['paused', 'expired', 'cancelled'];
  const [
    pendingSlides,
    pendingGridAds,
    customers,
    activeCarousel,
    activeGrid,
    inactiveCarousel,
    inactiveGrid,
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
      .select('customerId companyName expiresAt picturePath picture2Path')
      .lean(),
    GridAd.find({ status: 'active' })
      .select('customerId companyName expiresAt picturePath picture2Path')
      .lean(),
    CarouselSlide.find({ status: { $in: inactiveStatuses } })
      .populate('customerId', 'firstName lastName email')
      .sort('-inactiveSince -updatedAt')
      .lean(),
    GridAd.find({ status: { $in: inactiveStatuses } })
      .populate('customerId', 'firstName lastName email')
      .sort('-inactiveSince -updatedAt')
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
      picturePath: ad.picturePath || '',
      picture2Path: ad.picture2Path || '',
    });
  });
  activeGrid.forEach((ad) => {
    const key = ad.customerId.toString();
    if (!activeAdsByCustomer[key]) activeAdsByCustomer[key] = [];
    activeAdsByCustomer[key].push({
      type: 'Grid',
      companyName: ad.companyName,
      expiresAt: ad.expiresAt,
      picturePath: ad.picturePath || '',
      picture2Path: ad.picture2Path || '',
    });
  });

  res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    pendingSlides,
    pendingGridAds,
    customers,
    activeAdsByCustomer,
    inactiveAds: [
      ...inactiveCarousel.map((ad) => ({ ...ad, type: 'carousel' })),
      ...inactiveGrid.map((ad) => ({ ...ad, type: 'grid' })),
    ].sort((a, b) => {
      const aDate = new Date(a.inactiveSince || a.updatedAt);
      const bDate = new Date(b.inactiveSince || b.updatedAt);
      return bDate - aDate;
    }),
    recentLogs,
  });
});

/* ── Approve / Remove slides ────────────────────────────────────────────────── */
router.post('/slides/:type/:id/approve', async (req, res) => {
  const { type, id } = req.params;
  const Model = type === 'carousel' ? CarouselSlide : GridAd;
  await Model.findByIdAndUpdate(id, {
    status: 'active',
    inactiveSince: null,
  });
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
    { status: 'cancelled', inactiveSince: new Date() },
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

/* ── Delete inactive ad ─────────────────────────────────────────────────────── */
router.post('/ads/:type/:id/delete', async (req, res) => {
  const { type, id } = req.params;
  const Model =
    type === 'carousel' ? CarouselSlide : type === 'grid' ? GridAd : null;
  if (!Model) {
    req.session.flashError = 'Unknown ad type.';
    return res.redirect('/secure-admin');
  }
  const ad = await Model.findById(id);
  if (!ad) {
    req.session.flashError = 'Ad not found.';
    return res.redirect('/secure-admin');
  }
  if (!['paused', 'expired', 'cancelled'].includes(ad.status)) {
    req.session.flashError = 'Only inactive ads can be deleted.';
    return res.redirect('/secure-admin');
  }

  // Unlink uploaded files unless another ad still references the same path.
  const uploadsRoot = path.join(__dirname, '..', 'public');
  const candidatePaths = [ad.picturePath, ad.picture2Path].filter(
    (p) => typeof p === 'string' && p.startsWith('/uploads/'),
  );
  for (const relPath of candidatePaths) {
    try {
      const [carouselRefs, gridRefs] = await Promise.all([
        CarouselSlide.countDocuments({
          _id: { $ne: id },
          $or: [{ picturePath: relPath }, { picture2Path: relPath }],
        }),
        GridAd.countDocuments({
          _id: { $ne: id },
          $or: [{ picturePath: relPath }, { picture2Path: relPath }],
        }),
      ]);
      if (carouselRefs + gridRefs > 0) {
        logger.info('Skipping unlink — file still referenced', {
          file: relPath,
        });
        continue;
      }
      const absPath = path.join(uploadsRoot, relPath);
      // Ensure the resolved path stays inside public/uploads.
      const uploadsDir = path.join(uploadsRoot, 'uploads');
      if (!absPath.startsWith(uploadsDir + path.sep)) {
        logger.warn('Refusing to unlink path outside uploads dir', {
          file: relPath,
        });
        continue;
      }
      await fs.promises.unlink(absPath);
      logger.info('Deleted upload', { file: relPath });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn('Failed to unlink upload', {
          file: relPath,
          err: err.message,
        });
      }
    }
  }

  await Model.deleteOne({ _id: id });
  await AuditLog.create({
    userId: req.session.userId,
    action: `${type}_deleted_by_admin`,
    meta: {
      adId: id,
      companyName: ad.companyName,
      status: ad.status,
      files: candidatePaths,
    },
    ip: req.ip,
  });
  logger.info('Inactive ad deleted by admin', { type, adId: id });
  req.session.flashSuccess = 'Ad deleted.';
  res.redirect('/secure-admin');
});

/* ── Sidebar ────────────────────────────────────────────────────────────────── */
router.get('/sidebar', async (req, res) => {
  const items = await SidebarItem.find().sort('order').lean();
  const decodedItems = items.map((item) => ({
    ...item,
    label: decodeHtmlEntities(item.label),
  }));
  res.render('admin/sidebar', { title: 'Manage Sidebar', items: decodedItems });
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
  const idleMs = req.session.adminIdleTimeout ?? 5 * 60 * 1000;
  res.render('admin/test', {
    title: 'Dev Test Tools',
    adminIdleMinutes: idleMs / 60000,
  });
});

router.post('/test/set-idle-timeout', async (req, res) => {
  if (process.env.NODE_ENV !== 'development')
    return res.status(404).send('Not found');
  const mins = parseFloat(req.body.idleMinutes);
  if (Number.isFinite(mins) && mins > 0) {
    const nextIdleMs = Math.round(mins * 60 * 1000);
    req.session.adminIdleTimeout = nextIdleMs;
    await Customer.findOneAndUpdate(
      { _id: req.session.userId, role: 'admin' },
      { adminIdleTimeoutMs: nextIdleMs },
    );
    req.session.flashSuccess = `Admin idle timeout set to ${mins} minute(s).`;
  } else {
    req.session.flashError = 'Invalid timeout value.';
  }

  await new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  res.redirect('/secure-admin/test');
});

router.post('/test/seed', async (req, res) => {
  if (process.env.NODE_ENV !== 'development')
    return res.status(404).send('Not found');
  await import('../scripts/seed.js').then((m) => m.seed());
  req.session.flashSuccess = 'Test data seeded.';
  res.redirect('/secure-admin/test');
});

export default router;
