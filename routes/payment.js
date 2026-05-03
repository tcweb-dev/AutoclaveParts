'use strict';
import { Router } from 'express';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';
import AuditLog from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { getStripe } from '../config/stripe.js';
import { sendPaymentConfirmation } from '../config/mailer.js';
import { logger } from '../config/logger.js';

const router = Router();

function getModel(type) {
  return type === 'carousel' ? CarouselSlide : type === 'grid' ? GridAd : null;
}

function sameMonthNextYear(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/* ── Payment page ───────────────────────────────────────────────────────────── */
router.get('/:type/:id', requireAuth, async (req, res) => {
  const { type, id } = req.params;
  const Model = getModel(type);
  if (!Model) return res.status(404).render('404', { title: 'Not Found' });

  const ad = await Model.findById(id).lean();
  if (!ad || ad.customerId.toString() !== req.session.userId)
    return res.status(403).render('404', { title: 'Not Found' });

  const amount =
    type === 'carousel'
      ? Number(process.env.PRICE_CAROUSEL)
      : Number(process.env.PRICE_GRID);
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const isTestKey = !stripeKey || stripeKey.startsWith('sk_test_placeholder');

  let clientSecret = null;
  if (!isTestKey) {
    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        metadata: { adId: id, adType: type },
      });
      clientSecret = intent.client_secret;
      await Model.findByIdAndUpdate(id, { stripePaymentIntentId: intent.id });
    } catch (err) {
      logger.error('Stripe PaymentIntent creation failed', {
        err: err.message,
      });
    }
  }

  res.render('payment', {
    title: 'Complete Payment',
    ad,
    type,
    amount: amount / 100,
    clientSecret,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    isTestKey,
  });
});

/* ── Stripe webhook ─────────────────────────────────────────────────────────── */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.error('Webhook signature verification failed', { err: err.message });
    return res.status(400).send('Webhook Error');
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const { adId, adType } = intent.metadata;
    const Model = getModel(adType);
    if (Model && adId) {
      const expiresAt = sameMonthNextYear();
      const ad = await Model.findByIdAndUpdate(
        adId,
        { status: 'pending', paidAt: new Date(), expiresAt },
        { new: true },
      );
      if (ad) {
        const Customer = (await import('../models/Customer.js')).default;
        const customer = await Customer.findById(ad.customerId).lean();
        if (customer) {
          await sendPaymentConfirmation({
            toEmail: customer.email,
            companyName: ad.companyName,
            type: adType,
            expiresAt,
          });
        }
        await AuditLog.create({
          userId: ad.customerId,
          action: 'payment_success',
          meta: { adId, adType, amount: intent.amount },
          ip: '',
        });
        logger.info('Payment succeeded', { adId, adType });
      }
    }
  }
  res.json({ received: true });
});

/* ── Dev stub: simulate successful payment ──────────────────────────────────── */
router.post('/stub-pay/:type/:id', requireAuth, async (req, res) => {
  if (process.env.NODE_ENV !== 'development')
    return res.status(404).send('Not found');
  const { type, id } = req.params;
  const Model = getModel(type);
  if (!Model) return res.status(404).send('Not found');
  const ad = await Model.findById(id);
  if (!ad || ad.customerId.toString() !== req.session.userId)
    return res.status(403).send('Forbidden');
  const expiresAt = sameMonthNextYear();
  ad.status = 'pending';
  ad.paidAt = new Date();
  ad.expiresAt = expiresAt;
  await ad.save();
  const Customer = (await import('../models/Customer.js')).default;
  const customer = await Customer.findById(ad.customerId).lean();
  if (customer)
    await sendPaymentConfirmation({
      toEmail: customer.email,
      companyName: ad.companyName,
      type,
      expiresAt,
    });
  await AuditLog.create({
    userId: req.session.userId,
    action: 'payment_stub',
    meta: { adId: id, type },
    ip: req.ip,
  });
  req.session.flashSuccess =
    'Payment simulated successfully! Awaiting admin approval.';
  res.redirect('/dashboard');
});

export default router;
