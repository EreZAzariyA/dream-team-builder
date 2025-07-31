# Pusher Setup Guide

## 🚀 Quick Setup Steps

### 1. Create Pusher Account
1. Go to [pusher.com](https://pusher.com) and sign up
2. Create a new app (choose "Channels" product)
3. Select your region (e.g., "us-east-1" or "eu-west-1")

### 2. Get Your Credentials
From your Pusher dashboard, copy these values:
- **App ID**: `123456`
- **Key**: `abcdef123456789`
- **Secret**: `xyz789secret123`
- **Cluster**: `us2` (or your selected region)

### 3. Add to Environment Variables
Create `.env.local` file with:
```bash
# Pusher Configuration
PUSHER_APP_ID=123456
PUSHER_KEY=abcdef123456789
PUSHER_SECRET=xyz789secret123
PUSHER_CLUSTER=us2

# Public variables (for client-side)
NEXT_PUBLIC_PUSHER_KEY=abcdef123456789
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

### 4. Test the Integration
1. Start your server: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Navigate to a page with chat
4. Send a message - you should see agent responses!

### 5. Deploy to Vercel
1. Push code to GitHub
2. Import to Vercel
3. Add the same environment variables in Vercel dashboard
4. Deploy! 🎉

## 📊 Pusher Free Plan Limits
- ✅ 200k messages/day
- ✅ 100 concurrent connections
- ✅ Unlimited channels
- ✅ SSL encryption

## 🧪 Testing Commands
```bash
# Test workflow updates
curl -X GET "http://localhost:3000/api/pusher/workflow-update?workflowId=test-123"

# Test direct message
curl -X POST "http://localhost:3000/api/pusher/send-message" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello from API","target":{"type":"workflow","id":"test-123"}}'
```

## 🔧 Troubleshooting

**Connection Issues:**
- Check environment variables are set correctly
- Verify Pusher cluster matches your account region
- Check browser console for errors

**Messages Not Sending:**
- Verify API routes are working: `/api/pusher/send-message`
- Check Pusher dashboard for connection status
- Ensure CORS settings are correct

**Production Deployment:**
- Add all environment variables to Vercel
- Use `NEXT_PUBLIC_` prefix for client-side variables
- Check Vercel logs for any errors

## 🎯 What's Working Now
✅ Real-time chat messaging  
✅ Agent responses (simulated)  
✅ Workflow subscriptions  
✅ Typing indicators  
✅ Connection status  
✅ Works on Vercel!  

The WebSocket functionality has been completely replaced with Pusher - no more deployment issues! 🎉