'use strict';
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';
import AuditLog from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { handleUpload } from '../middleware/upload.js';
import {
  carouselAdRules,
  gridAdRules,
  handleValidation,
  requirePictureFile,
} from '../middleware/validate.js';
import { sendAdminNewSlide } from '../config/mailer.js';
import { logger } from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getImageCoordsFromBody(body) {
  const rawX = body.imagePositionX;
  const rawY = body.imagePositionY;
  const x = rawX !== '' && rawX != null ? Number(rawX) : NaN;
  const y = rawY !== '' && rawY != null ? Number(rawY) : NaN;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
  }
  return { x: 50, y: 50 };
}

function getCaptionCoordsFromBody(body) {
  const rawX = body.captionPositionX;
  const rawY = body.captionPositionY;
  const x = rawX !== '' && rawX != null ? Number(rawX) : NaN;
  const y = rawY !== '' && rawY != null ? Number(rawY) : NaN;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
  }
  return { x: 10, y: 88 };
}

function getSecondImageCoordsFromBody(body) {
  const rawX = body.picture2PositionX;
  const rawY = body.picture2PositionY;
  const x = rawX !== '' && rawX != null ? Number(rawX) : NaN;
  const y = rawY !== '' && rawY != null ? Number(rawY) : NaN;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
  }
  return { x: 72, y: 72 };
}

function getDescriptionCoordsFromBody(body) {
  const rawX = body.descriptionPositionX;
  const rawY = body.descriptionPositionY;
  const x = rawX !== '' && rawX != null ? Number(rawX) : NaN;
  const y = rawY !== '' && rawY != null ? Number(rawY) : NaN;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
  }
  return { x: 50, y: 78 };
}

router.use(requireAuth);

function uploadsPath(filename) {
  return path.join(__dirname, '..', 'public', 'uploads', filename);
}
function deleteOldFile(picturePath) {
  if (!picturePath) return;
  const filename = path.basename(picturePath);
  const full = uploadsPath(filename);
  fs.unlink(full, () => {});
}

/* ── Dashboard home ─────────────────────────────────────────────────────────── */
router.get('/', requireAuth, async (req, res) => {
  const [carouselAds, gridAds] = await Promise.all([
    CarouselSlide.find({ customerId: req.session.userId })
      .sort('-createdAt')
      .lean(),
    GridAd.find({ customerId: req.session.userId }).sort('-createdAt').lean(),
  ]);
  res.render('dashboard', { title: 'My Dashboard', carouselAds, gridAds });
});

/* ── Cancel ─────────────────────────────────────────────────────────────────── */
router.post('/cancel/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const Model = type === 'carousel' ? CarouselSlide : GridAd;
  const ad = await Model.findOne({ _id: id, customerId: req.session.userId });
  if (!ad) {
    req.session.flashError = 'Ad not found.';
    return res.redirect('/dashboard');
  }
  if (['expired', 'cancelled'].includes(ad.status)) {
    req.session.flashError = 'This ad is already cancelled or expired.';
    return res.redirect('/dashboard');
  }
  ad.status = 'cancelled';
  ad.inactiveSince = new Date();
  await ad.save();
  await AuditLog.create({
    userId: req.session.userId,
    action: `${type}_cancelled`,
    meta: { adId: id },
    ip: req.ip,
  });
  logger.info('Ad cancelled by customer', { type, adId: id });
  req.session.flashSuccess =
    'Your ad has been cancelled. No refund is issued for the remaining period.';
  res.redirect('/dashboard');
});

/* ── Edit carousel ──────────────────────────────────────────────────────────── */
router.get('/edit/carousel/:id', requireAuth, async (req, res) => {
  const ad = await CarouselSlide.findOne({
    _id: req.params.id,
    customerId: req.session.userId,
  }).lean();
  if (!ad) return res.status(404).render('404', { title: 'Not Found' });
  res.render('advertise-form', {
    title: 'Edit Ad Displayed Information',
    adType: 'carousel',
    ad,
    customer: {},
    editMode: true,
  });
});

