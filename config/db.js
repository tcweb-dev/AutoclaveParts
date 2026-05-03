'use strict';
import mongoose from 'mongoose';
import { logger } from './logger.js';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in environment');

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) =>
    logger.error('MongoDB error', { err: err.message }),
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected'),
  );

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
}
