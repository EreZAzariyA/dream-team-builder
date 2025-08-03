/**
 * Chat Messages API - Retrieve saved messages from database
 */

import { NextResponse } from 'next/server';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import AgentMessage from '../../../../lib/database/models/AgentMessage.js';
import { Logger } from '../../../../lib/ai/AIService.js';

export async function GET(request) {
  try {
    await connectMongoose();
    
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');
    const agentId = url.searchParams.get('agentId');
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    
    let query = {};
    
    // Filter by conversation ID if provided
    if (conversationId) {
      query['metadata.conversationId'] = conversationId;
    }
    
    // Filter by agent ID if provided
    if (agentId) {
      query.$or = [
        { fromAgent: agentId },
        { toAgent: agentId }
      ];
    }
    
    const messages = await AgentMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    
    return NextResponse.json({
      success: true,
      count: messages.length,
      messages: messages.reverse() // Reverse to show oldest first
    });
    
  } catch (error) {
    Logger.error('Error retrieving messages:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve messages', details: error.message },
      { status: 500 }
    );
  }
}