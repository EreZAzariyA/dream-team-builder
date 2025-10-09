/**
 * API Monitoring Middleware
 * Tracks API response times, error rates, and performance metrics
 */

import { healthMonitor } from './health-monitor.js';

/**
 * Create monitoring middleware for API routes
 */
export function createMonitoringMiddleware() {
  return async (request, response, next) => {
    const startTime = Date.now();
    const method = request.method;
    const url = new URL(request.url, `http://${request.headers.host}`);
    const endpoint = url.pathname;
    
    // Override response methods to capture metrics
    const originalSend = response.send;
    const originalJson = response.json;
    const originalEnd = response.end;
    
    let responseCapured = false;
    
    const captureResponse = async (statusCode) => {
      if (responseCapured) return;
      responseCapured = true;

      const responseTime = Date.now() - startTime;
      await healthMonitor.recordApiResponseTime(endpoint, method, responseTime, statusCode);

      // Record error if status code indicates an error
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
        await healthMonitor.recordError(endpoint, method, errorType, `HTTP ${statusCode}`);
      }
    };
    
    // Override response.send
    response.send = function(body) {
      captureResponse(this.statusCode);
      return originalSend.call(this, body);
    };
    
    // Override response.json
    response.json = function(obj) {
      captureResponse(this.statusCode);
      return originalJson.call(this, obj);
    };
    
    // Override response.end
    response.end = function(chunk, encoding) {
      captureResponse(this.statusCode);
      return originalEnd.call(this, chunk, encoding);
    };
    
    // Handle errors
    try {
      if (next) {
        next();
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await healthMonitor.recordApiResponseTime(endpoint, method, responseTime, 500);
      await healthMonitor.recordError(endpoint, method, 'exception', error.message);
      throw error;
    }
  };
}

/**
 * Next.js middleware wrapper for monitoring
 */
export function withMonitoring(handler) {
  return async (request, ...args) => {
    const startTime = Date.now();
    const method = request.method;
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const endpoint = url.pathname;
    
    try {
      const response = await handler(request, ...args);

      // Extract status code from response
      let statusCode = 200;
      if (response && response.status) {
        statusCode = response.status;
      } else if (response && response.statusCode) {
        statusCode = response.statusCode;
      }

      const responseTime = Date.now() - startTime;
      await healthMonitor.recordApiResponseTime(endpoint, method, responseTime, statusCode);

      // Record error if status code indicates an error
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
        await healthMonitor.recordError(endpoint, method, errorType, `HTTP ${statusCode}`);
      }

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await healthMonitor.recordApiResponseTime(endpoint, method, responseTime, 500);
      await healthMonitor.recordError(endpoint, method, 'exception', error.message);
      throw error;
    }
  };
}

/**
 * Simple monitoring wrapper for async functions
 */
export function monitorAsync(name, fn) {
  return async (...args) => {
    const startTime = Date.now();

    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      await healthMonitor.recordApiResponseTime(`internal/${name}`, 'INTERNAL', duration, 200);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await healthMonitor.recordApiResponseTime(`internal/${name}`, 'INTERNAL', duration, 500);
      await healthMonitor.recordError(`internal/${name}`, 'INTERNAL', 'exception', error.message);
      throw error;
    }
  };
}

export default { createMonitoringMiddleware, withMonitoring, monitorAsync };