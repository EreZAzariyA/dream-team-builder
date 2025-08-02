# Comprehensive Testing Guide

This document provides step-by-step tests to verify all implemented features work correctly.

## 🔐 Security Hardening Tests

### JWT Token Expiry Tests

#### Test 1: JWT Production Expiry (30 minutes)
```bash
# Set production environment
export NODE_ENV=production

# Start the server
npm run dev

# Login and check token expiry
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'

# Extract the token and decode it to verify expiry is 30 minutes (1800 seconds)
# The response should show exp field = iat + 1800
```

#### Test 2: JWT Development Expiry (3 hours)
```bash
# Set development environment
export NODE_ENV=development

# Restart server and login
# Token expiry should be iat + 10800 (3 hours)
```

#### Test 3: Token Refresh/Sliding Expiration
```bash
# Make authenticated requests and verify token gets refreshed
# when 50% of lifetime remains
```

### Rate Limiting Tests

#### Test 4: General API Rate Limiting
```bash
# Test general endpoints (100 requests/15min in production, 1000 in dev)
for i in {1..5}; do
  curl -X GET http://localhost:3000/api/health \
    -H "Authorization: Bearer YOUR_TOKEN"
  echo "Request $i"
done

# After exceeding limit, should get 429 status
curl -X GET http://localhost:3000/api/health \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -w "\nStatus: %{http_code}\n"
```

#### Test 5: Authentication Rate Limiting
```bash
# Test auth endpoints (5 attempts/15min in production, 50 in dev)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "wrong@email.com", "password": "wrong"}' \
    -w "\nStatus: %{http_code}\n"
done

# Should get rate limited after 5 attempts in production
```

#### Test 6: AI Operations Rate Limiting
```bash
# Test AI endpoints (10 requests/minute in production, 100 in dev)
for i in {1..12}; do
  curl -X POST http://localhost:3000/api/pusher/send-message \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"content": "test", "target": {"type": "workflow", "id": "test"}}' \
    -w "\nStatus: %{http_code}\n"
done

# Should get rate limited after 10 requests in production
```

#### Test 7: Expensive Operations Rate Limiting
```bash
# Test expensive endpoints (3 requests/minute in production, 30 in dev)
for i in {1..4}; do
  curl -X PATCH http://localhost:3000/api/ai/health \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"action": "reset-circuit-breakers"}' \
    -w "\nStatus: %{http_code}\n"
done

# Should get rate limited after 3 requests in production
```

#### Test 8: AI Progressive Slowdown
```bash
# Test AI slowdown (delay increases after 5 requests/minute in production)
time curl -X POST http://localhost:3000/api/pusher/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"content": "test", "target": {"type": "workflow", "id": "test"}}'

# After 5 requests, response time should increase by 500ms per request
```

### Security Headers Tests

#### Test 9: Security Headers Verification
```bash
# Check security headers are present
curl -I http://localhost:3000/api/health \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should include:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
# Content-Security-Policy: default-src 'self'; script-src 'none'; object-src 'none';
```

#### Test 10: CORS Headers
```bash
# Test CORS preflight
curl -X OPTIONS http://localhost:3000/api/health \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: GET" \
  -I

# Should include CORS headers
```

### Input Validation Tests

#### Test 11: Request Validation
```bash
# Test missing required fields
curl -X POST http://localhost:3000/api/pusher/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"target": {"type": "workflow", "id": "test"}}' \
  -w "\nStatus: %{http_code}\n"

# Should return 400 with validation error
```

#### Test 12: Invalid Data Types
```bash
# Test invalid email format in auth
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email", "password": "password"}' \
  -w "\nStatus: %{http_code}\n"

# Should return 400 with email validation error
```

## 🤖 AI Provider Resilience Tests

### Circuit Breaker Tests

#### Test 13: AI Service Health Check
```bash
# Check AI service health
curl -X GET http://localhost:3000/api/ai/health \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return provider status and circuit breaker states
```

#### Test 14: Provider Failover
```bash
# Test provider switching when one fails
curl -X POST http://localhost:3000/api/test-ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"prompt": "Hello, test the AI service"}'

# Check which provider responded in the response
```

#### Test 15: Circuit Breaker Reset
```bash
# Reset circuit breakers (admin only)
curl -X PATCH http://localhost:3000/api/ai/health \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"action": "reset-circuit-breakers"}'

# Should confirm circuit breakers were reset
```

### Usage Tracking Tests

#### Test 16: AI Usage Statistics
```bash
# Check usage statistics
curl -X GET http://localhost:3000/api/ai/usage \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return usage metrics, costs, and limits
```

