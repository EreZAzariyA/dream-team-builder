# Dream Team Testing Suite

This directory contains the comprehensive test suite for the Dream Team BMAD workflow orchestration platform.

## 📁 Test Structure

```
tests/
├── __mocks__/              # Mock implementations
│   ├── ai-service.js      # Mock AI service with configurable responses
│   ├── pusher.js          # Mock Pusher for real-time testing
│   └── fileMock.js        # Static file mock
├── fixtures/               # Test data and configurations
│   ├── agents/            # Mock agent definitions
│   ├── workflows/         # Sample workflow configurations
│   └── templates/         # Test templates
├── integration/            # Integration tests
│   ├── bmad-orchestration.test.js
│   └── workflow-engine.test.js
├── unit/                   # Unit tests
│   └── lib/bmad/
├── api/                    # API endpoint tests
│   └── bmad/
├── e2e/                    # End-to-end tests (placeholder)
└── performance/            # Performance tests (placeholder)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB (for integration tests)
- npm dependencies installed

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Types
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# API tests only
npm run test:api

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

## 🧪 Test Categories

### Unit Tests
- **Purpose**: Test individual components in isolation
- **Speed**: Fast (<1s each)
- **Coverage**: Business logic, utilities, pure functions
- **Example**: `AgentCommunicator.test.js`

### Integration Tests  
- **Purpose**: Test component interactions and workflows
- **Speed**: Medium (5-15s each)
- **Coverage**: BMAD orchestration, agent execution, communication
- **Example**: `bmad-orchestration.test.js`

### API Tests
- **Purpose**: Test REST endpoint functionality
- **Speed**: Medium (2-10s each) 
- **Coverage**: Request/response handling, authentication, validation
- **Example**: `workflow.test.js`

### E2E Tests (Future)
- **Purpose**: Test complete user journeys
- **Speed**: Slow (30s-2min each)
- **Coverage**: Full workflow creation to completion

## 🎭 Mock Services

### AI Service Mock
Located in `__mocks__/ai-service.js`

```javascript
const mockAI = new MockAIService()

// Configure behavior
mockAI.configure({
  delay: 100,           // Response delay in ms
  shouldFail: false,    // Force failures
  failureRate: 0.1      // Random failure rate
})

// Set predefined responses
mockAI.setResponse('pm', {
  content: 'PM work complete',
  artifacts: [...]
})
```

### Pusher Mock
Located in `__mocks__/pusher.js`

```javascript
// Access events sent via Pusher
const events = mockPusherServer.getEvents()
const workflowEvents = mockPusherServer.getEventsForChannel('workflow-123')

// Simulate client-side events
mockPusherClient.simulateEvent('workflow-123', 'update', data)
```

## 🔧 Test Configuration

### Jest Configuration
- **Config File**: `jest.config.js`
- **Setup Files**: `tests/setup.js`, `tests/env.setup.js`
- **Coverage Thresholds**: 85% overall, 90% for BMAD core

### Environment Variables
Test environment variables are set in `tests/env.setup.js`:

```javascript
process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = 'mongodb://localhost:27017/dream-team-test'
process.env.NEXTAUTH_SECRET = 'test-secret'
// ... more test configs
```

### Database Setup
Integration and API tests use MongoDB Memory Server for isolation:

```javascript
// Automatic setup in integration.setup.js and api.setup.js
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})
```

## 📊 Coverage Goals

### Current Targets
- **Overall**: 85% line coverage
- **BMAD Core**: 90% line coverage (`lib/bmad/`)
- **API Routes**: 100% endpoint coverage
- **Critical Paths**: 100% workflow orchestration coverage

### Coverage Reports
```bash
# Generate HTML coverage report
npm run test:coverage

# View coverage
open coverage/lcov-report/index.html
```

## 🎯 Test Patterns

### BMAD Workflow Testing
```javascript
// 1. Setup mock AI responses
mockAI.setResponse('pm', expectedResponse)

// 2. Start workflow
const { workflowId } = await orchestrator.startWorkflow(prompt, config)

