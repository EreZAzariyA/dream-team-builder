# API Routes Migration to AIServiceV2

## Routes to Update

Found 14 API routes that use AIService. Here's the update strategy:

### Priority 1: Core AI Routes (Update First)

1. **`app/api/ai/health/route.js`** - Health monitoring
2. **`app/api/ai/reinitialize/route.js`** - Reinitialization
3. **`app/api/ai/usage/route.js`** - Usage stats
4. **`app/api/ai/validate-keys/route.js`** - Key validation
5. **`app/api/user/api-keys/route.js`** - User API key management

### Priority 2: Chat & Messaging Routes

6. **`app/api/bmad/agents/chat/route.js`** - Agent chat
7. **`app/api/bmad/agents/chat/stream/route.js`** - Streaming chat
8. **`app/api/bmad/agents/chat/handlers/messageHandler.js`** - Message handling
9. **`app/api/bmad/agents/chat/handlers/initializationHandler.js`** - Chat initialization
10. **`app/api/workflows/[workflowId]/chat/route.js`** - Workflow chat
11. **`app/api/pusher/send-message/route.js`** - Pusher messaging

### Priority 3: Repository & Insights

12. **`app/api/repo/chat/route.js`** - Repository chat
13. **`app/api/repo/insights/route.js`** - Repository insights
14. **`app/api/usage/stats/route.js`** - Usage statistics

## Update Pattern

### Old Pattern (V1)
```javascript
import { AIService } from '@/lib/ai/AIService.js';

const aiService = AIService.getInstance();

// Auto-initialization (confusing)
if (!aiService.initialized) {
  await aiService.initialize(null, userId);
}

// Old call signature
const result = await aiService.call(
  prompt,
  agent,
  complexity,
  context,
  userId,
  useTools
);
```

### New Pattern (V2)
```javascript
import { AIServiceV2 } from '@/lib/ai/AIServiceV2.js';

const aiService = AIServiceV2.getInstance();

// Explicit initialization with error handling
if (!aiService.initialized) {
  const initResult = await aiService.initialize({ userId });
  if (!initResult.success) {
    return NextResponse.json({
      error: `AI initialization failed: ${initResult.error.message}`,
      errorCode: initResult.error.code
    }, { status: 500 });
  }
}

// New call signature
const result = await aiService.call(prompt, {
  agent,
  complexity,
  context,
  userId,
  useTools
});
```

## Automated Find & Replace

### Step 1: Update Imports
```bash
# Find
from '@/lib/ai/AIService.js'
from '../../../../lib/ai/AIService.js'
import { AIService }

# Replace with
from '@/lib/ai/AIServiceV2.js'
from '../../../../lib/ai/AIServiceV2.js'
import { AIServiceV2 }
```

### Step 2: Update getInstance Calls
```bash
# Find
AIService.getInstance()

# Replace with
AIServiceV2.getInstance()
```

### Step 3: Update Initialization Pattern
```bash
# Find
await aiService.initialize(null, userId);
await aiService.initialize(apiKeys, userId);

# Replace with
const initResult = await aiService.initialize({ userId });
const initResult = await aiService.initialize({ apiKeys, userId });
```

### Step 4: Update Reinitialization
```bash
# Find
await aiService.reinitializeWithUserKeys(apiKeys, userId);

# Replace with
await aiService.reinitialize(apiKeys);
```

## Manual Files (Require Code Changes)

These need manual updates due to complex logic:

1. **`app/api/bmad/agents/chat/stream/route.js`**
   - Currently uses streaming (which is removed in V2)
   - Need to update to use regular call method

2. **`app/api/bmad/agents/chat/handlers/initializationHandler.js`**
   - Complex initialization logic
   - Needs review of error handling

3. **`app/api/user/api-keys/route.js`**
   - Updates user API keys in database
   - Need to verify reinitialize flow

## Testing Checklist

After each update, test:

- [ ] Health check endpoint works
- [ ] Initialization with user ID works
- [ ] Initialization with direct keys works
- [ ] Error handling shows clear error codes
- [ ] Usage tracking still works
- [ ] Circuit breakers still function
- [ ] Retry logic still works

## Rollback Plan

Keep both versions available during migration:

```javascript
// In environment config
const USE_AI_SERVICE_V2 = process.env.USE_AI_SERVICE_V2 === 'true';

// In routes
const AIService = USE_AI_SERVICE_V2
  ? (await import('@/lib/ai/AIServiceV2.js')).AIServiceV2
  : (await import('@/lib/ai/AIService.js')).AIService;
```

## Migration Order

### Week 1: Core Routes
1. Update `ai/health/route.js`
2. Update `ai/reinitialize/route.js`
3. Test thoroughly in development
4. Deploy to staging

### Week 2: Chat Routes
5. Update chat handlers
6. Update stream routes (remove streaming)
7. Update workflow chat
8. Test full chat flows

### Week 3: Repository Routes
9. Update repo chat
10. Update insights
11. Update usage stats
12. Final testing

### Week 4: Production
13. Deploy to production
14. Monitor for 1 week
15. Remove V1 code if stable

## Success Metrics

- [ ] All routes return 200 for valid requests
- [ ] Error responses include error codes
- [ ] Response times same or better
- [ ] No increase in 500 errors
- [ ] Usage tracking accurate
- [ ] Health checks pass

---

**Status:** Ready to begin migration
**Start Date:** 2025-10-21
**Estimated Completion:** 2-3 weeks
