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
