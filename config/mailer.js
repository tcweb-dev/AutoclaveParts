'use strict';
import nodemailer from 'nodemailer';
import { logger } from './logger.js';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const from =
  process.env.EMAIL_FROM ||
  '"PlaceholderParts" <no-reply@placeholderparts.com>';
const notifyEmail = process.env.NOTIFY_EMAIL || 'noname@nothing.com';

/** Notify admin that a new ad submission needs review */
export async function sendAdminNewSlide({ type, companyName, customerId }) {
  try {
    const transport = createTransport();
    await transport.sendMail({
      from,
      to: notifyEmail,
      subject: `[PlaceholderParts] New ${type} ad pending approval`,
      text: `A new ${type} advertisement has been submitted by customer ${customerId} (${companyName}) and is awaiting your approval.\n\nLogin at /secure-admin to review.`,
      html: `<p>A new <strong>${type}</strong> advertisement has been submitted by customer <strong>${companyName}</strong> and is awaiting your approval.</p><p><a href="/secure-admin">Login to admin dashboard</a></p>`,
    });
    logger.info('Admin notification sent', { type, companyName });
  } catch (err) {
    logger.error('sendAdminNewSlide failed', { err: err.message });
  }
}

/** Confirm payment to customer */
export async function sendPaymentConfirmation({
  toEmail,
  companyName,
  type,
  expiresAt,
}) {
  try {
    const transport = createTransport();
    await transport.sendMail({
      from,
      to: toEmail,
      subject: `[PlaceholderParts] Payment confirmed – ${type} ad`,
      text: `Thank you! Your ${type} advertisement for ${companyName} has been paid and is pending admin approval. It will be active until ${expiresAt.toDateString()}.`,
      html: `<p>Thank you! Your <strong>${type}</strong> advertisement for <strong>${companyName}</strong> has been paid and is pending admin approval.</p><p>Active until: <strong>${expiresAt.toDateString()}</strong></p>`,
    });
    logger.info('Payment confirmation sent', { toEmail, type });
  } catch (err) {
    logger.error('sendPaymentConfirmation failed', { err: err.message });
  }
}

/** Notify customer that the spending cap was reached */
export async function sendBillingCapReached({
  toEmail,
  companyName,
  type,
  maxChargeLimit,
  attemptedAmount,
}) {
  try {
    const transport = createTransport();
    await transport.sendMail({
      from,
      to: toEmail,
      subject: `[PlaceholderParts] Spending cap reached for ${type} ad`,
      text: `Your ${type} advertisement for ${companyName} reached the spending cap of $${Number(maxChargeLimit).toFixed(2)}. The attempted charge was $${Number(attemptedAmount).toFixed(2)}. Please log in to approve additional spending if you want the ad to continue before the current 30-day period ends.`,
      html: `<p>Your <strong>${type}</strong> advertisement for <strong>${companyName}</strong> reached the spending cap of <strong>$${Number(maxChargeLimit).toFixed(2)}</strong>.</p><p>The attempted charge was <strong>$${Number(attemptedAmount).toFixed(2)}</strong>.</p><p>Please log in to approve additional spending if you want the ad to continue before the current 30-day period ends.</p>`,
    });
    logger.info('Billing cap notification sent', {
      toEmail,
      type,
      companyName,
    });
  } catch (err) {
    logger.error('sendBillingCapReached failed', { err: err.message });
  }
}

/** Notify customer that an off-session charge needs 3DS re-authentication */
export async function sendBillingReauthRequired({
  toEmail,
  companyName,
  type,
  reauthUrl,
}) {
  try {
    const transport = createTransport();
    await transport.sendMail({
      from,
      to: toEmail,
      subject: `[PlaceholderParts] Action needed: re-authenticate card for ${type} ad`,
      text: `Your bank requires additional authentication to continue billing for the ${type} advertisement (${companyName}). The ad has been paused. Please complete authentication here: ${reauthUrl}`,
      html: `<p>Your bank requires additional authentication to continue billing for the <strong>${type}</strong> advertisement (<strong>${companyName}</strong>).</p><p>The ad has been paused. Please complete authentication to resume:</p><p><a href="${reauthUrl}">${reauthUrl}</a></p>`,
    });
    logger.info('Billing reauth email sent', { toEmail, type, companyName });
  } catch (err) {
    logger.error('sendBillingReauthRequired failed', { err: err.message });
  }
}

/** Confirm approval for additional spending */
export async function sendBillingCapApprovalConfirmation({
  toEmail,
  companyName,
  type,
}) {
  try {
    const transport = createTransport();
    await transport.sendMail({
      from,
      to: toEmail,
      subject: `[PlaceholderParts] Additional spending approved – ${type} ad`,
      text: `Thank you! Your approval for additional spending on the ${type} advertisement for ${companyName} has been recorded. You can continue with checkout now.`,
      html: `<p>Thank you! Your approval for additional spending on the <strong>${type}</strong> advertisement for <strong>${companyName}</strong> has been recorded.</p><p>You can continue with checkout now.</p>`,
    });
    logger.info('Billing cap approval confirmation sent', {
      toEmail,
      type,
      companyName,
    });
  } catch (err) {
    logger.error('sendBillingCapApprovalConfirmation failed', {
      err: err.message,
    });
  }
}

/** Admin bulk email – sends individually so no recipient sees others */
export async function sendBulkEmail({ subject, html, text, recipients }) {
  const transport = createTransport();
  let sent = 0;
  let failed = 0;
  for (const email of recipients) {
    try {
      await transport.sendMail({ from, to: email, subject, text, html });
      sent++;
    } catch (err) {
      failed++;
      logger.error('Bulk email failed for recipient', {
        email,
        err: err.message,
      });
    }
  }
  logger.info('Bulk email dispatch complete', {
    sent,
    failed,
    total: recipients.length,
  });
  return { sent, failed };
}
