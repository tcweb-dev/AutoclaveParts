'use strict';
import 'dotenv/config';
import { connectDB } from '../config/db.js';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';

async function run() {
  await connectDB();
  const filter = {
    status: { $in: ['paused', 'expired', 'cancelled'] },
    $or: [{ inactiveSince: null }, { inactiveSince: { $exists: false } }],
  };
  const update = [{ $set: { inactiveSince: '$updatedAt' } }];
  const [c, g] = await Promise.all([
    CarouselSlide.updateMany(filter, update),
    GridAd.updateMany(filter, update),
  ]);
  console.log('Backfilled inactiveSince:', {
    carousel: c.modifiedCount,
    grid: g.modifiedCount,
  });
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
