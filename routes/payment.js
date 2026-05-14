'use strict';
import { Router } from 'express';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';
import AuditLog from '../models/AuditLog.js';
import Customer from '../models/Customer.js';
import { requireAuth } from '../middleware/auth.js';
import { getStripe } from '../config/stripe.js';
import {
  sendBillingCapApprovalConfirmation,
  sendBillingCapReached,
  sendPaymentConfirmation,
} from '../config/mailer.js';
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

/**
 * Look up or create a Stripe customer for this buyer so future off-session
 * impression-billing charges can reuse the saved payment method.
 */
async function ensureStripeCustomer(customerId) {
  const customer = await Customer.findById(customerId);
  if (!customer) return null;
  if (customer.stripeCustomerId) return customer.stripeCustomerId;
  const stripe = getStripe();
  const sc = await stripe.customers.create({
    email: customer.email,
    name:
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      undefined,
    metadata: { customerId: String(customer._id) },
  });
  customer.stripeCustomerId = sc.id;
  await customer.save();
  return sc.id;
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
  const attemptedAmount = amount / 100;
  const maxChargeLimit =
    ad.maxChargeLimit != null ? Number(ad.maxChargeLimit) : null;
  const approvalOverrideActive =
    ad.billingCapOverrideUntil &&
    new Date(ad.billingCapOverrideUntil) > new Date();
  const approvalRequired =
    maxChargeLimit != null &&
    attemptedAmount > maxChargeLimit &&
    !approvalOverrideActive;

  if (approvalRequired) {
    if (!ad.billingCapApprovalPending || !ad.billingCapApprovalRequestedAt) {
      await Model.findByIdAndUpdate(id, {
        billingCapApprovalPending: true,
        billingCapApprovalRequestedAt: new Date(),
        billingCapReachedAt: new Date(),
      });
      const customer = await Customer.findById(ad.customerId).lean();
      if (customer?.email) {
        await sendBillingCapReached({
          toEmail: customer.email,
          companyName: ad.companyName,
          type,
          maxChargeLimit,
          attemptedAmount,
        });
      }
    }

    return res.render('payment', {
      title: 'Additional Spending Approval Required',
      ad,
      type,
      amount: attemptedAmount,
      clientSecret: null,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      isTestKey: true,
      approvalRequired: true,
      maxChargeLimit,
    });
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const isTestKey = !stripeKey || stripeKey.startsWith('sk_test_placeholder');

  let clientSecret = null;
  if (!isTestKey) {
    try {
      const stripe = getStripe();
      const stripeCustomerId = await ensureStripeCustomer(ad.customerId);
      const intent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: stripeCustomerId || undefined,
        setup_future_usage: stripeCustomerId ? 'off_session' : undefined,
        metadata: {
          adId: id,
          adType: type,
          maxChargeLimit:
            ad.maxChargeLimit != null ? String(ad.maxChargeLimit) : '',
        },
      });
      clientSecret = intent.client_secret;
      await Model.findByIdAndUpdate(id, {
        stripePaymentIntentId: intent.id,
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
      });
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
    approvalRequired: false,
    maxChargeLimit,
  });
});

router.post('/approve-more/:type/:id', requireAuth, async (req, res) => {
  const { type, id } = req.params;
  const Model = getModel(type);
  if (!Model) return res.status(404).render('404', { title: 'Not Found' });

  const ad = await Model.findById(id);
  if (!ad || ad.customerId.toString() !== req.session.userId)
    return res.status(403).render('404', { title: 'Not Found' });

  if (ad.maxChargeLimit == null) {
    req.session.flashError = 'No spending cap is set for this ad.';
    return res.redirect(`/payment/${type}/${id}`);
  }

  ad.billingCapApprovalPending = false;
  ad.billingCapApprovalGrantedAt = new Date();
  ad.billingCapOverrideUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (ad.status === 'paused') {
    ad.status = 'active';
    ad.inactiveSince = null;
  }
  await ad.save();

  const customer = await Customer.findById(ad.customerId).lean();
  if (customer?.email) {
    await sendBillingCapApprovalConfirmation({
      toEmail: customer.email,
      companyName: ad.companyName,
      type,
    });
  }

  req.session.flashSuccess =
    'Additional spending approved for this billing period.';
  res.redirect(`/payment/${type}/${id}`);
});

