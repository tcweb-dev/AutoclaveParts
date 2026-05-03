'use strict';
import mongoose from 'mongoose';

const { Schema } = mongoose;

const sidebarItemSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 100 },
    hrefUrl: { type: String, trim: true, maxlength: 255, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('SidebarItem', sidebarItemSchema);
