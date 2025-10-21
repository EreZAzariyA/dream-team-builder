# Redis Setup Guide (Upstash for Vercel)

This application uses **Upstash Redis** for distributed caching, rate limiting, and request queuing. This is essential for production deployment on Vercel.

## Why Redis?

On Vercel (serverless), in-memory storage doesn't work because:
- ❌ Each request runs in a separate Lambda function
- ❌ Memory is not shared between function invocations
- ❌ Data is lost on cold starts

Redis solves this by providing:
- ✅ Persistent storage across function invocations
- ✅ Distributed state management
- ✅ Atomic operations for rate limiting
- ✅ TTL (Time-To-Live) for automatic cleanup

## What Uses Redis?

1. **Rate Limiting** - Prevents API abuse by tracking requests per IP
2. **API Stats** - Tracks request counts and response times
3. **AI Request Queue** - Manages concurrent AI requests per user
4. **Session Management** - Tracks user sessions (optional)

## Setup Instructions

### 1. Create Upstash Redis Database

1. Go to [Upstash Console](https://console.upstash.com/)
2. Sign up or log in
3. Click **"Create Database"**
4. Choose:
   - **Name**: `dream-team-redis` (or your preferred name)
   - **Region**: Choose closest to your Vercel deployment region
   - **Type**: Select **Global** for multi-region (recommended) or **Regional**
5. Click **"Create"**

### 2. Get Your Redis Credentials

After creating the database:

1. Click on your database name
2. Scroll to **"REST API"** section
3. Copy these values:
   - `UPSTASH_REDIS_REST_URL` - The REST URL (e.g., `https://xxxxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` - The REST token

### 3. Configure Environment Variables

#### For Local Development

Add to your `.env.local` file:

```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

#### For Vercel Production

1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Add both variables:
   - **Key**: `UPSTASH_REDIS_REST_URL`, **Value**: your URL
   - **Key**: `UPSTASH_REDIS_REST_TOKEN`, **Value**: your token
4. Make sure to select **Production**, **Preview**, and **Development** environments
5. Click **Save**

### 4. Verify Setup

After deploying, check your application logs for:

```
✅ Upstash Redis client initialized
```

If Redis is not configured, you'll see:

```
⚠️ Upstash Redis not configured - using fallback in-memory mode
```

## Pricing

**Free Tier** includes:
- ✅ 10,000 commands/day
- ✅ 256 MB storage
- ✅ Perfect for development and small apps

**Paid Plans** start at $0.20 per 100K commands (pay-as-you-go)

## Fallback Behavior

The application includes an **automatic fallback** to in-memory storage if Redis is not configured:

- 🟢 **With Redis**: Full distributed caching, works across multiple servers
- 🟡 **Without Redis**: Local in-memory fallback (development only)

**Note**: In production on Vercel, you MUST configure Redis for proper functionality.

## Monitoring Redis Usage

### Via Upstash Console

1. Go to [Upstash Console](https://console.upstash.com/)
2. Click on your database
3. View metrics:
   - Commands per day
   - Storage usage
   - Database size

### Via Application API

Check API stats endpoint:

```bash
GET /api/monitoring/stats
```

This shows:
- Total requests
- Rate limit status
- Queue lengths

## Troubleshooting

### "Redis not configured" Warning

**Problem**: Application can't connect to Redis

**Solutions**:
1. Verify environment variables are set correctly
2. Check for typos in the URL and token
3. Ensure variables are added to Vercel environment settings
4. Redeploy after adding environment variables

### Rate Limiting Not Working

**Problem**: Users can exceed rate limits

**Solutions**:
1. Check that Redis is properly configured
2. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
3. Check application logs for Redis connection errors

### High Redis Command Count

**Problem**: Approaching the free tier limit

**Solutions**:
1. Review your rate limit configurations in `lib/api/middleware.js`
2. Increase TTL values to reduce key updates
3. Consider upgrading to a paid plan
4. Optimize high-frequency endpoints

## Redis Key Structure

The application uses these key patterns:

```
ratelimit:{type}:{ip}           # Rate limit counters
ai-slowdown:{ip}                # AI request slowdown tracking
ai:queue:{userId}               # AI request queues
ai:queue:{userId}:lock          # Distributed locks
ai:queue:{userId}:lastProcessed # Last request timestamp
api:stats:*                     # API statistics
api:endpoint:{path}:*           # Per-endpoint stats
```

## Advanced Configuration

### Adjust Rate Limits

Edit `lib/api/middleware.js`:

```javascript
const rateLimitConfigs = {
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max requests per window
  },
  ai: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Max AI requests per minute
  }
};
```

### Custom TTL Values

Modify TTL in Redis service calls:

```javascript
await redisService.set(key, value, 3600); // 1 hour TTL
```

## Support

For issues with:
- **Upstash Redis**: [Upstash Support](https://upstash.com/docs)
- **Application Redis Integration**: Check [lib/utils/redis.js](lib/utils/redis.js)

## Next Steps

- [ ] Create Upstash Redis database
- [ ] Add environment variables to Vercel
- [ ] Deploy and verify Redis connection
- [ ] Monitor usage in Upstash Console