/* ── 3DS / off-session reauth page ──────────────────────────────────────────── */
router.get('/reauth/:type/:id', requireAuth, async (req, res) => {
  const { type, id } = req.params;
  const Model = getModel(type);
  if (!Model) return res.status(404).render('404', { title: 'Not Found' });

  const ad = await Model.findById(id).lean();
  if (!ad || ad.customerId.toString() !== req.session.userId)
    return res.status(403).render('404', { title: 'Not Found' });

  if (!ad.pendingAuthPaymentIntentId) {
    req.session.flashError = 'No payment is awaiting authentication.';
    return res.redirect('/dashboard');
  }

  let clientSecret = null;
  let amount = 0;
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(
      ad.pendingAuthPaymentIntentId,
    );
    clientSecret = intent.client_secret;
    amount = (intent.amount || 0) / 100;
  } catch (err) {
    logger.error('Failed to retrieve reauth PaymentIntent', {
      adId: id,
      err: err.message,
    });
    req.session.flashError =
      'Unable to load the pending payment. Please contact support.';
    return res.redirect('/dashboard');
  }

  res.render('payment', {
    title: 'Authenticate Card',
    ad,
    type,
    amount,
    clientSecret,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    isTestKey: false,
    approvalRequired: false,
    maxChargeLimit:
      ad.maxChargeLimit != null ? Number(ad.maxChargeLimit) : null,
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
    const { adId, adType, billingReason } = intent.metadata;
    const Model = getModel(adType);
    if (Model && adId) {
      // Promote this PM to the customer's default so future off-session
      // charges against any of their ads (not just this one) can succeed.
      if (intent.customer && intent.payment_method) {
        try {
          const stripe = getStripe();
          await stripe.customers.update(intent.customer, {
            invoice_settings: { default_payment_method: intent.payment_method },
          });
        } catch (err) {
          logger.warn('Failed to set default payment method on customer', {
            customer: intent.customer,
            err: err.message,
          });
        }
      }

      // Re-auth completion for an impression-accrual PaymentIntent that
      // previously failed with authentication_required. Credit the impressions
      // and resume the ad (unless a spending-cap approval is still pending).
      if (billingReason === 'impression_accrual') {
        const adDoc = await Model.findById(adId);
        if (adDoc) {
          const cpm =
            Number(process.env.CPM_RATE_CENTS) > 0
              ? Number(process.env.CPM_RATE_CENTS)
              : 400;
          const billableImpressions = Math.floor(
            ((intent.amount || 0) * 1000) / cpm,
          );
          const setUpdate = {
            pendingAuthPaymentIntentId: '',
            ...(intent.payment_method
              ? { stripePaymentMethodId: intent.payment_method }
              : {}),
          };
          if (!adDoc.billingCapApprovalPending && adDoc.status === 'paused') {
            setUpdate.status = 'active';
            setUpdate.inactiveSince = null;
          }
          await Model.findByIdAndUpdate(adId, {
            $inc: {
              impressionsBilled: billableImpressions,
              spendAccruedCents: intent.amount || 0,
            },
            $set: setUpdate,
          });
          await AuditLog.create({
            userId: adDoc.customerId,
            action: 'impression_billing_reauth_succeeded',
            meta: {
              adId,
              adType,
              amountCents: intent.amount,
              billableImpressions,
            },
            ip: '',
          });
          logger.info('Reauth payment succeeded', {
            adId,
            adType,
            amount: intent.amount,
          });
        }
        return res.json({ received: true });
      }

      const expiresAt = sameMonthNextYear();
      const ad = await Model.findByIdAndUpdate(
        adId,
        {
          status: 'pending',
          paidAt: new Date(),
          expiresAt,
          ...(intent.customer ? { stripeCustomerId: intent.customer } : {}),
          ...(intent.payment_method
            ? { stripePaymentMethodId: intent.payment_method }
            : {}),
          currentPeriodStartedAt: new Date(),
        },
        { new: true },
      );
      if (ad) {
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
