'use strict';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';
import AuditLog from '../models/AuditLog.js';
import Customer from '../models/Customer.js';
import { logger } from '../config/logger.js';
import { getStripe } from '../config/stripe.js';
import {
  sendBillingCapReached,
  sendBillingReauthRequired,
} from '../config/mailer.js';

const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
function publicBaseUrl() {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    'http://localhost:' + (process.env.PORT || 3000)
  );
}

/**
 * CPM in cents. Default is $4.00 per 1,000 impressions ($0.004 per impression).
 * Override with env var CPM_RATE_CENTS.
 */
function cpmRateCents() {
  const fromEnv = Number(process.env.CPM_RATE_CENTS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 400;
}

function stripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key && !key.startsWith('sk_test_placeholder');
}

/**
 * Attempt an off-session charge for the accrued cents.
 * Returns an object: { result, paymentIntentId? }
 *   result === 'charged'           — Stripe accepted the PaymentIntent.
 *   result === 'stub'              — Stripe not configured (dev/test).
 *   result === 'auth_required'     — Card needs 3DS re-authentication; the
 *                                    failed PI is returned so the customer can
 *                                    confirm it on-session.
 *   result === 'failed'            — Other failure; safe to retry next run.
 */
async function attemptOffSessionCharge({ ad, adType, amountCents }) {
  if (!stripeConfigured()) return { result: 'stub' };
  if (!ad.stripeCustomerId) {
    logger.warn('Skipping charge: no stripeCustomerId on ad', {
      adType,
      adId: String(ad._id),
    });
    return { result: 'failed' };
  }
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: ad.stripeCustomerId,
      payment_method: ad.stripePaymentMethodId || undefined,
      confirm: true,
      off_session: true,
      metadata: {
        adId: String(ad._id),
        adType,
        billingReason: 'impression_accrual',
      },
    });
    logger.info('Off-session impression charge succeeded', {
      adType,
      adId: String(ad._id),
      amountCents,
      intentId: intent.id,
    });
    return { result: 'charged', paymentIntentId: intent.id };
  } catch (err) {
    const code = err.code;
    const failedPi = err.raw?.payment_intent || err.payment_intent || null;
    logger.error('Off-session impression charge failed', {
      adType,
      adId: String(ad._id),
      amountCents,
      code,
      declineCode: err.decline_code,
      err: err.message,
    });
    if (code === 'authentication_required') {
      return {
        result: 'auth_required',
        paymentIntentId: failedPi?.id || null,
      };
    }
    return { result: 'failed' };
  }
}

async function notifyCapReached({ ad, adType, maxLimitCents, newSpendCents }) {
  const customer = await Customer.findById(ad.customerId).lean();
  if (!customer?.email) return;
  await sendBillingCapReached({
    toEmail: customer.email,
    companyName: ad.companyName,
    type: adType,
    maxChargeLimit: maxLimitCents / 100,
    attemptedAmount: newSpendCents / 100,
  });
}

async function notifyReauthRequired({ ad, adType }) {
  const customer = await Customer.findById(ad.customerId).lean();
  if (!customer?.email) return;
  await sendBillingReauthRequired({
    toEmail: customer.email,
    companyName: ad.companyName,
    type: adType,
    reauthUrl: `${publicBaseUrl()}/payment/reauth/${adType}/${ad._id}`,
  });
}

/**
 * If the current 30-day billing period has elapsed, reset cap counters so the
 * next reconcile starts fresh against the same maxChargeLimit. Treats current
 * impressions as already billed (per product spec — the old period closes out).
 */
async function maybeRollPeriod(Model, ad) {
  if (!ad.currentPeriodStartedAt) return false;
  const elapsed = Date.now() - new Date(ad.currentPeriodStartedAt).getTime();
  if (elapsed < BILLING_PERIOD_MS) return false;
  await Model.findByIdAndUpdate(ad._id, {
    $set: {
      spendAccruedCents: 0,
      impressionsBilled: ad.impressionsTotal || 0,
      billingCapApprovalPending: false,
      billingCapApprovalRequestedAt: null,
      billingCapApprovalGrantedAt: null,
      billingCapOverrideUntil: null,
      billingCapReachedAt: null,
      currentPeriodStartedAt: new Date(),
    },
  });
  await AuditLog.create({
    userId: ad.customerId,
    action: 'impression_billing_period_reset',
    meta: {
      adId: String(ad._id),
      previousPeriodStart: ad.currentPeriodStartedAt,
      previousSpendCents: ad.spendAccruedCents || 0,
    },
    ip: '',
  });
  // Mutate in-place so the same iteration sees fresh values.
  ad.spendAccruedCents = 0;
  ad.impressionsBilled = ad.impressionsTotal || 0;
  ad.billingCapApprovalPending = false;
  ad.billingCapApprovalRequestedAt = null;
  ad.billingCapApprovalGrantedAt = null;
  ad.billingCapOverrideUntil = null;
  ad.billingCapReachedAt = null;
  ad.currentPeriodStartedAt = new Date();
  return true;
}

/**
 * Reconcile one ad: convert unbilled impressions into accrued spend, enforce
 * the customer's spending cap, send notifications when the cap is hit, and
 * attempt an off-session charge for the newly accrued amount when Stripe is
 * configured.
 */
