'use strict';
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { connectDB } from '../config/db.js';
import Customer from '../models/Customer.js';
import CarouselSlide from '../models/CarouselSlide.js';
import GridAd from '../models/GridAd.js';
import SidebarItem from '../models/SidebarItem.js';

export async function seed() {
  console.log('[seed] Starting…');

  /* ── Admin account ───────────────────────────────────────────────────────── */
  const adminEmail = process.env.ADMIN_EMAIL || 'noname@nothing.com';
  const existingAdmin = await Customer.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin1234!', 12);
    await Customer.create({
      firstName: 'Site',
      lastName: 'Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
    });
    console.log(`[seed] Admin created: ${adminEmail} / Admin1234!`);
  } else {
    console.log('[seed] Admin already exists, skipping.');
  }

  /* ── Test customers ──────────────────────────────────────────────────────── */
  const testCustomers = [
    {
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@test.com',
      companyName: 'Acme Medical',
      companyPhone: '555-0101',
    },
    {
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob@test.com',
      companyName: 'BioTech Supplies',
      companyPhone: '555-0202',
    },
  ];

  const createdCustomers = [];
  for (const c of testCustomers) {
    let customer = await Customer.findOne({ email: c.email });
    if (!customer) {
      const passwordHash = await bcrypt.hash('Test1234!', 12);
      customer = await Customer.create({
        ...c,
        passwordHash,
        role: 'customer',
      });
      console.log(`[seed] Customer created: ${c.email} / Test1234!`);
    }
    createdCustomers.push(customer);
  }

  /* ── Sidebar items ───────────────────────────────────────────────────────── */
  const sidebarCount = await SidebarItem.countDocuments();
  if (!sidebarCount) {
    const items = [
      'Autoclaves',
      'Disposables',
      'Endoscopy',
      'Exam Chairs, Tables',
      'Head Lamps',
      'O.R. Lights',
      'O.R. Tables',
      'Property for Sale',
      "Sterilizer's, Table Top",
      'Vacuum Pumps',
    ];
    await SidebarItem.insertMany(
      items.map((label, i) => ({ label, order: i })),
    );
    console.log('[seed] Sidebar items created.');
  }

  /* ── Sample carousel slide (active, already approved + paid) ────────────── */
  const slideCount = await CarouselSlide.countDocuments();
  if (!slideCount && createdCustomers.length > 0) {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    await CarouselSlide.create({
      customerId: createdCustomers[0]._id,
      companyName: 'Acme Medical – Carousel Ad',
      companyWebsite: 'https://acmemedical.example.com',
      companyPhone: '555-0101',
      picturePath: '/uploads/placeholder-carousel.jpg',
      linkUrl: 'https://acmemedical.example.com',
      animationEnabled: true,
      status: 'active',
      paidAt: new Date(),
      expiresAt,
    });
    console.log('[seed] Sample carousel slide created (status: active).');
  }

  /* ── Sample grid ad (active) ─────────────────────────────────────────────── */
  const gridCount = await GridAd.countDocuments();
  if (!gridCount && createdCustomers.length > 1) {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    await GridAd.create({
      customerId: createdCustomers[1]._id,
      companyName: 'BioTech Supplies – Grid Ad',
      companyWebsite: 'https://biotechsupplies.example.com',
      companyPhone: '555-0202',
      picturePath: '/uploads/placeholder-grid.jpg',
      linkUrl: 'https://biotechsupplies.example.com',
      animationEnabled: false,
      status: 'active',
      paidAt: new Date(),
      expiresAt,
    });
    console.log('[seed] Sample grid ad created (status: active).');
  }

  console.log('[seed] Done.');
}

/* ── Run directly via: npm run seed ─────────────────────────────────────────── */
if (process.argv[1].endsWith('seed.js')) {
  connectDB()
    .then(() => seed())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] Error:', err.message);
      process.exit(1);
    });
}
