'use strict';
import mongoose from 'mongoose';

const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    action: { type: String, required: true, maxlength: 100 },
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, maxlength: 45 },
  },
  {
    timestamps: true,
    // Keep last 10,000 entries automatically (capped collection behaviour)
  },
);

export default mongoose.model('AuditLog', auditLogSchema);
