# AI Service V2 - Refactored Architecture

## Quick Start

```javascript
import aiServiceV2 from '@/lib/ai/AIServiceV2';

// 1. Initialize (required)
const result = await aiServiceV2.initialize({
  userId: 'user123' // Loads from database
});

if (!result.success) {
  throw new Error(`Init failed: ${result.error.message}`);
}

// 2. Make AI calls
const response = await aiServiceV2.call('Your prompt here', {
  agent: myAgent,
  complexity: 2,
  userId: 'user123'
});

console.log(response.content);
```

## Architecture

### Core Components

```
AIServiceV2.js                 - Main orchestration & public API
├─ core/
│  ├─ AIServiceInitializer.js - Handles initialization with clear priority
│  └─ AIServiceCore.js        - Provider calling with retry & fallback
├─ services/
│  ├─ RequestQueue.js         - Rate limiting queue
│  └─ UsageTracker.js         - Usage tracking & limits
├─ handlers/
│  ├─ CircuitBreaker.js       - Circuit breaker pattern
│  └─ ErrorHandler.js         - Error categorization
└─ utils/
   ├─ ApiKeyValidator.js      - API key validation
   ├─ RetryPolicy.js          - Retry with backoff
   └─ ClientSideCrypto.js     - Client-side encryption
```

## Key Improvements from V1

### 1. Explicit Initialization
**Before (V1):**
- Auto-initialized on first call
- Confusing error states
- Unclear when initialization happens

**After (V2):**
- Must call `initialize()` explicitly
- Clear success/failure states
- Detailed error information

### 2. Simplified API Key Loading
**Before (V1):**
- 4 different sources tried automatically
- Hard to debug which source was used
- Mixed server/client logic

**After (V2):**
- Clear priority: Direct → Database → LocalStorage
- Explicit options for each source
- Separate server/client paths

### 3. Cleaner Call Signature
**Before (V1):**
```javascript
call(prompt, agent, complexity, context, userId, useTools)
```

**After (V2):**
```javascript
call(prompt, { agent, complexity, context, userId, useTools })
```

### 4. Better Error Handling
**Before (V1):**
- Nested try-catch blocks
- Auto-initialization in call method
- Hard to trace error sources

**After (V2):**
- Clean error propagation
- No hidden initialization
- Detailed error states

### 5. Removed Dead Code
**V1 had:**
- Broken streaming functionality
- Unused fallback providers
- Deprecated methods

**V2 has:**
- Only working features
- Clean deprecation path
- No technical debt

## API Reference

### Initialize

```javascript
await aiServiceV2.initialize(options)
```

**Options:**
```javascript
{
  apiKeys: {          // Direct API keys (Priority 1)
    gemini: string,
    openai: string
  },
  userId: string,     // Database lookup (Priority 2, server-side only)
  useLocalStorage: boolean  // LocalStorage (Priority 3, client-side only)
}
```

**Returns:**
```javascript
{
  success: boolean,
  error?: {
    code: string,      // NO_API_KEYS | INVALID_API_KEYS | CLIENT_INIT_FAILED
    message: string,
    details?: any
  },
  providers?: {
    gemini: boolean,
    openai: boolean
  }
}
```

### Call

```javascript
await aiServiceV2.call(prompt, options)
```

**Options:**
```javascript
{
  agent?: Object,           // Agent configuration
  complexity?: number,      // 1-4 (default: 1)
  context?: Object,         // Additional context
  userId?: string,          // For usage tracking
  useTools?: boolean        // Enable tool calling (default: false)
}
```

**Returns:**
```javascript
{
  content: string,          // AI response text
  provider: string,         // 'gemini' | 'openai'
  usage: {
    total_tokens: number,
    prompt_tokens: number,
    completion_tokens: number
  }
}
```

### Health Check

```javascript
await aiServiceV2.healthCheck()
```

**Returns:**
```javascript
{
  status: 'healthy' | 'unhealthy' | 'uninitialized',
  providers: {
    gemini: { healthy: boolean, error?: string },
    openai: { healthy: boolean, error?: string }
  },
  healthyProviders: string[],
  timestamp: string
}
```

### Get State

```javascript
aiServiceV2.getInitializationState()
```

**Returns:**
```javascript
{
  initialized: boolean,
  error: Object | null,
  hasCore: boolean,
  hasSdkService: boolean,
  hasApiKeys: boolean
}
```

## Usage Examples

### Server-Side Initialization

```javascript
// app/api/ai/route.js
import aiServiceV2 from '@/lib/ai/AIServiceV2';
import { getServerSession } from 'next-auth';

export async function POST(request) {
  const session = await getServerSession();

  // Initialize with user's API keys from database
  const initResult = await aiServiceV2.initialize({
    userId: session.user.id
  });

  if (!initResult.success) {
    return Response.json({
      error: initResult.error.message
    }, { status: 400 });
  }

  const { prompt } = await request.json();

  const result = await aiServiceV2.call(prompt, {
    userId: session.user.id,
    complexity: 2
  });

  return Response.json(result);
}
```

### Client-Side Initialization