#### Test 17: Cost Monitoring
```bash
# Make several AI requests and check cost accumulation
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/test-ai \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"prompt": "Test request #'$i'"}'
done

# Check updated usage
curl -X GET http://localhost:3000/api/ai/usage \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎯 AI Provider Status Indicator Tests

### UI Component Tests

#### Test 18: Provider Status Display
1. **Open Dashboard**: Navigate to http://localhost:3000/dashboard
2. **Check Header**: Verify AI provider status indicator is visible in the system header
3. **Provider Badge**: Should show current provider (Gemini, OpenAI, etc.) with appropriate styling
4. **Status Colors**: 
   - Green: Healthy provider
   - Yellow: Degraded performance
   - Red: Provider failure

#### Test 19: Real-time Status Updates
1. **Monitor Status**: Watch the provider indicator
2. **Trigger Failure**: Make invalid AI requests to trigger circuit breaker
3. **Verify Update**: Status should change to show failover to backup provider
4. **Reset Test**: Reset circuit breakers and verify status returns to normal

## 🔄 BMAD Workflow Tests

### Agent Communication Tests

#### Test 20: Workflow Creation
```bash
# Create a new workflow
curl -X POST http://localhost:3000/api/bmad/workflow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"prompt": "Create a simple web application", "workflowType": "development"}'

# Should return workflow ID and start agent coordination
```

#### Test 21: Agent Message Processing
```bash
# Send message to workflow
curl -X POST http://localhost:3000/api/pusher/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "content": "Add a login page to the application",
    "target": {"type": "workflow", "id": "WORKFLOW_ID"},
    "userId": "USER_ID"
  }'

# Should route to appropriate agent and generate response
```

#### Test 22: Real-time Updates
1. **Open Chat Interface**: Navigate to http://localhost:3000/chat
2. **Connect to Workflow**: Select or create a workflow
3. **Send Messages**: Type messages and verify real-time responses
4. **Agent Routing**: Verify messages are routed to correct agents

## 🔒 Authentication & Authorization Tests

### NextAuth Integration Tests

#### Test 23: Email/Password Authentication
```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'

# Login with credentials
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "password": "SecurePass123!"}'
```

#### Test 24: OAuth Integration
1. **Google OAuth**: Navigate to http://localhost:3000/auth/signin
2. **Click Google**: Verify OAuth flow works
3. **GitHub OAuth**: Test GitHub authentication
4. **Account Linking**: Link multiple providers to same account

#### Test 25: Session Management
```bash
# Get current session
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Refresh session
curl -X POST http://localhost:3000/api/auth/refresh-session \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Monitoring & Analytics Tests

### Database Persistence Tests

#### Test 26: Workflow Checkpoints
```bash
# Test checkpoint monitoring
curl -X GET http://localhost:3000/api/monitoring/checkpoints \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return workflow checkpoints and database status
```

#### Test 27: API Statistics
```bash
# Check API statistics
curl -X GET http://localhost:3000/api/monitoring/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return request counts, response times, and error rates
```

#### Test 28: System Alerts
```bash
# Check system alerts
curl -X GET http://localhost:3000/api/monitoring/alerts \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return any active alerts or warnings
```

## 🔧 Integration Tests

### Real-time Communication Tests

#### Test 29: WebSocket Connections
1. **Open Multiple Tabs**: Navigate to workflow pages in different tabs
2. **Send Messages**: Send messages from one tab
3. **Verify Sync**: Check other tabs receive updates in real-time
4. **Connection Recovery**: Disconnect/reconnect network and verify recovery

#### Test 30: Pusher Integration
```bash
# Test Pusher message broadcasting
curl -X POST http://localhost:3000/api/pusher/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "content": "Test broadcast message",
    "target": {"type": "channel", "id": "test-channel"},
    "userId": "test-user"
  }'

# Should broadcast to all connected clients
```

### Database Integration Tests

#### Test 31: MongoDB Connection
```bash
# Test database health
curl -X GET http://localhost:3000/api/health \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should confirm MongoDB connection status
```

#### Test 32: Data Persistence
1. **Create Workflow**: Create a new workflow through UI
2. **Refresh Page**: Reload the page
3. **Verify Persistence**: Workflow should still be visible
4. **Check Database**: Verify data is stored in MongoDB

## 🎨 UI/UX Tests

### Component Integration Tests

#### Test 33: Dashboard Functionality
1. **Navigate to Dashboard**: http://localhost:3000/dashboard
2. **Check Components**: Verify all dashboard components load
3. **AI Status Indicator**: Check provider status is visible
4. **Workflow Cards**: Verify workflow cards display correctly
5. **Real-time Updates**: Check live data updates

#### Test 34: Responsive Design
1. **Desktop View**: Test on desktop browser
2. **Mobile View**: Test on mobile device or emulator
3. **Tablet View**: Test on tablet-sized screen
4. **Component Adaptation**: Verify components adapt to screen size