router.post(
  '/edit/carousel/:id',
  requireAuth,
  handleUpload,
  requirePictureFile,
  carouselAdRules,
  handleValidation,
  async (req, res) => {
    const ad = await CarouselSlide.findOne({
      _id: req.params.id,
      customerId: req.session.userId,
    });
    if (!ad) return res.status(404).render('404', { title: 'Not Found' });
    const {
      companyName,
      companyWebsite,
      companyPhone,
      companyDescription,
      removePicture,
      removePicture2,
      linkUrl,
      imageScale,
      picture2Scale,
      fillFrameCrop,
      animationEnabled,
      maxChargeLimit,
      captionFontColor,
      captionFontSize,
      captionFontWeight,
      descriptionFontColor,
      descriptionFontSize,
      descriptionFontWeight,
      descriptionBgColor,
      slideBgColor,
    } = req.body;
    const { x: imagePositionX, y: imagePositionY } = getImageCoordsFromBody(
      req.body,
    );
    const { x: captionPositionX, y: captionPositionY } =
      getCaptionCoordsFromBody(req.body);
    const { x: picture2PositionX, y: picture2PositionY } =
      getSecondImageCoordsFromBody(req.body);
    const { x: descriptionPositionX, y: descriptionPositionY } =
      getDescriptionCoordsFromBody(req.body);
    ad.companyName = companyName;
    ad.companyWebsite = companyWebsite || '';
    ad.companyPhone = companyPhone || '';
    ad.companyDescription = companyDescription || '';
    ad.linkUrl = linkUrl || '';
    ad.captionPositionX = captionPositionX;
    ad.captionPositionY = captionPositionY;
    ad.captionWidthPct = Math.min(
      100,
      Math.max(5, Number(req.body.captionWidthPct) || 30),
    );
    ad.captionHeightPct = Math.min(
      100,
      Math.max(10, Number(req.body.captionHeightPct) || 30),
    );
    ad.descriptionPositionX = descriptionPositionX;
    ad.descriptionPositionY = descriptionPositionY;
    ad.imagePositionX = imagePositionX;
    ad.imagePositionY = imagePositionY;
    ad.imageScale = Number(imageScale) || 100;
    ad.imageFitMode = fillFrameCrop === 'on' ? 'cover' : 'contain';
    ad.animationEnabled = animationEnabled === 'on';
    ad.maxChargeLimit =
      maxChargeLimit !== undefined && maxChargeLimit !== ''
        ? Number(maxChargeLimit)
        : null;
    ad.captionFontColor = captionFontColor || '#ffffff';
    ad.captionFontSize = Number(captionFontSize) || 16;
    ad.captionFontWeight = captionFontWeight || '600';
    ad.descriptionFontColor = descriptionFontColor || '#ffffff';
    ad.descriptionFontSize = Number(descriptionFontSize) || 14;
    ad.descriptionFontWeight = descriptionFontWeight || '400';
    ad.descriptionBgColor = descriptionBgColor || '#000000';
    ad.slideBgColor = slideBgColor || '';
    ad.picture2PositionX = picture2PositionX;
    ad.picture2PositionY = picture2PositionY;
    ad.picture2Scale = Number(picture2Scale) || 100;

    const oldPicturePath = ad.picturePath;
    const oldPicture2Path = ad.picture2Path;
    let nextPicturePath = ad.picturePath;
    let nextPicture2Path = ad.picture2Path;

    if (req.file) {
      nextPicturePath = `/uploads/${req.file.filename}`;
      console.log(
        'DEBUG: After req.file check - nextPicturePath =',
        nextPicturePath,
        'req.file =',
        req.file ? 'EXISTS' : 'NONE',
      );
    }
    if (req.file2) {
      nextPicture2Path = `/uploads/${req.file2.filename}`;
    }

    if (removePicture === 'on' && !req.file) {
      nextPicturePath = '';
      console.log(
        'DEBUG: After removePicture check - nextPicturePath =',
        nextPicturePath,
        'removePicture =',
        removePicture,
      );
    }
    if (removePicture2 === 'on' && !req.file2) {
      nextPicture2Path = '';
    }

    // Keep at least one image by promoting second image when needed.
    if (!nextPicturePath && nextPicture2Path) {
      nextPicturePath = nextPicture2Path;
      nextPicture2Path = '';
    }

    if (!nextPicturePath) {
      req.session.validationErrors = [
        { msg: 'At least one picture is required for your ad.' },
      ];
      req.session.oldInput = req.body;
      return res.redirect(req.originalUrl || '/dashboard');
    }

    ad.picturePath = nextPicturePath;
    ad.picture2Path = nextPicture2Path;
    console.log(
      'DEBUG: Before save - ad.picturePath =',
      ad.picturePath,
      'ad.picture2Path =',
      ad.picture2Path,
    );

    if (
      oldPicturePath &&
      oldPicturePath !== nextPicturePath &&
      oldPicturePath !== nextPicture2Path
    ) {
      deleteOldFile(oldPicturePath);
    }
    if (
      oldPicture2Path &&
      oldPicture2Path !== nextPicturePath &&
      oldPicture2Path !== nextPicture2Path
    ) {
      deleteOldFile(oldPicture2Path);
    }
    ad.status = 'pending'; // requires re-approval after edit
    await ad.save();
    await AuditLog.create({
      userId: req.session.userId,
      action: 'carousel_ad_edited',
      meta: { adId: ad._id },
      ip: req.ip,
    });
    await sendAdminNewSlide({
      type: 'carousel (edited)',
      companyName,
      customerId: req.session.userId,
    });
    logger.info('Carousel ad edited', { adId: ad._id });
    req.session.flashSuccess =
      'Your carousel ad has been updated and sent for re-approval.';
    res.redirect('/dashboard');
  },
);

