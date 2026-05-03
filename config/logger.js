'use strict';
import { createLogger, format, transports } from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '..', 'logs');

const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }),
);

const fileTransports = [
  new transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
  }),
  new transports.File({ filename: path.join(logsDir, 'combined.log') }),
];

const consoleTransport = new transports.Console({
  format: format.combine(format.colorize(), logFormat),
});

export const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports:
    process.env.NODE_ENV === 'development'
      ? [...fileTransports, consoleTransport]
      : fileTransports,
});
