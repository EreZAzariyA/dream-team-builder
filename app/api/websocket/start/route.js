/**
 * WebSocket Server Start API
 * Starts the BMAD WebSocket server for real-time communication
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import { initializeWebSocketServer, getWebSocketServer } from '../../../../lib/websocket/server.js';

/**
 * POST /api/websocket/start - Start WebSocket server
 */
export async function POST() {
  try {
    // Check authentication (optional - you might want to allow this for development)
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if server is already running
    const existingServer = getWebSocketServer();
    if (existingServer) {
      return NextResponse.json({
        success: true,
        message: 'WebSocket server already running',
        status: 'running',
        port: 8080,
        statistics: existingServer.getStatistics()
      });
    }

    // Initialize WebSocket server
    const webSocketServer = await initializeWebSocketServer({
      port: 8080
    });

    return NextResponse.json({
      success: true,
      message: 'WebSocket server started successfully',
      status: 'started',
      port: 8080,
      statistics: webSocketServer.getStatistics()
    });

  } catch (error) {
    console.error('Error starting WebSocket server:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to start WebSocket server',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/websocket/start - Get WebSocket server status
 */
export async function GET() {
  try {
    const webSocketServer = getWebSocketServer();
    
    if (!webSocketServer) {
      return NextResponse.json({
        success: true,
        status: 'stopped',
        message: 'WebSocket server is not running'
      });
    }

    return NextResponse.json({
      success: true,
      status: 'running',
      port: 8080,
      activeClients: webSocketServer.getActiveClients(),
      statistics: webSocketServer.getStatistics()
    });

  } catch (error) {
    console.error('Error getting WebSocket server status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get WebSocket server status',
        details: error.message 
      },
      { status: 500 }
    );
  }
}