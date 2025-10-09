import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { User } from '../../../lib/database/models/index.js';
import { app } from '../../../app/api/user/api-keys/route.js'; // Assuming app is exported for testing
import { getServerSession } from 'next-auth/next';

// Mock NextAuth.js session
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

// Mock the Mongoose connection to prevent multiple connections
jest.mock('../../../lib/database/mongodb.js', () => ({
  connectMongoose: jest.fn().mockResolvedValue(true),
  disconnectMongoose: jest.fn().mockResolvedValue(true),
}));

let agent;
let testUser;

beforeEach(async () => {
  // Ensure User model is connected to the test database managed by api.setup.js
  // This is a workaround as we are mocking connectMongoose
  if (mongoose.connection.readyState === 0) {
    // This should ideally be handled by api.setup.js
    // For now, we'll ensure it's connected if not already
    await mongoose.connect(global.__MONGO_URI__);
  }
  await User.deleteMany({}); // Clear users before each test
  testUser = await User.create({
    email: 'test@example.com',
    password: 'password123',
    profile: { name: 'Test User' },
  });

  // Mock a valid session for the test user
  getServerSession.mockResolvedValue({
    user: {
      id: testUser._id.toString(),
      email: testUser.email,
    },
  });
});

// Add afterAll to ensure proper cleanup for this test file
afterAll(async () => {
  // Disconnect Mongoose if it was connected in this test file
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe('API Key Management API', () => {
  it('should allow a user to save OpenAI and Gemini API keys', async () => {
    const response = await request(app).post('/api/user/api-keys')
      .send({
        apiKeys: {
          openai: 'sk-proj-testopenaiapikey',
          gemini: 'AIzaTestGeminiApiKey',
        },
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('API keys saved successfully');
    expect(response.body.apiKeys.hasOpenai).toBe(true);
    expect(response.body.apiKeys.hasGemini).toBe(true);

    // Verify keys are stored (masked in response, but check DB if needed)
    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser.apiKeys.openai).toBeDefined();
    expect(updatedUser.apiKeys.gemini).toBeDefined();
  });

  it('should allow a user to clear a specific API key', async () => {
    // First save a key
    await request(app).post('/api/user/api-keys')
      .send({
        apiKeys: {
          openai: 'sk-proj-testopenaiapikey',
        },
      })
      .expect(200);

    // Then clear it
    const response = await request(app).patch('/api/user/api-keys')
      .send({
        provider: 'openai',
        action: 'clear',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('openai API key cleared successfully');
    expect(response.body.action).toBe('cleared');

    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser.apiKeys.openai).toBeUndefined();
  });

  it('should allow a user to update a specific API key', async () => {
    // First save a key
    await request(app).post('/api/user/api-keys')
      .send({
        apiKeys: {
          openai: 'sk-proj-oldopenaiapikey',
        },
      })
      .expect(200);

    // Then update it
    const response = await request(app).patch('/api/user/api-keys')
      .send({
        provider: 'openai',
        apiKey: 'sk-proj-newopenaiapikey',
        action: 'save',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('openai API key saved successfully');

    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser.apiKeys.openai).toBeDefined();
    // Note: The actual decrypted value is not directly exposed in the test without mocking encryption
  });

  it('should get masked API key status', async () => {
    // Save some keys first
    await request(app).post('/api/user/api-keys')
      .send({
        apiKeys: {
          openai: 'sk-proj-testopenaiapikey',
          gemini: 'AIzaTestGeminiApiKey',
        },
      })
      .expect(200);

    const response = await request(app).get('/api/user/api-keys').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.apiKeys.hasOpenai).toBe(true);
    expect(response.body.apiKeys.hasGemini).toBe(true);
    expect(response.body.apiKeys.openai).toBeUndefined(); // Should be masked
    expect(response.body.apiKeys.gemini).toBeUndefined(); // Should be masked
  });

  it('should get actual API key values when requested', async () => {
    // Save some keys first
    await request(app).post('/api/user/api-keys')
      .send({
        apiKeys: {
          openai: 'sk-proj-testopenaiapikey',
          gemini: 'AIzaTestGeminiApiKey',
        },
      })
      .expect(200);

    const response = await request(app).get('/api/user/api-keys?includeValues=true').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.apiKeys.hasOpenai).toBe(true);
    expect(response.body.apiKeys.hasGemini).toBe(true);
    expect(response.body.apiKeys.openai).toBeDefined(); // Should be unmasked
    expect(response.body.gemini).toBeDefined(); // Should be unmasked
  });

  it('should return 400 for invalid API key format', async () => {
    const response = await request(app).post('/api/user/api-keys')
      .send({
        apiKeys: {
          openai: 'invalid-key',
        },
      })
      .expect(400);

    expect(response.body.success).toBeUndefined();
    expect(response.body.error).toBe('No valid API keys provided');
  });

  it('should return 400 if no API key is provided for save action', async () => {
    const response = await request(app).patch('/api/user/api-keys')
      .send({
        provider: 'openai',
        action: 'save',
        apiKey: '',
      })
      .expect(400);

    expect(response.body.success).toBeUndefined();
    expect(response.body.error).toBe('API key is required');
  });
});
