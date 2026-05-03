'use strict';
import 'dotenv/config';
import http from 'http';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { logger } from './config/logger.js';
import CarouselSlide from './models/CarouselSlide.js';
import GridAd from './models/GridAd.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  await connectDB();

  /* ── Daily expiry check ────────────────────────────────────────────────────── */
  async function expireAds() {
    const now = new Date();
    const filter = { status: 'active', expiresAt: { $lte: now } };
    const [c, g] = await Promise.all([
      CarouselSlide.updateMany(filter, { $set: { status: 'expired' } }),
      GridAd.updateMany(filter, { $set: { status: 'expired' } }),
    ]);
    if (c.modifiedCount || g.modifiedCount) {
      logger.info('Auto-expired ads', {
        carousel: c.modifiedCount,
        grid: g.modifiedCount,
      });
    }
  }

  await expireAds();
  setInterval(expireAds, 24 * 60 * 60 * 1000);

  const app = createApp();
  const server = http.createServer(app);

  server.listen(PORT, () => {
    logger.info(`PlaceholderParts server running`, {
      port: PORT,
      env: process.env.NODE_ENV,
    });
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `\n  ➜  http://localhost:${PORT}\n  ➜  Admin: http://localhost:${PORT}/secure-admin/login\n`,
      );
    }
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

start().catch((err) => {
  logger.error('Startup failed', { err: err.message });
  process.exit(1);
});
