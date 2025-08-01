// Environment setup for tests
// Load test environment variables

// Test environment configuration
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-jwt-signing'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.MONGODB_URI = 'mongodb://localhost:27017/dream-team-test'
process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/dream-team-test'
process.env.JWT_SECRET = 'test-jwt-secret-key'

// AI Service test configuration
process.env.GOOGLE_GEMINI_API_KEY = 'test-gemini-key'
process.env.OPENAI_API_KEY = 'test-openai-key'

// Pusher test configuration
process.env.PUSHER_APP_ID = 'test-app-id'
process.env.PUSHER_KEY = 'test-key'
process.env.PUSHER_SECRET = 'test-secret'
process.env.PUSHER_CLUSTER = 'us2'
process.env.NEXT_PUBLIC_PUSHER_KEY = 'test-public-key'
process.env.NEXT_PUBLIC_PUSHER_CLUSTER = 'us2'

// OAuth test configuration
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GITHUB_ID = 'test-github-id'
process.env.GITHUB_SECRET = 'test-github-secret'

// Disable external network calls during tests
process.env.DISABLE_EXTERNAL_REQUESTS = 'true'