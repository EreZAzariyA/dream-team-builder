import logger from '../utils/logger.js';

// Only import MongoDB modules on server side
let MongoClient, mongoose;

if (typeof window === 'undefined') {
  // Server-side only imports
  ({ MongoClient } = require('mongodb'));
  mongoose = require('mongoose');
} else {
  // Client-side fallbacks
  MongoClient = null;
  mongoose = null;
}

// MongoDB connection configurations
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream-team';
const MONGODB_DB = process.env.MONGODB_DB || 'dream-team';

// Connection options for MongoDB native client
const mongoClientOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds
};

// Connection options for Mongoose (compatible with v8+)
const mongooseOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  // Modern Mongoose handles buffering automatically
};

// MongoDB native client (for direct operations)
let client;
let clientPromise;

async function createClientPromise() {
  client = new MongoClient(MONGODB_URI, mongoClientOptions);
  await client.connect();
  logger.info('✅ MongoDB native client connected successfully');
  return client;
}

if (!global._mongoClientPromise && typeof window === 'undefined' && MongoClient) {
  global._mongoClientPromise = createClientPromise();
}
clientPromise = global._mongoClientPromise;

// Mongoose connection (for ODM operations)
global.mongoose_connection = global.mongoose_connection || null;
global.listenersAttached = global.listenersAttached || false;

const connectMongoose = async () => {
  // Only run on server side
  if (typeof window !== 'undefined' || !mongoose) {
    throw new Error('Database operations can only be performed on the server side');
  }

  if (global.mongoose_connection && mongoose.connection.readyState === 1) {
    return global.mongoose_connection;
  }

  // Configure global Mongoose settings for modern versions
  mongoose.set('strictQuery', false); // Prepare for Mongoose 7+ behavior

  // Increase max listeners to prevent warnings in development
  if (mongoose.connection.getMaxListeners() < 15) {
    mongoose.connection.setMaxListeners(15);
  }

  try {
    global.mongoose_connection = await mongoose.connect(MONGODB_URI, {
      ...mongooseOptions,
      dbName: MONGODB_DB,
    });

    logger.info('✅ Mongoose connected successfully');

    // Only attach event listeners once to prevent memory leaks
    if (!global.listenersAttached) {
      // Connection event handlers
      mongoose.connection.on('connected', () => {
        logger.info('🔗 Mongoose connected to MongoDB');
      });

      mongoose.connection.on('error', (err) => {
        logger.error('❌ Mongoose connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.info('🔌 Mongoose disconnected from MongoDB');
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        logger.info('📴 Mongoose connection closed through app termination');
        process.exit(0);
      });

      global.listenersAttached = true;
    }

    return mongoose_connection;
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  };;
};

// Database utility functions
export const getDatabase = async () => {
  const client = await clientPromise;
  return client.db(MONGODB_DB);
};

export const getCollection = async (collectionName) => {
  const db = await getDatabase();
  return db.collection(collectionName);
};

// Health check function
export const checkDatabaseHealth = async () => {
  try {
    const client = await clientPromise;
    const admin = client.db().admin();
    const result = await admin.ping();

    return {
      status: 'healthy',
      message: 'Database connection is active',
      timestamp: new Date().toISOString(),
      ping: result,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
      timestamp: new Date().toISOString(),
      error: error,
    };
  }
};

// Initialize database indexes and setup
export const initializeDatabase = async () => {
  try {
    logger.info('🔧 Initializing database...');

    const db = await getDatabase();

    // Create indexes for better performance
    const indexes = [
      // Users collection indexes
      {
        collection: 'users',
        indexes: [
          { key: { email: 1 }, options: { unique: true } },
          { key: { googleId: 1 }, options: { sparse: true } },
          { key: { createdAt: 1 } },
        ],
      },
      // Workflows collection indexes
      {
        collection: 'workflows',
        indexes: [
          { key: { userId: 1, createdAt: -1 } },
          { key: { status: 1 } },
          { key: { 'metadata.tags': 1 } },
          { key: { startedAt: 1 } },
        ],
      },
      // Agent executions collection indexes
      {
        collection: 'agentExecutions',
        indexes: [
          { key: { workflowId: 1, startedAt: 1 } },
          { key: { agentId: 1 } },
          { key: { status: 1 } },
          { key: { completedAt: 1 } },
        ],
      },
      // Agent messages collection indexes
      {
        collection: 'agentMessages',
        indexes: [
          { key: { workflowId: 1, timestamp: 1 } },
          { key: { fromAgent: 1, toAgent: 1 } },
          { key: { messageType: 1 } },
        ],
      },
    ];

    // Create indexes
    for (const { collection, indexes: collectionIndexes } of indexes) {
      const coll = db.collection(collection);

      for (const { key, options = {} } of collectionIndexes) {
        try {
          await coll.createIndex(key, options);
          logger.info(`✅ Created index for ${collection}:`, key);
        } catch (error) {
          if (error.code !== 85) {
            // Index already exists error code
            logger.error(`❌ Failed to create index for ${collection}:`, error);
          }
        }
      }
    }

    logger.info('✅ Database initialization completed');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Connection state utilities
export const getConnectionState = () => {
  return {
    mongoose: {
      readyState: mongoose.connection.readyState,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
    },
    native: {
      isConnected: !!client && client.topology && client.topology.isConnected(),
    },
  };
};

// Export connections
export { clientPromise, connectMongoose, mongoose };
export default clientPromise;
