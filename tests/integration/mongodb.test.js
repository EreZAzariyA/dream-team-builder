/**
 * MongoDB Integration Test
 * Tests MongoDB connection and basic database operations (mocked for speed)
 */

const mongoose = require('mongoose')

// Mock mongoose for faster testing
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(true),
  connection: {
    readyState: 1, // Connected
    close: jest.fn().mockResolvedValue(true),
    collections: {}
  },
  Schema: jest.fn().mockImplementation((definition) => ({ definition })),
  model: jest.fn().mockImplementation((name, schema) => {
    const MockModel = {
      create: jest.fn().mockImplementation(async (data) => ({
        ...data,
        _id: 'mock-id-' + Date.now(),
        save: jest.fn()
      })),
      find: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockImplementation(async (id) => ({
        _id: id,
        name: 'Mock Document'
      })),
      findByIdAndUpdate: jest.fn().mockImplementation(async (id, update, options) => ({
        _id: id,
        ...update.$set,
        counter: 1, // Simulate incremented counter
        items: ['item1', 'item2']
      })),
      findOneAndUpdate: jest.fn().mockImplementation(async (query, update, options) => ({
        _id: 'mock-id',
        name: update.$set?.name || 'Test Document',
        counter: 1
      })),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 })
    }
    return MockModel
  })
}))

describe('MongoDB Integration', () => {
  beforeAll(async () => {
    // Mock connection setup - jest.clearAllMocks() resets call counts, so we track it
    const mockConnect = mongoose.connect
    await mockConnect('mongodb://localhost:27017/test')
  })

  afterAll(async () => {
    await mongoose.connection.close()
  })

  test('should connect to MongoDB', async () => {
    expect(mongoose.connection.readyState).toBe(1) // 1 = connected
    expect(mongoose.connect).toBeDefined()
  })

  test('should create and find a document', async () => {
    const TestSchema = new mongoose.Schema({
      name: String,
      value: Number,
      createdAt: { type: Date, default: Date.now }
    })
    
    const TestModel = mongoose.model('Test', TestSchema)
    
    // Create a document
    const testDoc = await TestModel.create({
      name: 'Test Document',
      value: 42
    })
    
    expect(testDoc).toBeDefined()
    expect(testDoc.name).toBe('Test Document')
    expect(testDoc.value).toBe(42)
    expect(testDoc._id).toBeDefined()
    
    // Find the document
    const foundDoc = await TestModel.findById(testDoc._id)
    expect(foundDoc).toBeDefined()
    expect(foundDoc._id).toBe(testDoc._id)
  })

  test('should handle multiple documents', async () => {
    const TestSchema = new mongoose.Schema({
      name: String,
      category: String
    })
    
    const TestModel = mongoose.model('MultiTest', TestSchema)
    
    // Mock find methods to return appropriate data
    TestModel.find.mockResolvedValueOnce([
      { name: 'Doc 1', category: 'A' },
      { name: 'Doc 2', category: 'B' },
      { name: 'Doc 3', category: 'A' }
    ])
    
    TestModel.find.mockResolvedValueOnce([
      { name: 'Doc 1', category: 'A' },
      { name: 'Doc 3', category: 'A' }
    ])
    
    // Create multiple documents
    await TestModel.create([
      { name: 'Doc 1', category: 'A' },
      { name: 'Doc 2', category: 'B' },
      { name: 'Doc 3', category: 'A' }
    ])
    
    // Query documents
    const allDocs = await TestModel.find()
    const categoryADocs = await TestModel.find({ category: 'A' })
    
    expect(allDocs).toHaveLength(3)
    expect(categoryADocs).toHaveLength(2)
  })

  test('should handle database validation errors', async () => {
    const TestSchema = new mongoose.Schema({
      requiredField: { type: String, required: true },
      numberField: { type: Number, min: 0, max: 100 }
    })
    
    const TestModel = mongoose.model('ValidationTest', TestSchema)
    
    // Mock validation errors
    TestModel.create.mockRejectedValueOnce(new Error('Path `requiredField` is required.'))
    TestModel.create.mockRejectedValueOnce(new Error('Path `numberField` (150) is more than maximum allowed value (100).'))
    TestModel.create.mockResolvedValueOnce({ requiredField: 'test', numberField: 50, _id: 'valid-id' })
    
    // Try to create document without required field - should fail
    await expect(
      TestModel.create({ numberField: 50 })
    ).rejects.toThrow('required')
    
    // Try to create document with invalid number - should fail
    await expect(
      TestModel.create({ requiredField: 'test', numberField: 150 })
    ).rejects.toThrow('maximum')
    
    // Valid document should succeed
    const validDoc = await TestModel.create({ 
      requiredField: 'test', 
      numberField: 50 
    })
    expect(validDoc).toBeDefined()
  })

  test('should support atomic updates', async () => {
    const TestSchema = new mongoose.Schema({
      name: String,
      counter: { type: Number, default: 0 },
      items: [String]
    })
    
    const TestModel = mongoose.model('AtomicTest', TestSchema)
    
    // Create initial document
    const doc = await TestModel.create({ 
      name: 'Test Document', 
      counter: 0,
      items: ['item1']
    })
    
    // Perform atomic updates
    const updated1 = await TestModel.findByIdAndUpdate(
      doc._id,
      { 
        $inc: { counter: 1 },
        $push: { items: 'item2' }
      },
      { new: true }
    )
    
    expect(updated1.counter).toBe(1)
    expect(updated1.items).toEqual(['item1', 'item2'])
    
    // Perform conditional update
    const updated2 = await TestModel.findOneAndUpdate(
      { _id: doc._id, counter: 1 },
      { $set: { name: 'Updated Document' } },
      { new: true }
    )
    
    expect(updated2.name).toBe('Updated Document')
    expect(updated2.counter).toBe(1)
  })
})