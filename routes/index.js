'use strict';
import { Router } from 'express';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';
import SidebarItem from '../models/SidebarItem.js';
import { decodeHtmlEntities } from '../utils/decodeHtmlEntities.js';
import { renderServerError } from '../utils/renderServerError.js';
import { recordImpressions } from '../utils/impressionTracker.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const customerId = req.session?.userId || null;

    const carouselCriteria = customerId
      ? {
          $or: [{ status: 'active' }, { status: 'pending', customerId }],
        }
      : { status: 'active' };

    const gridCriteria = customerId
      ? {
          $or: [{ status: 'active' }, { status: 'pending', customerId }],
        }
      : { status: 'active' };

    const [slides, gridAds, sidebarItems] = await Promise.all([
      CarouselSlide.find(carouselCriteria).sort('-createdAt').lean(),
      GridAd.find(gridCriteria).sort('-createdAt').lean(),
      SidebarItem.find().sort('order').lean(),
    ]);

    const sidebarItemsDecoded = sidebarItems.map((item) => ({
      ...item,
      label: decodeHtmlEntities(item.label),
    }));

    // Fire-and-forget impression tracking for active ads served on this page.
    // Skip ads owned by the current viewer so owners don't bill themselves
    // by previewing their own page.
    const ownerId = customerId ? String(customerId) : null;
    const isOtherOwner = (ad) => !ownerId || String(ad.customerId) !== ownerId;
    const activeCarouselIds = slides
      .filter((s) => s.status === 'active' && isOtherOwner(s))
      .map((s) => s._id);
    const activeGridIds = gridAds
      .filter((g) => g.status === 'active' && isOtherOwner(g))
      .map((g) => g._id);
    recordImpressions(CarouselSlide, activeCarouselIds, req);
    recordImpressions(GridAd, activeGridIds, req);

    res.render('index', {
      title:
        'Placeholder Parts – Autoclave, Sterilizer & Medical Equipment Parts',
      metaDescription:
        'PlaceholderParts.com – Buy and sell autoclaves, sterilizers, medical equipment, medical supplies, medical parts, hospital supplies, surgery center supplies. Advertise your parts today.',
      slides,
      gridAds,
      sidebarItems: sidebarItemsDecoded,
    });
  } catch (err) {
    console.error(err);
    renderServerError(req, res, err);
  }
});

export default router;
