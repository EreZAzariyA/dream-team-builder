# Live Workflow Communication Fixes

## Issues Identified

After analyzing your workflows/live page, I've identified several critical issues preventing live communication:

### 1. **Missing Environment Variables**
- No `.env` file with Pusher credentials
- Pusher server initialization failing
- Real-time events not being broadcast

### 2. **Event Broadcasting Issues**
- BMAD orchestrator not properly triggering Pusher events
- Agent activation/completion events not reaching clients
- Message flow broken between backend and frontend

### 3. **Channel Synchronization Problems**
- Inconsistent channel naming patterns
- Client subscribing to wrong channels
- Events being sent but not received

## Applied Fixes

### 1. **Enhanced Pusher Service** ✅
- Added comprehensive event methods
- Improved error handling and logging
- Connection status monitoring
- Specific methods for workflow events

### 2. **Event Handler Integration** ✅
- Proper integration between AgentCommunicator and PusherService
- Real-time elicitation request handling
- Message truncation for large payloads

## Required Setup Steps

### 1. Create Environment File

Create `.env.local` file in your project root:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-change-in-production

# Database
MONGODB_URI=mongodb://localhost:27017/dream-team

# Pusher Configuration (CRITICAL FOR LIVE COMMUNICATION)
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=us2

# Public Pusher Variables (for client-side)
NEXT_PUBLIC_PUSHER_KEY=your-pusher-key
NEXT_PUBLIC_PUSHER_CLUSTER=us2

# AI Service Providers
GEMINI_API_KEY=your-google-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# Enable/disable mock mode
BMAD_MOCK_MODE=false
```

### 2. Get Pusher Credentials

1. Go to [pusher.com](https://pusher.com)
2. Create a free account
3. Create a new app
4. Copy the App ID, Key, Secret, and Cluster
5. Replace the placeholder values in your `.env.local` file

### 3. Test Real-time Communication

Once environment is set up:

1. Start your development server: `npm run dev`
2. Navigate to a workflow live page: `/workflows/live/[workflowInstanceId]`
3. Click "Test Real-time" button - you should see events in the chat
4. Check browser console for Pusher connection status

## Additional Fixes Applied

### 1. **PusherService Enhancements** (lib/bmad/orchestration/PusherService.js)
- Added specialized event methods
- Better error handling
- Connection status monitoring
- Detailed logging for debugging

### 2. **Event Handler Integration** (lib/bmad/orchestration/EventHandler.js)
- Proper real-time event broadcasting
- Elicitation request handling
- Message content optimization for WebSocket transmission

## Debugging Live Communication

### Check Pusher Connection Status

Add this to your browser console on the live workflow page:

```javascript
// Check if Pusher is connected
console.log('Pusher connected:', window.pusherConnected);

// Check environment variables
console.log('Pusher key:', process.env.NEXT_PUBLIC_PUSHER_KEY);
```

### Server-Side Debugging

Monitor server logs for these messages:
- `📡 [Pusher] Triggering [event] on [channel]` - Events being sent
- `✅ [Pusher] Event sent successfully` - Successful broadcasts
- `❌ [Pusher] Failed to send [event]` - Transmission failures
- `🚫 Pusher trigger skipped` - Configuration issues

## Common Issues & Solutions

### Issue: "Connection Lost" in UI
**Solution**: Check Pusher credentials in `.env.local`

### Issue: Events not appearing in chat
**Solution**: Verify channel names match between client and server

### Issue: "Test Real-time" button doesn't work
**Solution**: Check server logs for Pusher initialization errors

### Issue: Elicitation responses not working
**Solution**: Ensure workflow is in correct state and agent is active

## Testing Workflow

1. **Start workflow** from dashboard
2. **Navigate to live page** using workflow ID
3. **Check connection status** - should show "Live Updates Active"
4. **Click "Test Real-time"** - should see test events in chat
5. **Send messages** - should see real-time responses
6. **Test elicitation** - when prompted, responses should work

## Next Steps

After setting up environment variables:

1. Restart your development server
2. Test the live workflow page
3. Monitor console/server logs for any remaining issues
4. Use the test endpoints to verify Pusher functionality

The system should now properly broadcast real-time events and maintain live communication between agents and users.