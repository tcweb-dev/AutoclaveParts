'use strict';
import { logger } from '../config/logger.js';

/**
 * Bots/crawlers we never want to count as impressions. The list is intentionally
 * conservative — we'd rather miss the occasional bot than under-count humans.
 */
const BOT_UA_RE =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|preview|monitor|pingdom|uptimerobot|headless|phantomjs|puppeteer|playwright|httpclient|wget|curl|python-requests|go-http-client/i;

const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const DEDUP_MAX_ENTRIES = 50000;
const dedupCache = new Map(); // key -> expiry timestamp

function pruneCache(now) {
  if (dedupCache.size <= DEDUP_MAX_ENTRIES) return;
  for (const [key, expiry] of dedupCache) {
    if (expiry <= now) dedupCache.delete(key);
    if (dedupCache.size <= DEDUP_MAX_ENTRIES) break;
  }
  // If still oversized after expiry sweep, drop oldest insertions.
  while (dedupCache.size > DEDUP_MAX_ENTRIES) {
    const oldestKey = dedupCache.keys().next().value;
    if (oldestKey === undefined) break;
    dedupCache.delete(oldestKey);
  }
}

function clientFingerprint(req) {
  if (!req) return null;
  const ua = (req.get?.('user-agent') || '').slice(0, 200);
  const ip = req.ip || req.connection?.remoteAddress || '';
  return `${ip}|${ua}`;
}

function isBot(req) {
  if (!req) return false;
  const ua = req.get?.('user-agent') || '';
  if (!ua) return true; // empty UA → almost certainly a script/scraper
  return BOT_UA_RE.test(ua);
}

/**
 * Record one impression per ad id served. Skips bots and de-duplicates the same
 * IP+UA viewing the same ad within DEDUP_WINDOW_MS. Fire-and-forget.
 *
 * @param {import('mongoose').Model} Model Ad model (CarouselSlide or GridAd)
 * @param {Array<string|object>} adIds Array of ad ids that were rendered
 * @param {import('express').Request} [req] Express request for bot/dedup checks
 */
export function recordImpressions(Model, adIds, req) {
  if (!Array.isArray(adIds) || adIds.length === 0) return;
  if (isBot(req)) return;

  const now = Date.now();
  const fp = clientFingerprint(req);
  let countable = adIds;

  if (fp) {
    countable = [];
    for (const adId of adIds) {
      const key = `${Model.modelName}|${String(adId)}|${fp}`;
      const expiry = dedupCache.get(key);
      if (expiry && expiry > now) continue;
      dedupCache.set(key, now + DEDUP_WINDOW_MS);
      countable.push(adId);
    }
    pruneCache(now);
  }

  if (countable.length === 0) return;

  Model.updateMany(
    { _id: { $in: countable }, status: 'active' },
    { $inc: { impressionsTotal: 1 } },
  )
    .exec()
    .catch((err) => {
      logger.error('recordImpressions failed', {
        model: Model.modelName,
        err: err.message,
      });
    });
}
