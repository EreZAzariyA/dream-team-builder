import { checkDatabaseHealth, getConnectionState } from '../../../lib/database/mongodb.js';
import { 
  withMethods, 
  withErrorHandling,
  compose,
  apiResponse 
} from '../../../lib/api/middleware.js';

const handler = async (req, res) => {
  try {
    // Check database health
    const dbHealth = await checkDatabaseHealth();
    
    // Get connection state
    const connectionState = getConnectionState();
    
    // Overall health status
    const isHealthy = dbHealth.status === 'healthy' && 
                     connectionState.mongoose.readyState === 1;
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        connections: connectionState,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
    };
    
    const statusCode = isHealthy ? 200 : 503;
    
    return res.status(statusCode).json(
      apiResponse.success(healthData, 'Health check completed')
    );
    
  } catch (error) {
    console.error('Health check error:', error);
    
    return res.status(503).json(
      apiResponse.error('Health check failed', error.message)
    );
  }
};

// Apply middleware
export const GET = compose(
  withMethods(['GET']),
  withErrorHandling
)(handler);