async function reconcileAd(Model, ad, adType) {
  await maybeRollPeriod(Model, ad);
  const unbilled = (ad.impressionsTotal || 0) - (ad.impressionsBilled || 0);
  if (unbilled <= 0) return;

  const cpm = cpmRateCents();
  const deltaCents = Math.floor((unbilled * cpm) / 1000);
  if (deltaCents <= 0) {
    // Not enough impressions yet to round to a whole cent — wait for more.
    return;
  }

  const currentSpend = ad.spendAccruedCents || 0;
  const newSpendCents = currentSpend + deltaCents;
  const maxLimitCents =
    ad.maxChargeLimit != null
      ? Math.round(Number(ad.maxChargeLimit) * 100)
      : null;
  const overrideActive =
    ad.billingCapOverrideUntil &&
    new Date(ad.billingCapOverrideUntil) > new Date();

  if (
    maxLimitCents != null &&
    newSpendCents > maxLimitCents &&
    !overrideActive
  ) {
    const alreadyPending = !!ad.billingCapApprovalPending;
    const remainingCents = Math.max(maxLimitCents - currentSpend, 0);
    if (remainingCents > 0) {
      // Bill up to the cap, then stop and request approval.
      const billableImpressions = Math.floor((remainingCents * 1000) / cpm);
      const charge = await attemptOffSessionCharge({
        ad,
        adType,
        amountCents: remainingCents,
      });
      if (charge.result === 'auth_required') {
        await Model.findByIdAndUpdate(ad._id, {
          $set: {
            status: 'paused',
            inactiveSince: ad.inactiveSince || new Date(),
            pendingAuthPaymentIntentId: charge.paymentIntentId || '',
          },
        });
        await AuditLog.create({
          userId: ad.customerId,
          action: 'impression_billing_auth_required',
          meta: {
            adId: String(ad._id),
            adType,
            amountCents: remainingCents,
            paymentIntentId: charge.paymentIntentId || null,
          },
          ip: '',
        });
        await notifyReauthRequired({ ad, adType });
        return;
      }
      if (charge.result === 'failed') {
        await AuditLog.create({
          userId: ad.customerId,
          action: 'impression_billing_charge_failed',
          meta: {
            adId: String(ad._id),
            adType,
            amountCents: remainingCents,
            reason: 'cap_partial',
          },
          ip: '',
        });
        return;
      }
      await Model.findByIdAndUpdate(ad._id, {
        $inc: {
          impressionsBilled: billableImpressions,
          spendAccruedCents: remainingCents,
        },
        $set: {
          status: 'paused',
          inactiveSince: ad.inactiveSince || new Date(),
          billingCapApprovalPending: true,
          billingCapReachedAt: new Date(),
          ...(ad.billingCapApprovalRequestedAt
            ? {}
            : { billingCapApprovalRequestedAt: new Date() }),
        },
      });
      await AuditLog.create({
        userId: ad.customerId,
        action: 'impression_billing_cap_partial',
        meta: {
          adId: String(ad._id),
          adType,
          remainingCents,
          billableImpressions,
          chargeResult: charge.result,
        },
        ip: '',
      });
    } else if (!ad.billingCapApprovalPending) {
      await Model.findByIdAndUpdate(ad._id, {
        $set: {
          status: 'paused',
          inactiveSince: ad.inactiveSince || new Date(),
          billingCapApprovalPending: true,
          billingCapReachedAt: new Date(),
          billingCapApprovalRequestedAt:
            ad.billingCapApprovalRequestedAt || new Date(),
        },
      });
    }
    if (!alreadyPending) {
      await notifyCapReached({ ad, adType, maxLimitCents, newSpendCents });
    }
    return;
  }

  // Under cap (or override active): bill the full unbilled amount.
  const charge = await attemptOffSessionCharge({
    ad,
    adType,
    amountCents: deltaCents,
  });
  if (charge.result === 'auth_required') {
    await Model.findByIdAndUpdate(ad._id, {
      $set: {
        status: 'paused',
        inactiveSince: ad.inactiveSince || new Date(),
        pendingAuthPaymentIntentId: charge.paymentIntentId || '',
      },
    });
    await AuditLog.create({
      userId: ad.customerId,
      action: 'impression_billing_auth_required',
      meta: {
        adId: String(ad._id),
        adType,
        amountCents: deltaCents,
        paymentIntentId: charge.paymentIntentId || null,
      },
      ip: '',
    });
    await notifyReauthRequired({ ad, adType });
    return;
  }
  if (charge.result === 'failed') {
    await AuditLog.create({
      userId: ad.customerId,
      action: 'impression_billing_charge_failed',
      meta: {
        adId: String(ad._id),
        adType,
        amountCents: deltaCents,
        impressions: unbilled,
      },
      ip: '',
    });
    return;
  }
  await Model.findByIdAndUpdate(ad._id, {
    $inc: {
      impressionsBilled: unbilled,
      spendAccruedCents: deltaCents,
    },
  });
  await AuditLog.create({
    userId: ad.customerId,
    action: 'impression_billing_accrued',
    meta: {
      adId: String(ad._id),
      adType,
      impressions: unbilled,
      amountCents: deltaCents,
      chargeResult: charge.result,
    },
    ip: '',
  });
}

/**
 * Iterate all active ads and reconcile impression-based spend.
 */
export async function accrueImpressionBilling() {
  const filter = { status: 'active' };
  const [carouselAds, gridAds] = await Promise.all([
    CarouselSlide.find(filter),
    GridAd.find(filter),
  ]);
  for (const ad of carouselAds) {
    try {
      await reconcileAd(CarouselSlide, ad, 'carousel');
    } catch (err) {
      logger.error('Carousel ad reconcile failed', {
        adId: String(ad._id),
        err: err.message,
      });
    }
  }
  for (const ad of gridAds) {
    try {
      await reconcileAd(GridAd, ad, 'grid');
    } catch (err) {
      logger.error('Grid ad reconcile failed', {
        adId: String(ad._id),
        err: err.message,
      });
    }
  }
}
