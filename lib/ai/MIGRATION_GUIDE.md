# AI Service V2 Migration Guide

## Overview

AIService has been refactored to address complexity and maintainability issues identified in the codebase analysis. The new V2 architecture provides:

- ✅ **Explicit initialization** - No auto-initialization confusion
- ✅ **Clear error states** - Know exactly why initialization failed
- ✅ **Simplified API key loading** - Clear priority order
- ✅ **Modular architecture** - Separated concerns into specialized classes
- ✅ **Removed broken streaming** - Cleaned up non-functional code
- ✅ **Better error handling** - Reduced nesting and complexity

## Architecture Changes

### Old (V1) Structure
```
AIService.js (1208 lines)
├─ Initialization logic (4 sources, confusing)
├─ Provider calling logic
├─ Circuit breakers & retry
├─ Usage tracking
├─ Tool calling
├─ Health checks
└─ Auto-initialization in call method
```

### New (V2) Structure
```
AIServiceV2.js (400 lines)
├─ Main orchestration
└─ Uses:
    ├─ AIServiceInitializer.js - Clean initialization
    ├─ AIServiceCore.js - Provider calling
    ├─ RequestQueue.js - Rate limiting
    ├─ UsageTracker.js - Usage tracking
    └─ AISdkService.js - Tool calling
```

## Breaking Changes

### 1. Explicit Initialization Required

**Old (V1):**
```javascript
// Auto-initialized on first call - confusing
const aiService = AIService.getInstance();
const result = await aiService.call(prompt, agent, 1, {}, userId);
// ❌ When did it initialize? What if it fails?
```

**New (V2):**
```javascript
// Explicit initialization - clear
const aiService = AIServiceV2.getInstance();

const initResult = await aiService.initialize({ userId });

if (!initResult.success) {
  console.error('Init failed:', initResult.error);
  return;
}

const result = await aiService.call(prompt, { userId, agent, complexity: 1 });
// ✅ We know it's initialized and ready
```

### 2. Changed Call Signature

**Old (V1):**
```javascript
await aiService.call(
  prompt,
  agent,          // positional
  complexity,     // positional
  context,        // positional
  userId,         // positional
  useTools        // positional
);
```

**New (V2):**
```javascript
await aiService.call(prompt, {
  agent,
  complexity,
  context,
  userId,
  useTools
});
// ✅ Named parameters - much clearer
```

### 3. Initialization Options

**Old (V1):**
```javascript
// Tried 4 different sources automatically
await aiService.initialize(apiKeys, userId);
```

**New (V2):**
```javascript
// Explicit about what to try
await aiService.initialize({
  apiKeys: { gemini: 'key', openai: 'key' }, // Priority 1
  userId: 'user123',                         // Priority 2 (database)
  useLocalStorage: true                      // Priority 3 (client-side)
});
```

### 4. Streaming Removed

**Old (V1):**
```javascript
// Was broken, commented out
const result = await aiService.streamResponse(...);
```

**New (V2):**
```javascript
// Removed entirely - use regular call method
const result = await aiService.call(prompt, options);
```

## Migration Steps

### Step 1: Update Initialization

Find all places where AIService is initialized:

```javascript
// OLD
import aiService from '@/lib/ai/AIService';
await aiService.initialize(userKeys, userId);

// NEW
import aiServiceV2 from '@/lib/ai/AIServiceV2';

const result = await aiServiceV2.initialize({
  apiKeys: userKeys,
  userId: userId
});

if (!result.success) {
  throw new Error(`AI Service init failed: ${result.error.message}`);
}
```

### Step 2: Update Call Sites

Find all `aiService.call()` usage:

```javascript
// OLD
const result = await aiService.call(
  prompt,
  agent,
  complexity,
  context,
  userId,
  false // useTools
);

// NEW
const result = await aiService.call(prompt, {
  agent,
  complexity,
  context,
  userId,
  useTools: false
});
```

### Step 3: Update Error Handling

```javascript
// OLD
try {
  const result = await aiService.call(...);
} catch (error) {
  // Error could be initialization or API error - unclear
}

// NEW
// Check initialization state
const state = aiService.getInitializationState();
if (!state.initialized) {
  console.error('Not initialized:', state.error);
  return;
}

try {
  const result = await aiService.call(prompt, options);
} catch (error) {
  // Definitely an API call error
}
```

### Step 4: Update Tool Calling

```javascript
// OLD
const result = await aiService.call(
  prompt,
  agent,
  1,
  { repository: repo },
  userId,
  true // useTools
);

// NEW
const result = await aiService.call(prompt, {
  agent,
  complexity: 1,
  context: { repository: repo },
  userId,
  useTools: true
});
```

### Step 5: Update Reinitialization

