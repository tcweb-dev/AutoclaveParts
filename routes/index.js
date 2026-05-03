'use strict';
import { Router } from 'express';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';
import SidebarItem from '../models/SidebarItem.js';

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
    res.render('index', {
      title:
        'Placeholder Parts – Autoclave, Sterilizer & Medical Equipment Parts',
      metaDescription:
        'PlaceholderParts.com – Buy and sell autoclaves, sterilizers, medical equipment, medical supplies, medical parts, hospital supplies, surgery center supplies. Advertise your parts today.',
      slides,
      gridAds,
      sidebarItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

export default router;
