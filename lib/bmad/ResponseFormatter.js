/**
 * Unified Response Formatter for BMAD Agents
 * Ensures all agent responses follow a consistent structure for elegant UI presentation
 */

class ResponseFormatter {
  /**
   * Format agent response into unified structure
   */
  static formatAgentResponse(agentDefinition, rawContent, metadata = {}) {
    const agent = agentDefinition?.agent || {};

    let parsedContent = null;
    try {
      if (rawContent.includes('===') || rawContent.includes('##') || rawContent.includes('**')) {
        parsedContent = this.parseStructuredContent(rawContent);
      }
    } catch (e) {
      // fallback silently
    }

    return {
      agentId: agent.id || 'unknown',
      agentName: agent.name || 'Agent',
      agentTitle: agent.title || 'Assistant',
      agentIcon: agent.icon || '🤖',
      response: {
        type: parsedContent ? 'structured' : 'simple',
        summary: this.extractSummary(rawContent),
        content: parsedContent || {
          main: rawContent,
          sections: this.autoGenerateSections(rawContent)
        },
        codeModifications: parsedContent?.codeModifications || []
      },
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

  static parseStructuredContent(content) {
    const sections = [];
    let main = '';
    const lines = content.split('\n');
    let currentSection = null;
    let currentContent = [];
    let codeModificationsContent = '';
    let inCodeModificationsSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('##') || trimmed.startsWith('===') || (trimmed.startsWith('**') && trimmed.endsWith('**'))) {
        if (currentSection) {
          sections.push({
            title: currentSection,
            type: this.inferSectionType(currentContent),
            content: this.processSectionContent(currentContent)
          });
        }

        if (trimmed.toLowerCase().includes('code modifications')) {
          inCodeModificationsSection = true;
          currentSection = null;
          currentContent = [];
          continue;
        } else {
          inCodeModificationsSection = false;
        }

        currentSection = trimmed.replace(/[#=*]/g, '').trim();
        currentContent = [];
      } else if (inCodeModificationsSection) {
        codeModificationsContent += line + '\n';
      } else if (currentSection) {
        if (trimmed) currentContent.push(trimmed);
      } else {
        if (trimmed) main += trimmed + '\n';
      }
    }

    if (currentSection && currentContent.length > 0) {
      sections.push({
        title: currentSection,
        type: this.inferSectionType(currentContent),
        content: this.processSectionContent(currentContent)
      });
    }

    let codeModifications = [];
    if (codeModificationsContent) {
      try {
        const jsonMatch = codeModificationsContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          codeModifications = JSON.parse(jsonMatch[1]);
        }
      } catch (e) {
        console.error('Error parsing code modifications JSON:', e);
      }
    }

    return { main: main.trim(), sections, codeModifications };
  }

  static autoGenerateSections(content) {
    const sections = [];
    const actionItems = this.extractActionItems(content);
    if (actionItems.length > 0) {
      sections.push({ title: 'Action Items', type: 'action_items', content: actionItems });
    }
    const keyPoints = this.extractKeyPoints(content);
    if (keyPoints.length > 0) {
      sections.push({ title: 'Key Points', type: 'list', content: keyPoints });
    }
    return sections;
  }

  static extractSummary(content) {
    const summaryMatch = content.match(/(?:summary|tldr|in short)[:\-]\s*(.+?)(?:\n|$)/i);
    if (summaryMatch) return summaryMatch[1].trim();
    const firstSentence = content.split(/[.!?]/)[0];
    return firstSentence.length > 100 ? firstSentence.substring(0, 97) + '...' : firstSentence;
  }

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

  static generateFollowups(agent, content) {
    const followups = [];
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
    if (content.toLowerCase().includes('next step')) followups.push('*plan');
    if (content.toLowerCase().includes('workflow')) followups.push('*workflow');
    return followups.slice(0, 3);
  }

  static inferSectionType(contentLines) {
    const text = contentLines.join(' ').toLowerCase();
    if (text.includes('action') || text.includes('todo') || text.includes('next step')) return 'action_items';
    if (contentLines.every(line => line.match(/^\d+\.|^[-*]/))) return 'list';
    if (text.includes('```') || text.includes('code')) return 'code';
    return 'text';
  }

  static processSectionContent(contentLines) {
    return contentLines
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  static extractActionItems(content) {
    const actionItems = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-*]\s*(?:todo|action|next|step)/i) || trimmed.match(/should|need to|must|will/i)) {
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
    return points.slice(0, 5);
  }
}

export const STRUCTURED_RESPONSE_TEMPLATE = `
Please structure your response using the following format for optimal presentation:

## Summary
[One line summary of your response]

## Main Response
[Your primary response content, formatted in Markdown]

## Key Points
- Point 1
- Point 2
- Point 3

## Code Modifications (if applicable)
\`\`\`json
[
  {
    "type": "replace",
    "file_path": "/path/to/file.js",
    "old_string": "logger.info('old');",
    "new_string": "logger.info('new');"
  },
  {
    "type": "write",
    "file_path": "/path/to/new_file.js",
    "content": "// New file content"
  }
]
\`\`\`

## Next Steps (if applicable)
- Action item 1
- Action item 2

Use markdown formatting (## for headers, - for lists) to ensure proper rendering.
If providing code modifications, ensure the JSON block is valid and properly escaped within the Markdown.
`;

export default ResponseFormatter;
