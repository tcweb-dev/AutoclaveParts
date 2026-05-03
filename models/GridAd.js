'use strict';
import mongoose from 'mongoose';

const { Schema } = mongoose;

const gridAdSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    companyWebsite: { type: String, trim: true, maxlength: 255, default: '' },
    companyPhone: { type: String, trim: true, maxlength: 30, default: '' },
    companyDescription: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    picturePath: { type: String, required: true },
    picture2Path: { type: String, default: '' },
    picture2PositionX: { type: Number, min: 0, max: 100, default: 72 },
    picture2PositionY: { type: Number, min: 0, max: 100, default: 72 },
    picture2Scale: { type: Number, min: 20, max: 160, default: 100 },
    linkUrl: { type: String, trim: true, maxlength: 255, default: '' },
    animationEnabled: { type: Boolean, default: false },
    captionPosition: {
      type: String,
      enum: [
        'top-left',
        'top-center',
        'top-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ],
      default: 'bottom-left',
    },
    imagePosition: {
      type: String,
      enum: [
        'center',
        'top',
        'bottom',
        'left',
        'right',
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
      ],
      default: 'center',
    },
    imageScale: { type: Number, min: 20, max: 160, default: 100 },
    imageFitMode: {
      type: String,
      enum: ['contain', 'cover'],
      default: 'contain',
    },
    imagePositionX: { type: Number, min: 0, max: 100, default: 50 },
    imagePositionY: { type: Number, min: 0, max: 100, default: 50 },
    captionPositionX: { type: Number, min: 0, max: 100, default: 10 },
    captionPositionY: { type: Number, min: 0, max: 100, default: 88 },
    descriptionPositionX: { type: Number, min: 0, max: 100, default: 50 },
    descriptionPositionY: { type: Number, min: 0, max: 100, default: 78 },
    captionFontColor: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '#ffffff',
    },
    captionFontSize: { type: Number, min: 10, max: 48, default: 16 },
    captionFontWeight: {
      type: String,
      enum: ['400', '600', '700', '900'],
      default: '600',
    },
    descriptionFontColor: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '#ffffff',
    },
    descriptionFontSize: { type: Number, min: 10, max: 48, default: 14 },
    descriptionFontWeight: {
      type: String,
      enum: ['400', '600', '700', '900'],
      default: '400',
    },
    descriptionBgColor: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '#000000',
    },
    slideBgColor: { type: String, trim: true, maxlength: 30, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'active', 'expired', 'cancelled'],
      default: 'pending',
    },
    autoRenew: { type: Boolean, default: false },
    stripePaymentIntentId: { type: String, default: '' },
    stripeCustomerId: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('GridAd', gridAdSchema);
