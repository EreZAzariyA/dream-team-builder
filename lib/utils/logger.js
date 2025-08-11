
// Simple fallback logger for serverless environments to avoid file system issues
const createSimpleLogger = () => {
  const levels = ['error', 'warn', 'info', 'debug'];
  const logger = {};
  
  levels.forEach(level => {
    logger[level] = (...args) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} [${level.toUpperCase()}]:`, ...args);
    };
  });
  
  return logger;
};

// Create the logger instance
let logger;

// Use simple logger in serverless production environments
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production') {
  console.warn('Using simple logger for serverless environment');
  logger = createSimpleLogger();
} else {
  // Use Winston for development and non-serverless environments
  try {
    const winston = require('winston');
    const { combine, timestamp, printf, colorize, align, errors } = winston.format;

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

    // Create transports array - start with console transport
    const transports = [
      new winston.transports.Console({ 
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true
      })
    ];

    // Only add Logtail if token is available
    if (process.env.LOGTAIL_TOKEN) {
      try {
        const { Logtail } = require('@logtail/node');
        const { LogtailTransport } = require('@logtail/winston');
        const logtail = new Logtail(process.env.LOGTAIL_TOKEN);
        transports.push(new LogtailTransport(logtail));
      } catch (logtailError) {
        console.warn('Failed to initialize Logtail:', logtailError.message);
      }
    }

    logger = winston.createLogger({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'info' : 'warn'),
      format: fileFormat,
      transports,
      exitOnError: false,
      handleExceptions: true,
      handleRejections: true,
      silent: false,
      defaultMeta: { 
        service: 'dream-team',
        env: process.env.NODE_ENV || 'development'
      }
    });

    logger.on('error', (error) => {
      console.error('Logger error:', error);
    });

  } catch (winstonError) {
    console.warn('Winston failed to initialize, using simple logger:', winstonError.message);
    logger = createSimpleLogger();
  }
}

export default logger;