#### Test 35: Dark Mode Support
1. **Toggle Theme**: Use system theme toggle or preferences
2. **Component Styling**: Verify all components support dark mode
3. **Color Consistency**: Check design system colors are applied correctly

## 🚀 Performance Tests

### Load Testing

#### Test 36: Concurrent Users
```bash
# Install artillery for load testing
npm install -g artillery

# Create artillery config and run load test
artillery quick --count 10 --num 5 http://localhost:3000/api/health
```

#### Test 37: Rate Limit Performance
```bash
# Test rate limiting under load
for i in {1..100}; do
  curl -X GET http://localhost:3000/api/health \
    -H "Authorization: Bearer YOUR_TOKEN" &
done
wait

# Monitor server performance and rate limit effectiveness
```

## ✅ Success Criteria

Each test should pass with the following criteria:

### Security Tests (Tests 1-12)
- ✅ JWT tokens expire correctly (30min prod, 3hrs dev)
- ✅ Rate limiting enforces limits and returns 429 status
- ✅ Security headers are present in all responses
- ✅ Input validation rejects invalid data with 400 status

### AI Provider Tests (Tests 13-17)
- ✅ Health checks return provider status
- ✅ Failover works when providers are unavailable
- ✅ Usage tracking accumulates correctly
- ✅ Circuit breakers protect against failures

### UI Tests (Tests 18-19)
- ✅ Provider status indicator is visible and accurate
- ✅ Status updates in real-time during failures/recovery

### Workflow Tests (Tests 20-22)
- ✅ Workflows create successfully
- ✅ Messages route to correct agents
- ✅ Real-time updates work in chat interface

### Auth Tests (Tests 23-25)
- ✅ Registration and login work correctly
- ✅ OAuth providers integrate properly
- ✅ Sessions persist and refresh correctly

### Monitoring Tests (Tests 26-28)
- ✅ Database persistence works
- ✅ API statistics track correctly
- ✅ System alerts function properly

### Integration Tests (Tests 29-32)
- ✅ Real-time communication works
- ✅ Database connections are stable
- ✅ Data persists across sessions

### UI/UX Tests (Tests 33-35)
- ✅ Dashboard loads and functions correctly
- ✅ Responsive design works on all devices
- ✅ Dark mode support is complete

### Performance Tests (Tests 36-37)
- ✅ System handles concurrent users
- ✅ Rate limiting performs under load

## 🔧 Troubleshooting

### Common Issues

1. **Rate Limiting Too Strict**: Adjust limits in `lib/api/middleware.js`
2. **JWT Token Issues**: Check `NEXTAUTH_SECRET` environment variable
3. **AI Provider Errors**: Verify API keys in environment variables
4. **Database Connection**: Ensure `MONGODB_URI` is correct
5. **Pusher Issues**: Check Pusher credentials and configuration

### Debug Commands

```bash
# Check environment variables
echo $NODE_ENV
echo $NEXTAUTH_SECRET

# View server logs
npm run dev

# Check database connection
node -e "require('./lib/database/mongodb.js').connectMongoose().then(() => console.log('DB OK'))"

# Test AI service directly
node -e "require('./lib/ai/AIService.js').aiService.healthCheck().then(console.log)"
```

## 📝 Test Results Template

```markdown
## Test Results - [Date]

### Security Tests
- [ ] JWT Expiry (Production): ✅/❌
- [ ] JWT Expiry (Development): ✅/❌
- [ ] Rate Limiting (General): ✅/❌
- [ ] Rate Limiting (Auth): ✅/❌
- [ ] Rate Limiting (AI): ✅/❌
- [ ] Security Headers: ✅/❌
- [ ] Input Validation: ✅/❌

### AI Provider Tests
- [ ] Health Check: ✅/❌
- [ ] Provider Failover: ✅/❌
- [ ] Usage Tracking: ✅/❌
- [ ] Circuit Breakers: ✅/❌

### UI Tests
- [ ] Status Indicator: ✅/❌
- [ ] Real-time Updates: ✅/❌

### Integration Tests
- [ ] BMAD Workflows: ✅/❌
- [ ] Authentication: ✅/❌
- [ ] Real-time Chat: ✅/❌
- [ ] Database Persistence: ✅/❌

### Performance Tests
- [ ] Load Testing: ✅/❌
- [ ] Rate Limit Performance: ✅/❌

### Notes
[Add any issues found or additional observations]
```

---

**Total Tests**: 37 comprehensive tests covering all implemented features
**Estimated Time**: 2-3 hours for complete testing
**Prerequisites**: Running server, valid test credentials, MongoDB connection