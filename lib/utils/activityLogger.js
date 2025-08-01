
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
      activityData.ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      activityData.userAgent = req.headers['user-agent'];
    }

    const userActivity = new UserActivity(activityData);
    await userActivity.save();
  } catch (error) {
    console.error('Error logging user activity:', error);
  }
}

module.exports = { logUserActivity };
