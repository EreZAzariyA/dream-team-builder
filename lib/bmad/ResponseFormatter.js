/**
 * Unified Response Formatter for BMAD Agents
 * Ensures all agent responses follow a consistent structure for elegant UI presentation
 */

export class ResponseFormatter {
  /**
   * Format agent response into unified structure
   */
  static formatAgentResponse(agentDefinition, rawContent, metadata = {}) {
    const agent = agentDefinition?.agent || {};
    
    // Parse if the agent tried to respond in structured format already
    let parsedContent = null;
    try {
      // Check if response starts with structured markers
      if (rawContent.includes('===') || rawContent.includes('##') || rawContent.includes('**')) {
        parsedContent = this.parseStructuredContent(rawContent);
      }
    } catch (e) {
      // Fall back to simple formatting
    }

    return {
      // Agent identity
      agentId: agent.id || 'unknown',
      agentName: agent.name || 'Agent',
      agentTitle: agent.title || 'Assistant',
      agentIcon: agent.icon || '🤖',
      
      // Response structure
      response: {
        type: parsedContent ? 'structured' : 'simple',
        summary: this.extractSummary(rawContent),
        content: parsedContent || {
          main: rawContent,
          sections: this.autoGenerateSections(rawContent)
        }
      },
      
      // Metadata
      metadata: {
        confidence: metadata.confidence || 0.8,
        context: this.inferContext(rawContent, agent),
        suggestedFollowups: this.generateFollowups(agent, rawContent),
        timestamp: new Date().toISOString(),
        provider: metadata.provider || 'unknown',
        usage: metadata.usage || null
      }
    };
  }

  /**
   * Parse already-structured content from agent responses
   */
  static parseStructuredContent(content) {
    const sections = [];
    let main = '';
    
    // Split by common section markers
    const lines = content.split('\n');
    let currentSection = null;
    let currentContent = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detect section headers
      if (trimmed.startsWith('##') || trimmed.startsWith('===') || 
          (trimmed.startsWith('**') && trimmed.endsWith('**'))) {
        
        // Save previous section
        if (currentSection) {
          sections.push({
            title: currentSection,
            type: this.inferSectionType(currentContent),
            content: this.processSectionContent(currentContent)
          });
        }
        
        // Start new section
        currentSection = trimmed.replace(/[#=*]/g, '').trim();
        currentContent = [];
      } else if (currentSection) {
        if (trimmed) currentContent.push(trimmed);
      } else {
        if (trimmed) main += trimmed + '\n';
      }
    }
    
    // Add final section
    if (currentSection && currentContent.length > 0) {
      sections.push({
        title: currentSection,
        type: this.inferSectionType(currentContent),
        content: this.processSectionContent(currentContent)
      });
    }
    
    return { main: main.trim(), sections };
  }

  /**
   * Auto-generate sections from unstructured content
   */
  static autoGenerateSections(content) {
    const sections = [];
    
    // Look for action items
    const actionItems = this.extractActionItems(content);
    if (actionItems.length > 0) {
      sections.push({
        title: 'Action Items',
        type: 'action_items',
        content: actionItems
      });
    }
    
    // Look for key points (numbered or bulleted lists)
    const keyPoints = this.extractKeyPoints(content);
    if (keyPoints.length > 0) {
      sections.push({
        title: 'Key Points',
        type: 'list',
        content: keyPoints
      });
    }
    
    return sections;
  }

  /**
   * Extract summary from content (first sentence or explicit summary)
   */
  static extractSummary(content) {
    // Look for explicit summary
    const summaryMatch = content.match(/(?:summary|tldr|in short)[:\-]\s*(.+?)(?:\n|$)/i);
    if (summaryMatch) {
      return summaryMatch[1].trim();
    }
    
    // Use first sentence, up to 100 chars
    const firstSentence = content.split(/[.!?]/)[0];
    return firstSentence.length > 100 
      ? firstSentence.substring(0, 97) + '...'
      : firstSentence;
  }

  /**
   * Infer context from content and agent type
   */
  static inferContext(content, agent) {
    const contexts = {
      'pm': 'product_planning',
      'architect': 'system_design',
      'dev': 'development',
      'qa': 'testing',
      'ux-expert': 'user_experience',
      'analyst': 'analysis'
    };
    
    return contexts[agent.id] || 'general';
  }

  /**
   * Generate suggested followup commands based on agent and content
   */
  static generateFollowups(agent, content) {
    const followups = [];
    
    // Agent-specific followups
    const agentFollowups = {
      'pm': ['*create prd', '*task roadmap', '*analyze market'],
      'architect': ['*design system', '*create architecture', '*task tech-spec'],
      'dev': ['*create code', '*task implement', '*review architecture'],
      'qa': ['*create tests', '*task test-plan', '*review requirements'],
      'ux-expert': ['*create wireframes', '*task user-research', '*design prototype']
    };
    
    if (agentFollowups[agent.id]) {
      followups.push(...agentFollowups[agent.id].slice(0, 2));
    }
    
    // Content-based followups
    if (content.toLowerCase().includes('next step')) {
      followups.push('*plan');
    }
    if (content.toLowerCase().includes('workflow')) {
      followups.push('*workflow');
    }
    
    return followups.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Helper methods for content parsing
   */
  static inferSectionType(contentLines) {
    const text = contentLines.join(' ').toLowerCase();
    
    if (text.includes('action') || text.includes('todo') || text.includes('next step')) {
      return 'action_items';
    }
    if (contentLines.every(line => line.match(/^\d+\.|^[-*]/))) {
      return 'list';
    }
    if (text.includes('```') || text.includes('code')) {
      return 'code';
    }
    return 'text';
  }

  static processSectionContent(contentLines) {
    // Clean up and format content based on type
    return contentLines
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  static extractActionItems(content) {
    const actionItems = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-*]\s*(?:todo|action|next|step)/i) ||
          trimmed.match(/should|need to|must|will/i)) {
        actionItems.push({
          task: trimmed.replace(/^[-*]\s*/, ''),
          priority: trimmed.includes('urgent') || trimmed.includes('critical') ? 'high' : 'medium',
          assignee: 'user'
        });
      }
    }
    
    return actionItems;
  }

  static extractKeyPoints(content) {
    const points = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-*]\s*/) || trimmed.match(/^\d+\./)) {
        points.push(trimmed.replace(/^[-*]\s*|\d+\.\s*/, ''));
      }
    }
    
    return points.slice(0, 5); // Limit to 5 key points
  }
}

/**
 * Template for instructing agents to use structured format
 */
export const STRUCTURED_RESPONSE_TEMPLATE = `
RESPONSE FORMAT INSTRUCTION:
Please structure your response using the following format for optimal presentation:

## Summary
[One line summary of your response]

## Main Response
[Your primary response content]

## Key Points
- Point 1
- Point 2
- Point 3

## Next Steps (if applicable)
- Action item 1
- Action item 2

Use markdown formatting (## for headers, - for lists) to ensure proper rendering.
`;