
const UserActivity = require('../database/models/UserActivity.js');
const { connectMongoose } = require('../database/mongodb.js');

async function logUserActivity(userId, eventType, details = {}, req = null) {
  try {
    await connectMongoose();

    const activityData = {
      userId,
      eventType,
      details,
    };

    if (req) {
      // Handle Next.js request object structure
      const forwardedFor = req.headers?.get?.('x-forwarded-for') || req.headers?.['x-forwarded-for'];
      const realIp = req.headers?.get?.('x-real-ip') || req.headers?.['x-real-ip'];
      const cfConnectingIp = req.headers?.get?.('cf-connecting-ip') || req.headers?.['cf-connecting-ip'];
      
      activityData.ipAddress = forwardedFor || realIp || cfConnectingIp || req.socket?.remoteAddress || 'unknown';
      activityData.userAgent = req.headers?.get?.('user-agent') || req.headers?.['user-agent'] || 'unknown';
    }

    const userActivity = new UserActivity(activityData);
    await userActivity.save();
  } catch (error) {
    console.error('Error logging user activity:', error);
  }
}

module.exports = { logUserActivity };
