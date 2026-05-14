'use strict';
import mongoose from 'mongoose';

const { Schema } = mongoose;

const customerSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    companyName: { type: String, trim: true, maxlength: 120 },
    companyWebsite: { type: String, trim: true, maxlength: 255 },
    address1: { type: String, trim: true, maxlength: 150 },
    address2: { type: String, trim: true, maxlength: 150 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 50 },
    zip: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 60, default: 'US' },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    picture1: { type: String, default: null },
    picture2: { type: String, default: null },
    picture3: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    adminIdleTimeoutMs: { type: Number, min: 1000, default: null },
    stripeCustomerId: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.model('Customer', customerSchema);
