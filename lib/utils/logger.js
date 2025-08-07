
import winston from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

const { combine, timestamp, printf, colorize, align, errors } = winston.format;

const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const consoleFormat = combine(
  colorize(),
  align(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  logFormat
);

const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'info' : 'warn'),
  format: fileFormat,
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new LogtailTransport(logtail),
  ]
});

export default logger;
