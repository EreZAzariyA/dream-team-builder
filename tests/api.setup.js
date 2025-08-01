// API test setup
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { createMocks } from 'node-mocks-http'
import jwt from 'jsonwebtoken'

let mongoServer

// Setup in-memory MongoDB for API tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  
  console.log('🔌 API test MongoDB setup complete')
})

// Clean database between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
})

// Cleanup after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close()
  }
  
  if (mongoServer) {
    await mongoServer.stop()
  }
  
  console.log('🔌 API test cleanup complete')
})

// API test utilities
global.apiTestUtils = {
  // Create mock request/response objects
  createMockReqRes: (options = {}) => {
    const { method = 'GET', url = '/', body = {}, headers = {}, query = {} } = options
    
    return createMocks({
      method,
      url,
      body,
      headers,
      query,
    })
  },
  
  // Create authenticated request
  createAuthenticatedReq: (user = null, options = {}) => {
    const testUser = user || {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user',
    }
    
    const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '1h' })
    
    const { req, res } = apiTestUtils.createMockReqRes(options)
    req.headers.authorization = `Bearer ${token}`
    
    return { req, res }
  },
  
  // Create test user in database
  createTestUser: async (overrides = {}) => {
    const User = require('../lib/database/models/User')
    return await User.create({
      email: 'test@example.com',
      profile: { name: 'Test User', role: 'user' },
      passwordHash: 'hashed-password',
      isActive: true,
      isEmailVerified: true,
      ...overrides,
    })
  },
  
  // Extract JSON from response
  getResponseJson: (res) => {
    return JSON.parse(res._getData())
  },
  
  // Common API response assertions
  expectSuccess: (res, expectedData = null) => {
    expect(res.statusCode).toBe(200)
    const data = apiTestUtils.getResponseJson(res)
    expect(data.success).toBe(true)
    if (expectedData) {
      expect(data.data).toMatchObject(expectedData)
    }
    return data
  },
  
  expectError: (res, expectedStatus, expectedMessage = null) => {
    expect(res.statusCode).toBe(expectedStatus)
    const data = apiTestUtils.getResponseJson(res)
    expect(data.success).toBe(false)
    if (expectedMessage) {
      expect(data.error).toContain(expectedMessage)
    }
    return data
  },
}