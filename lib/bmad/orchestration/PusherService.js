import logger from '@/lib/utils/logger.js';


let pusherServer = null;
try {
  if (typeof window === 'undefined') {
    const { pusherServer: pusher } = require('../../pusher/config.js');
    pusherServer = pusher;
  }
} catch (error) {
  logger.warn('Pusher server not available:', error.message);
}

class PusherService {
  constructor() {
    this.pusher = pusherServer;
  }

  async trigger(workflowId, eventType, data) {
    if (!this.pusher || !workflowId) return;

    try {
      const channelName = `workflow-${workflowId}`;
      const eventData = {
        workflowId,
        timestamp: new Date().toISOString(),
        ...data
      };

      logger.info(`[Pusher Service] Triggering event on channel: ${channelName}, event: ${eventType}`);
      await this.pusher.trigger(channelName, eventType, eventData);
      logger.info(`🔔 Pusher event sent: ${channelName} -> ${eventType}`);
    } catch (error) {
      logger.error('Failed to trigger Pusher event:', error);
    }
  }
}

module.exports = { PusherService };
