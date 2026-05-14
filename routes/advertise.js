'use strict';
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';
import Customer from '../models/Customer.js';
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
import { renderServerError } from '../utils/renderServerError.js';

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

/* ── Choose ad type ─────────────────────────────────────────────────────────── */
router.get('/', (req, res) => {
  res.render('advertise', { title: 'Advertise on PlaceholderParts' });
});

/* ────────────────────────────────────────────────────────────────────────────
   CAROUSEL AD
 ──────────────────────────────────────────────────────────────────────────── */
router.get('/carousel', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.session.userId).lean();
    res.render('advertise-form', {
      title: 'Carousel Ad – $100/month',
      adType: 'carousel',
      editMode: false,
      customer: customer || {},
    });
  } catch (err) {
    logger.error('Fetch customer error in carousel route', {
      err: err.message,
    });
    res.render('advertise-form', {
      title: 'Carousel Ad – $100/month',
      adType: 'carousel',
      editMode: false,
      customer: {},
    });
  }
});

router.post(
  '/carousel',
  requireAuth,
  handleUpload,
  requirePictureFile,
  carouselAdRules,
  handleValidation,
  async (req, res) => {
    try {
      const {
        companyName,
        companyWebsite,
        companyPhone,
        companyDescription,
        linkUrl,
        imageScale,
        picture2Scale,
        fillFrameCrop,
        animationEnabled,
        captionFontColor,
        captionFontSize,
        captionFontWeight,
        descriptionFontColor,
        descriptionFontSize,
        descriptionFontWeight,
        descriptionBgColor,
        slideBgColor,
        captionWidthPct,
        captionHeightPct,
        maxChargeLimit,
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
      const slide = await CarouselSlide.create({
        customerId: req.session.userId,
        companyName,
        companyWebsite: companyWebsite || '',
        companyPhone: companyPhone || '',
        companyDescription: companyDescription || '',
        picturePath: req.file ? `/uploads/${req.file.filename}` : '',
        picture2Path: req.file2 ? `/uploads/${req.file2.filename}` : '',
        picture2PositionX,
        picture2PositionY,
        picture2Scale: Number(picture2Scale) || 100,
        linkUrl: linkUrl || '',
        captionPositionX,
        captionPositionY,
        captionWidthPct: Math.min(
          100,
          Math.max(5, Number(captionWidthPct) || 30),
        ),
        captionHeightPct: Math.min(
          100,
          Math.max(10, Number(captionHeightPct) || 30),
        ),
        descriptionPositionX,
        descriptionPositionY,
        imagePositionX,
        imagePositionY,
        imageScale: Number(imageScale) || 100,
        imageFitMode: fillFrameCrop === 'on' ? 'cover' : 'contain',
        animationEnabled: animationEnabled === 'on',
        captionFontColor: captionFontColor || '#ffffff',
        captionFontSize: Number(captionFontSize) || 16,
        captionFontWeight: captionFontWeight || '600',
        descriptionFontColor: descriptionFontColor || '#ffffff',
        descriptionFontSize: Number(descriptionFontSize) || 14,
        descriptionFontWeight: descriptionFontWeight || '400',
        descriptionBgColor: descriptionBgColor || '#000000',
        slideBgColor: slideBgColor || '',
        status: 'pending',
        maxChargeLimit:
          maxChargeLimit !== undefined && maxChargeLimit !== ''
            ? Number(maxChargeLimit)
            : null,
      });
      await AuditLog.create({
        userId: req.session.userId,
        action: 'carousel_ad_submitted',
        type: 'carousel',
        companyName,
        customerId: req.session.userId,
      });
      logger.info('Carousel ad submitted', { slideId: slide._id });
      res.redirect(`/payment/carousel/${slide._id}`);
    } catch (err) {
      logger.error('Carousel ad submit error', { err: err.message });
      renderServerError(req, res, err);
    }
  },
);

/* ────────────────────────────────────────────────────────────────────────────
   GRID AD
 ──────────────────────────────────────────────────────────────────────────── */
router.get('/grid', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.session.userId).lean();
    res.render('advertise-form', {
      title: 'Company / Contact Information',
      adType: 'grid',
      editMode: false,
      customer: customer || {},
    });
  } catch (err) {
    logger.error('Fetch customer error in grid route', { err: err.message });
    res.render('advertise-form', {
      title: 'Company / Contact Information',
      adType: 'grid',
      editMode: false,
      customer: {},
    });
  }
});

router.post(
  '/grid',
  requireAuth,
  handleUpload,
  requirePictureFile,
  gridAdRules,
  handleValidation,
  async (req, res) => {
    try {
      const {
        companyName,
        companyWebsite,
        companyPhone,
        companyDescription,
        linkUrl,
        imageScale,
        picture2Scale,
        fillFrameCrop,
        animationEnabled,
        captionFontColor,
        captionFontSize,
        captionFontWeight,
        descriptionFontColor,
        descriptionFontSize,
        descriptionFontWeight,
        descriptionBgColor,
        slideBgColor,
        captionWidthPct,
        captionHeightPct,
        maxChargeLimit,
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
      const ad = await GridAd.create({
        customerId: req.session.userId,
        companyName,
        companyWebsite: companyWebsite || '',
        companyPhone: companyPhone || '',
        companyDescription: companyDescription || '',
        picturePath: req.file ? `/uploads/${req.file.filename}` : '',
        picture2Path: req.file2 ? `/uploads/${req.file2.filename}` : '',
        picture2PositionX,
        picture2PositionY,
        picture2Scale: Number(picture2Scale) || 100,
        linkUrl: linkUrl || '',
        captionPositionX,
        captionPositionY,
        captionWidthPct: Math.min(
          100,
          Math.max(5, Number(captionWidthPct) || 30),
        ),
        captionHeightPct: Math.min(
          100,
          Math.max(10, Number(captionHeightPct) || 30),
        ),
        descriptionPositionX,
        descriptionPositionY,
        imagePositionX,
        imagePositionY,
        imageScale: Number(imageScale) || 100,
        imageFitMode: fillFrameCrop === 'on' ? 'cover' : 'contain',
        animationEnabled: animationEnabled === 'on',
        captionFontColor: captionFontColor || '#ffffff',
        captionFontSize: Number(captionFontSize) || 16,
        captionFontWeight: captionFontWeight || '600',
        descriptionFontColor: descriptionFontColor || '#ffffff',
        descriptionFontSize: Number(descriptionFontSize) || 14,
        descriptionFontWeight: descriptionFontWeight || '400',
        descriptionBgColor: descriptionBgColor || '#000000',
        slideBgColor: slideBgColor || '',
        status: 'pending',
        maxChargeLimit:
          maxChargeLimit !== undefined && maxChargeLimit !== ''
            ? Number(maxChargeLimit)
            : null,
      });
      await AuditLog.create({
        userId: req.session.userId,
        action: 'grid_ad_submitted',
        meta: { adId: ad._id, companyName },
        ip: req.ip,
      });
      await sendAdminNewSlide({
        type: 'grid',
        companyName,
        customerId: req.session.userId,
      });
      logger.info('Grid ad submitted', { adId: ad._id });
      res.redirect(`/payment/grid/${ad._id}`);
    } catch (err) {
      logger.error('Grid ad submit error', { err: err.message });
      renderServerError(req, res, err);
    }
  },
);

export default router;
