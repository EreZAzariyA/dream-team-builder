// Integration test setup
const logger = require('@/lib/utils/logger')
const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')

let mongoServer

// Setup in-memory MongoDB for integration tests
beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()
  
  // Connect mongoose to in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  
  logger.info('🧪 Integration test MongoDB setup complete')
})

// Clean up database between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections
  
  for (const key in collections) {
    const collection = collections[key]
    await collection.deleteMany({})
  }
})

// Clean up after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close()
  }
  
  if (mongoServer) {
    await mongoServer.stop()
  }
  
  logger.info('🧪 Integration test cleanup complete')
})

// Test utilities for integration tests
global.integrationTestUtils = {
  // Create test user
  createTestUser: async () => {
    const User = require('../../lib/database/models/User')
    return await User.create({
      email: 'test@example.com',
      profile: { name: 'Test User' },
      passwordHash: 'hashed-password',
      isActive: true,
      isEmailVerified: true,
    })
  },
  
  // Create test workflow
  createTestWorkflow: async (userId, overrides = {}) => {
    const Workflow = require('../../lib/database/models/Workflow')
    return await Workflow.create({
      title: 'Test Workflow',
      description: 'Test workflow description',
      userId,
      prompt: 'Create a test application',
      template: 'FULL_STACK',
      status: 'draft',
      agentSequence: ['pm', 'architect', 'developer'],
      ...overrides,
    })
  },
  
  // Clean all collections
  cleanDatabase: async () => {
    const collections = mongoose.connection.collections
    for (const key in collections) {
      await collections[key].deleteMany({})
    }
  },
}