```javascript
// OLD
await aiService.reinitializeWithUserKeys(newKeys, userId);

// NEW
await aiService.reinitialize(newKeys);
```

## New Features

### 1. Clear Initialization State

```javascript
const state = aiService.getInitializationState();
console.log(state);
// {
//   initialized: true,
//   error: null,
//   hasCore: true,
//   hasSdkService: true,
//   hasApiKeys: true
// }
```

### 2. Detailed Error Information

```javascript
const result = await aiService.initialize({ userId });

if (!result.success) {
  console.log(result.error.code); // NO_API_KEYS, INVALID_API_KEYS, etc.
  console.log(result.error.message); // Human-readable message
  console.log(result.error.details); // Additional context
}
```

### 3. Explicit API Key Priority

```javascript
// Priority 1: Direct keys (highest)
await aiService.initialize({
  apiKeys: { gemini: 'key' }
});

// Priority 2: Database lookup (server-side only)
await aiService.initialize({
  userId: 'user123'
});

// Priority 3: LocalStorage (client-side only)
await aiService.initialize({
  useLocalStorage: true
});
```

## Code Search & Replace

Use these patterns to find code that needs updating:

### Find V1 Imports
```bash
grep -r "from.*AIService['\"]" --include="*.js"
grep -r "AIService.getInstance()" --include="*.js"
```

### Find V1 Call Patterns
```bash
grep -r "aiService.call(" --include="*.js"
grep -r "streamResponse" --include="*.js"
```

### Find Auto-Initialization Usage
```bash
grep -r "Auto-initializing" --include="*.js"
```

## Testing Strategy

### 1. Unit Tests

```javascript
import { AIServiceV2 } from '@/lib/ai/AIServiceV2';

describe('AIServiceV2', () => {
  it('should require initialization before calling', async () => {
    const service = new AIServiceV2();

    await expect(
      service.call('test', {})
    ).rejects.toThrow('AI Service not initialized');
  });

  it('should initialize with direct API keys', async () => {
    const service = new AIServiceV2();

    const result = await service.initialize({
      apiKeys: { gemini: 'test-key' }
    });

    expect(result.success).toBe(true);
    expect(service.getInitializationState().initialized).toBe(true);
  });
});
```

### 2. Integration Tests

```javascript
describe('AIServiceV2 Integration', () => {
  it('should complete full workflow', async () => {
    const service = new AIServiceV2();

    // Initialize
    await service.initialize({ userId: 'test-user' });

    // Make call
    const result = await service.call('Hello', {
      complexity: 1,
      userId: 'test-user'
    });

    expect(result.content).toBeTruthy();
    expect(result.provider).toMatch(/gemini|openai/);
  });
});
```

## Rollback Plan

If issues arise, you can temporarily keep both versions:

```javascript
// In your code
import aiServiceV1 from '@/lib/ai/AIService'; // Old
import aiServiceV2 from '@/lib/ai/AIServiceV2'; // New

// Use V2 with fallback to V1
let service = aiServiceV2;
try {
  await service.initialize({ userId });
} catch (error) {
  console.warn('V2 failed, falling back to V1');
  service = aiServiceV1;
  await service.initialize(null, userId);
}
```

## Timeline

### Phase 1: Testing (Week 1)
- [ ] Add unit tests for AIServiceV2
- [ ] Add integration tests
- [ ] Test in development environment

### Phase 2: Gradual Migration (Week 2)
- [ ] Update API routes to use V2
- [ ] Update BMAD orchestrator
- [ ] Update agent executors

### Phase 3: Complete Migration (Week 3)
- [ ] Update remaining code
- [ ] Remove V1 code
- [ ] Update documentation

## FAQ

### Q: Can I use both V1 and V2 simultaneously?
**A:** Yes, they use different singletons. But plan to migrate fully to V2.

### Q: What happens to existing users?
**A:** V2 still supports database and localStorage API key loading. Users won't notice a difference.

### Q: Will this affect usage tracking?
**A:** No, usage tracking works the same way in V2.

### Q: What about circuit breakers and retry logic?
**A:** Still present in AIServiceCore - same behavior, better organization.

### Q: Why remove streaming?
**A:** It was broken for multi-user apps and never fully functional. We can re-add properly later if needed.

## Support

If you encounter issues during migration:

1. Check the initialization state: `aiService.getInitializationState()`
2. Review error details: `result.error` from initialize
3. Check logs for detailed error messages
4. Create an issue with migration tag

## Benefits Summary

✅ **Clearer code** - Explicit is better than implicit
✅ **Better errors** - Know exactly what failed and why
✅ **Easier debugging** - Clear separation of concerns
✅ **Maintainable** - Each class has one responsibility
✅ **Testable** - Pure functions, no hidden state
✅ **Documented** - JSDoc comments throughout

---

**Last Updated:** 2025-10-21
**Version:** 2.0.0