/* ── Edit grid ──────────────────────────────────────────────────────────────── */
router.get('/edit/grid/:id', requireAuth, async (req, res) => {
  const ad = await GridAd.findOne({
    _id: req.params.id,
    customerId: req.session.userId,
  }).lean();
  if (!ad) return res.status(404).render('404', { title: 'Not Found' });
  res.render('advertise-form', {
    title: 'Edit Grid Ad',
    adType: 'grid',
    ad,
    customer: {},
    editMode: true,
  });
});

router.post(
  '/edit/grid/:id',
  requireAuth,
  handleUpload,
  requirePictureFile,
  gridAdRules,
  handleValidation,
  async (req, res) => {
    const ad = await GridAd.findOne({
      _id: req.params.id,
      customerId: req.session.userId,
    });
    if (!ad) return res.status(404).render('404', { title: 'Not Found' });
    const {
      companyName,
      companyWebsite,
      companyPhone,
      companyDescription,
      removePicture,
      removePicture2,
      linkUrl,
      imageScale,
      picture2Scale,
      fillFrameCrop,
      animationEnabled,
      maxChargeLimit,
      captionFontColor,
      captionFontSize,
      captionFontWeight,
      descriptionFontColor,
      descriptionFontSize,
      descriptionFontWeight,
      descriptionBgColor,
      slideBgColor,
    } = req.body;
    const { x: imagePositionX, y: imagePositionY } = getImageCoordsFromBody(
      req.body,
    );
    const { x: captionPositionX, y: captionPositionY } =
      getCaptionCoordsFromBody(req.body);
    const { x: picture2PositionX, y: picture2PositionY } =
      getSecondImageCoordsFromBody(req.body);
    const { x: descriptionPositionX, y: descriptionPositionY } =
      getDescriptionCoordsFromBody(req.body);
    ad.companyName = companyName;
    ad.companyWebsite = companyWebsite || '';
    ad.companyPhone = companyPhone || '';
    ad.companyDescription = companyDescription || '';
    ad.linkUrl = linkUrl || '';
    ad.captionPositionX = captionPositionX;
    ad.captionPositionY = captionPositionY;
    ad.captionWidthPct = Math.min(
      100,
      Math.max(5, Number(req.body.captionWidthPct) || 30),
    );
    ad.captionHeightPct = Math.min(
      100,
      Math.max(10, Number(req.body.captionHeightPct) || 30),
    );
    ad.descriptionPositionX = descriptionPositionX;
    ad.descriptionBgColor = descriptionBgColor || '#000000';
    ad.slideBgColor = slideBgColor || '';
    ad.maxChargeLimit =
      maxChargeLimit !== undefined && maxChargeLimit !== ''
        ? Number(maxChargeLimit)
        : null;
    ad.picture2PositionX = picture2PositionX;
    ad.picture2PositionY = picture2PositionY;
    ad.picture2Scale = Number(picture2Scale) || 100;

    const oldPicturePath = ad.picturePath;
    const oldPicture2Path = ad.picture2Path;
    let nextPicturePath = ad.picturePath;
    let nextPicture2Path = ad.picture2Path;

    if (req.file) {
      nextPicturePath = `/uploads/${req.file.filename}`;
    }
    if (req.file2) {
      nextPicture2Path = `/uploads/${req.file2.filename}`;
    }

    if (removePicture === 'on' && !req.file) {
      nextPicturePath = '';
    }
    if (removePicture2 === 'on' && !req.file2) {
      nextPicture2Path = '';
    }

    if (!nextPicturePath && nextPicture2Path) {
      nextPicturePath = nextPicture2Path;
      nextPicture2Path = '';
    }

    if (!nextPicturePath) {
      req.session.validationErrors = [
        { msg: 'At least one picture is required for your ad.' },
      ];
      req.session.oldInput = req.body;
      return res.redirect(req.originalUrl || '/dashboard');
    }

    ad.picturePath = nextPicturePath;
    ad.picture2Path = nextPicture2Path;

    if (
      oldPicturePath &&
      oldPicturePath !== nextPicturePath &&
      oldPicturePath !== nextPicture2Path
    ) {
      deleteOldFile(oldPicturePath);
    }
    if (
      oldPicture2Path &&
      oldPicture2Path !== nextPicturePath &&
      oldPicture2Path !== nextPicture2Path
    ) {
      deleteOldFile(oldPicture2Path);
    }
    ad.status = 'pending';
    await ad.save();
    await AuditLog.create({
      userId: req.session.userId,
      action: 'grid_ad_edited',
      meta: { adId: ad._id },
      ip: req.ip,
    });
    await sendAdminNewSlide({
      type: 'grid (edited)',
      companyName,
      customerId: req.session.userId,
    });
    logger.info('Grid ad edited', { adId: ad._id });
    req.session.flashSuccess =
      'Your grid ad has been updated and sent for re-approval.';
    res.redirect('/dashboard');
  },
);

export default router;
