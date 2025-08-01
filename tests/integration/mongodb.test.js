/**
 * MongoDB Integration Test
 * Tests MongoDB Memory Server setup and basic database operations
 */

const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')

describe('MongoDB Integration', () => {
  let mongoServer

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    
    // Connect mongoose
    await mongoose.connect(mongoUri)
    console.log('✅ MongoDB Memory Server started:', mongoUri)
  })

  afterAll(async () => {
    // Clean up
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
    
    if (mongoServer) {
      await mongoServer.stop()
    }
    
    console.log('✅ MongoDB Memory Server stopped')
  })

  beforeEach(async () => {
    // Clean database between tests
    const collections = mongoose.connection.collections
    for (const key in collections) {
      await collections[key].deleteMany({})
    }
  })

  test('should connect to MongoDB Memory Server', async () => {
    expect(mongoose.connection.readyState).toBe(1) // 1 = connected
    expect(mongoServer.getUri()).toContain('mongodb://127.0.0.1')
  })

  test('should create and find a document', async () => {
    // Define a simple test schema
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
    expect(foundDoc.name).toBe('Test Document')
  })

  test('should handle multiple documents', async () => {
    const TestSchema = new mongoose.Schema({
      name: String,
      category: String
    })
    
    const TestModel = mongoose.model('MultiTest', TestSchema)
    
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
    
    // Try to create document without required field - should fail
    await expect(
      TestModel.create({ numberField: 50 })
    ).rejects.toThrow()
    
    // Try to create document with invalid number - should fail
    await expect(
      TestModel.create({ requiredField: 'test', numberField: 150 })
    ).rejects.toThrow()
    
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