```javascript
// components/AIChat.js
import { useEffect, useState } from 'react';
import aiServiceV2 from '@/lib/ai/AIServiceV2';

export function AIChat() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      const result = await aiServiceV2.initialize({
        useLocalStorage: true
      });

      if (!result.success) {
        setError(result.error.message);
      } else {
        setInitialized(true);
      }
    }

    init();
  }, []);

  if (error) return <div>Error: {error}</div>;
  if (!initialized) return <div>Initializing...</div>;

  return <div>Ready to chat!</div>;
}
```

### Tool Calling

```javascript
const result = await aiServiceV2.call('List files in the repo', {
  userId: session.user.id,
  useTools: true,
  context: {
    repository: {
      owner: 'myorg',
      name: 'myrepo'
    }
  }
});

// AI can now call file system and git tools
console.log(result.content);
```

### Reinitialize with New Keys

```javascript
// User updates their API keys
async function updateApiKeys(newKeys) {
  const result = await aiServiceV2.reinitialize(newKeys);

  if (result.success) {
    console.log('Keys updated successfully');
  } else {
    console.error('Failed to update:', result.error.message);
  }
}
```

## Error Handling

### Initialization Errors

```javascript
const result = await aiServiceV2.initialize({ userId });

if (!result.success) {
  switch (result.error.code) {
    case 'NO_API_KEYS':
      // User hasn't configured API keys
      redirectToSettings();
      break;

    case 'INVALID_API_KEYS':
      // API keys are malformed
      showValidationError(result.error.details);
      break;

    case 'CLIENT_INIT_FAILED':
      // Provider clients failed to initialize
      showProviderError();
      break;

    default:
      showGenericError(result.error.message);
  }
}
```

### Call Errors

```javascript
try {
  const result = await aiServiceV2.call(prompt, options);
} catch (error) {
  if (error.message.includes('not initialized')) {
    // Service wasn't initialized
    await initializeService();
  } else if (error.message.includes('Usage limit exceeded')) {
    // User hit rate limit
    showLimitError();
  } else if (error.message.includes('All AI providers failed')) {
    // Both providers are down
    showProviderOutage();
  } else {
    // Generic error
    showError(error.message);
  }
}
```

## Testing

### Unit Tests

```javascript
import { AIServiceV2 } from '@/lib/ai/AIServiceV2';

describe('AIServiceV2', () => {
  let service;

  beforeEach(() => {
    service = new AIServiceV2();
  });

  it('requires initialization', async () => {
    await expect(
      service.call('test', {})
    ).rejects.toThrow('not initialized');
  });

  it('initializes with API keys', async () => {
    const result = await service.initialize({
      apiKeys: { gemini: 'test-key' }
    });

    expect(result.success).toBe(true);
  });
});
```

### Integration Tests

```javascript
describe('AIServiceV2 Integration', () => {
  it('completes full workflow', async () => {
    const service = new AIServiceV2();

    await service.initialize({
      apiKeys: {
        gemini: process.env.TEST_GEMINI_KEY
      }
    });

    const result = await service.call('Hello', {
      complexity: 1
    });

    expect(result.content).toBeTruthy();
    expect(result.provider).toBe('gemini');
  });
});
```

## Migration

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration instructions from V1 to V2.

## Performance

### Initialization
- Database lookup: ~50-100ms
- LocalStorage lookup: ~5-10ms
- Direct keys: Instant

### API Calls
- Gemini: ~500-2000ms
- OpenAI: ~800-3000ms
- With circuit breaker: +0-5ms overhead
- With retry: Exponential backoff (2s, 6s, 18s)

### Memory
- Base service: ~2MB
- Per request: ~100KB
- Request queue: ~50KB per queued item

## Security

### API Key Storage
- **Server**: Encrypted in MongoDB with crypto.js
- **Client**: Encrypted in localStorage with ClientSideCrypto
- **Never**: Stored in plain text or logs

### Key Validation
- Format validation before use
- Provider-specific format checks
- Invalid keys rejected immediately

### Usage Limits
- Per-user rate limiting
- Quota tracking
- Cost estimation

## Troubleshooting

### Service Won't Initialize

```javascript
const state = aiServiceV2.getInitializationState();
console.log('State:', state);

if (state.error) {
  console.log('Error code:', state.error.code);
  console.log('Error message:', state.error.message);
}
```

### Calls Failing

```javascript
// Check health
const health = await aiServiceV2.healthCheck();
console.log('Health:', health);

// Check stats
const stats = aiServiceV2.getHealthStats();
console.log('Stats:', stats);
```

### Circuit Breaker Open

```javascript
// Reset circuit breakers
aiServiceV2.resetCircuitBreakers();

// Wait and retry
await new Promise(resolve => setTimeout(resolve, 60000));
const result = await aiServiceV2.call(prompt, options);
```

## Support

For issues or questions:
1. Check the migration guide
2. Review error codes and messages
3. Check health status
4. Review logs for detailed errors
5. Create an issue with full context

---

**Version:** 2.0.0
**Last Updated:** 2025-10-21
**Status:** Production Ready
