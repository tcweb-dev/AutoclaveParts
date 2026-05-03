'use strict';
import { body, validationResult } from 'express-validator';

export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Store errors and repopulate form
    req.session.validationErrors = errors.array();
    req.session.oldInput = req.body;
    return res.redirect(req.originalUrl || '/');
  }
  next();
}

/* ── Auth forms ─────────────────────────────────────────────────────────────── */
export const registerRules = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .escape(),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .escape(),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 254 }),
  body('phone')
    .trim()
    .optional({ checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('Invalid phone number')
    .isLength({ max: 30 })
    .escape(),
  body('companyName')
    .trim()
    .optional({ checkFalsy: true })
    .isLength({ max: 120 })
    .escape(),
  body('companyWebsite')
    .trim()
    .notEmpty()
    .withMessage('Company website is required')
    .isURL({ require_protocol: false })
    .withMessage('Company website must be a valid URL')
    .isLength({ max: 255 }),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be at least 8 characters'),
  body('confirmPassword').custom((val, { req }) => {
    if (val !== req.body.password) throw new Error('Passwords do not match');
    return true;
  }),
];

export const loginRules = [
  body('email').trim().isEmail().normalizeEmail().isLength({ max: 254 }),
  body('password').notEmpty().isLength({ max: 128 }),
];

export const adminLoginRules = [
  body('email').trim().isEmail().normalizeEmail(),
  body('password').notEmpty().isLength({ max: 128 }),
];

/* ── Ad forms ───────────────────────────────────────────────────────────────── */
const commonAdRules = [
  body('companyName')
    .trim()
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 120 })
    .escape(),
  body('companyWebsite')
    .trim()
    .optional({ checkFalsy: true })
    .isLength({ max: 255 })
    .withMessage('Website must be under 255 characters'),
  body('companyPhone')
    .trim()
    .optional({ checkFalsy: true })
    .isLength({ max: 30 })
    .withMessage('Phone must be under 30 characters')
    .escape(),
  body('companyDescription')
    .trim()
    .optional({ checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage('Description must be under 500 characters')
    .escape(),
  body('linkUrl')
    .trim()
    .optional({ checkFalsy: true })
    .isURL({ require_protocol: true })
    .withMessage(
      'Click-through URL must be a full URL (e.g. https://yoursite.com)',
    )
    .isLength({ max: 255 }),
  body('captionPosition')
    .trim()
    .optional({ checkFalsy: true })
    .isIn([
      'top-left',
      'top-center',
      'top-right',
      'bottom-left',
      'bottom-center',
      'bottom-right',
    ])
    .withMessage('Invalid caption position'),
  body('imagePosition')
    .trim()
    .optional({ checkFalsy: true })
    .isIn([
      'center',
      'top',
      'bottom',
      'left',
      'right',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ])
    .withMessage('Invalid image position'),
  body('imageScale')
    .optional({ checkFalsy: true })
    .isInt({ min: 20, max: 160 })
    .withMessage('Image scale must be between 20 and 160'),
  body('picture2Scale')
    .optional({ checkFalsy: true })
    .isInt({ min: 20, max: 160 })
    .withMessage('Second image scale must be between 20 and 160'),
  body('imagePositionX')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Invalid image X position'),
  body('imagePositionY')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Invalid image Y position'),
  body('picture2PositionX')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Invalid second image X position'),
  body('picture2PositionY')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Invalid second image Y position'),
  body('captionPositionX')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Invalid caption X position'),
  body('captionPositionY')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Invalid caption Y position'),
  body('descriptionPositionX')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Invalid description X position'),
  body('descriptionPositionY')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Invalid description Y position'),
  body('captionFontColor')
    .optional({ checkFalsy: true })
    .matches(/^#[0-9a-fA-F]{3,6}$/)
    .withMessage('Font color must be a valid hex color'),
  body('captionFontSize')
    .optional({ checkFalsy: true })
    .isInt({ min: 10, max: 48 })
    .withMessage('Font size must be between 10 and 48'),
  body('captionFontWeight')
    .optional({ checkFalsy: true })
    .isIn(['400', '600', '700', '900'])
    .withMessage('Invalid font weight'),
  body('descriptionFontColor')
    .optional({ checkFalsy: true })
    .matches(/^#[0-9a-fA-F]{3,6}$/)
    .withMessage('Description color must be a valid hex color'),
  body('descriptionFontSize')
    .optional({ checkFalsy: true })
    .isInt({ min: 10, max: 48 })
    .withMessage('Description font size must be between 10 and 48'),
  body('descriptionFontWeight')
    .optional({ checkFalsy: true })
    .isIn(['400', '600', '700', '900'])
    .withMessage('Invalid description font weight'),
  body('descriptionBgColor')
    .optional({ checkFalsy: true })
    .matches(/^#[0-9a-fA-F]{3,6}$/)
    .withMessage('Description background must be a valid hex color'),
  body('slideBgColor')
    .optional({ checkFalsy: true })
    .matches(/^#[0-9a-fA-F]{3,6}$/)
    .withMessage('Background color must be a valid hex color'),
  body('fillFrameCrop').optional({ checkFalsy: true }).equals('on'),
  body('animationEnabled').optional({ checkFalsy: true }).equals('on'),
  body('autoRenew').optional({ checkFalsy: true }).equals('on'),
  body('removePicture').optional({ checkFalsy: true }).equals('on'),
  body('removePicture2').optional({ checkFalsy: true }).equals('on'),
];

export const carouselAdRules = commonAdRules;
export const gridAdRules = commonAdRules;

/* ── Sidebar ────────────────────────────────────────────────────────────────── */
export const sidebarItemRules = [
  body('label').trim().notEmpty().isLength({ max: 100 }).escape(),
  body('hrefUrl')
    .trim()
    .optional({ checkFalsy: true })
    .isURL({ require_protocol: true })
    .isLength({ max: 255 }),
  body('order').optional().isInt({ min: 0 }).toInt(),
];

/* ── Bulk email ─────────────────────────────────────────────────────────────── */
export const bulkEmailRules = [
  body('subject').trim().notEmpty().isLength({ max: 200 }).escape(),
  body('bodyText').trim().notEmpty().isLength({ max: 10000 }),
  body('bodyHtml')
    .trim()
    .optional({ checkFalsy: true })
    .isLength({ max: 50000 }),
];
