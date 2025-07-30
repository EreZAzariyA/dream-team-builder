/**
 * WebSocket Server Initialization for BMAD
 * Integrates WebSocket server with Next.js application
 */

import { BmadWebSocketServer } from './WebSocketServer.js';
import BmadOrchestrator from '../bmad/BmadOrchestrator.js';

let webSocketServer = null;
let bmadOrchestrator = null;

/**
 * Initialize WebSocket server for BMAD real-time communication
 */
export async function initializeWebSocketServer(options = {}) {
  if (webSocketServer) {
    console.log('WebSocket server already initialized');
    return webSocketServer;
  }

  try {
    // Create WebSocket server
    webSocketServer = new BmadWebSocketServer({
      port: options.port || 8080,
      ...options
    });

    // Initialize BMAD orchestrator if not provided
    if (!bmadOrchestrator) {
      bmadOrchestrator = new BmadOrchestrator();
      await bmadOrchestrator.initialize();
    }

    // Connect WebSocket server to BMAD communicator
    bmadOrchestrator.communicator.setWebSocketServer(webSocketServer);

    // Setup BMAD event forwarding to WebSocket clients
    setupBmadEventForwarding();

    // Start WebSocket server
    await webSocketServer.start();

    console.log('🚀 BMAD WebSocket Server initialized and connected to orchestrator');
    return webSocketServer;

  } catch (error) {
    console.error('Failed to initialize WebSocket server:', error);
    throw error;
  }
}

/**
 * Setup event forwarding from BMAD to WebSocket clients
 */
function setupBmadEventForwarding() {
  if (!bmadOrchestrator || !webSocketServer) return;

  // Forward workflow events
  bmadOrchestrator.workflowEngine.communicator.on('workflow:complete', (data) => {
    webSocketServer.broadcastToWorkflow(data.workflowId, {
      type: 'workflow_complete',
      ...data
    });
  });

  // Forward agent activation events
  bmadOrchestrator.workflowEngine.communicator.on('agent:activated', (data) => {
    webSocketServer.broadcastToWorkflow(data.workflowId, {
      type: 'agent_activated',
      ...data
    });

    webSocketServer.broadcastToAgent(data.agentId, {
      type: 'agent_activated',
      ...data
    });
  });

  // Forward agent completion events
  bmadOrchestrator.workflowEngine.communicator.on('agent:completed', (data) => {
    webSocketServer.broadcastToWorkflow(data.workflowId, {
      type: 'agent_completed',
      ...data
    });

    webSocketServer.broadcastToAgent(data.agentId, {
      type: 'agent_completed',
      ...data
    });
  });

  // Forward agent communication events
  bmadOrchestrator.workflowEngine.communicator.on('agent:communication', (data) => {
    webSocketServer.broadcastToWorkflow(data.workflowId, {
      type: 'agent_communication',
      ...data
    });
  });

  // Forward workflow errors
  bmadOrchestrator.workflowEngine.communicator.on('workflow:error', (data) => {
    webSocketServer.broadcastToWorkflow(data.workflowId, {
      type: 'workflow_error',
      ...data
    });
  });

  console.log('📡 BMAD event forwarding to WebSocket clients configured');
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer() {
  return webSocketServer;
}

/**
 * Get BMAD orchestrator instance
 */
export function getBmadOrchestrator() {
  return bmadOrchestrator;
}

/**
 * Stop WebSocket server
 */
export async function stopWebSocketServer() {
  if (webSocketServer) {
    await webSocketServer.stop();
    webSocketServer = null;
    console.log('WebSocket server stopped');
  }
}

/**
 * Handle server process events
 */
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, stopping WebSocket server...');
    await stopWebSocketServer();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, stopping WebSocket server...');
    await stopWebSocketServer();  
    process.exit(0);
  });
}

export default {
  initializeWebSocketServer,
  getWebSocketServer,
  getBmadOrchestrator,
  stopWebSocketServer
};