// 3. Wait for completion
await waitForWorkflowCompletion(workflowId)

// 4. Assert results
const status = await orchestrator.getWorkflowStatus(workflowId)
expect(status.status).toBe('COMPLETED')
```

### API Testing Pattern
```javascript
// 1. Create authenticated request
const { req, res } = apiTestUtils.createAuthenticatedReq(user, {
  method: 'POST',
  body: requestData
})

// 2. Call handler
await apiHandler.POST(req, res)

// 3. Assert response
apiTestUtils.expectSuccess(res, expectedData)
```

### Error Testing Pattern
```javascript
// Configure mock to fail
mockAI.configure({ shouldFail: true })

// Execute operation
const result = await operation()

// Assert error handling
expect(result.status).toBe('ERROR')
expect(result.error).toBeDefined()
```

## 🚨 Common Issues & Solutions

### MongoDB Connection Issues
```bash
# Ensure MongoDB is running for integration tests
brew services start mongodb-community
# or
docker run -d -p 27017:27017 mongo:7
```

### Test Timeouts
```javascript
// Increase timeout for slow operations
test('slow operation', async () => {
  // test code
}, 30000) // 30 second timeout
```

### Mock Reset Issues
```javascript
// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks()
  mockAI.clearResponses()
  mockPusherServer.clearEvents()
})
```

### Memory Leaks
```javascript
// Clean up resources
afterEach(async () => {
  await orchestrator.cleanup()
  await mongoose.connection.close()
})
```

## 🔄 CI/CD Integration

Tests run automatically on:
- **Every push** to main/develop branches
- **Every pull request**
- **Scheduled runs** (nightly)

### GitHub Actions Workflow
- **Unit & Integration Tests**: Run on all Node.js versions (18, 20)
- **E2E Tests**: Run on PR only
- **Performance Tests**: Run when labeled
- **Security Scans**: Run on every push

### Quality Gates
- All tests must pass
- Coverage must meet thresholds
- Security scans must pass
- Linting must pass

## 📈 Performance Testing

### Load Testing (Future)
```bash
# Install Artillery
npm install -g artillery

# Run load tests
npm run test:performance
```

### Benchmarking
Key metrics to track:
- Agent execution time (<5s average)
- Workflow completion time
- Memory usage during concurrent workflows
- API response times

## 🛠️ Development Workflow

### Adding New Tests

1. **Unit Test**:
   ```bash
   # Create test file
   touch tests/unit/lib/new-component.test.js
   
   # Follow naming convention: ComponentName.test.js
   ```

2. **Integration Test**:
   ```bash
   # Create integration test
   touch tests/integration/new-feature.test.js
   
   # Include database setup/teardown
   ```

3. **API Test**:
   ```bash
   # Create API test
   touch tests/api/new-endpoint.test.js
   
   # Include authentication testing
   ```

### Test-Driven Development
1. Write failing test
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. Repeat

### Running Tests During Development
```bash
# Watch mode for immediate feedback
npm run test:watch

# Run specific test file
npx jest tests/unit/lib/bmad/AgentCommunicator.test.js

# Run tests matching pattern
npx jest --testNamePattern="should handle errors"
```

## 🔍 Debugging Tests

### Debug Mode
```bash
# Run with debug output
DEBUG=* npm test

# Run single test with debugging
node --inspect-brk node_modules/.bin/jest --runInBand specific.test.js
```

### Logging
```javascript
// Enable console logs in tests (uncomment in setup.js)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  // ...
}
```

### Snapshot Testing
```javascript
// Update snapshots
npm test -- --updateSnapshot

// Interactive snapshot update
npm test -- --watch
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library Guide](https://testing-library.com/docs/)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [Supertest API Testing](https://github.com/visionmedia/supertest)

## 🤝 Contributing

1. Write tests for all new features
2. Maintain or improve coverage
3. Follow existing test patterns
4. Update this README for new patterns
5. Ensure all tests pass in CI

---

**Remember**: Good tests are the foundation of reliable software. Write tests that are clear, fast, and maintainable! 🧪✨