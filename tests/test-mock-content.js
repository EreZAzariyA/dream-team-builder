/**
 * Test Mock Content Quality
 * Shows sample generated content from mock agents
 */

const { MockAgentExecutor } = require('../lib/bmad/MockAgentExecutor.js');

// Mock agent loader
class MockAgentLoader {
  async loadAgent(agentId) {
    return {
      id: agentId,
      agent: { name: `${agentId.charAt(0).toUpperCase() + agentId.slice(1)} Agent` },
      persona: { role: `${agentId.charAt(0).toUpperCase() + agentId.slice(1)} Specialist` }
    };
  }
}

async function showMockContent() {
  logger.info('📋 Mock Content Generation Demo\n');
  
  const agentLoader = new MockAgentLoader();
  const mockExecutor = new MockAgentExecutor(agentLoader);
  mockExecutor.setMockDelay(500); // Faster for demo
  
  const context = {
    userPrompt: "Create a task management application with JWT authentication, user registration, and modern UI",
    workflowId: 'demo-workflow'
  };
  
  // Test analyst content
  logger.info('🔍 Business Analyst Output:');
  logger.info('=' .repeat(50));
  
  const analystAgent = await agentLoader.loadAgent('analyst');
  const analystResult = await mockExecutor.executeAgent(analystAgent, context);
  
  // Show first 500 characters of content
  const analystContent = analystResult.artifacts[0].content;
  logger.info(analystContent.substring(0, 500) + '...\n');
  
  // Test PM content
  logger.info('📋 Product Manager Output:');
  logger.info('=' .repeat(50));
  
  const pmAgent = await agentLoader.loadAgent('pm');
  const pmResult = await mockExecutor.executeAgent(pmAgent, context);
  
  const pmContent = pmResult.artifacts[0].content;
  logger.info(pmContent.substring(0, 500) + '...\n');
  
  // Show artifact metadata
  logger.info('📊 Artifact Metadata:');
  logger.info('=' .repeat(50));
  logger.info('Analyst Artifact:', {
    name: analystResult.artifacts[0].name,
    type: analystResult.artifacts[0].type,
    filename: analystResult.artifacts[0].filename,
    wordCount: analystResult.artifacts[0].metadata.wordCount,
    generatedAt: analystResult.artifacts[0].metadata.generatedAt
  });
  
  logger.info('\nPM Artifact:', {
    name: pmResult.artifacts[0].name,
    type: pmResult.artifacts[0].type,
    filename: pmResult.artifacts[0].filename,
    wordCount: pmResult.artifacts[0].metadata.wordCount,
    generatedAt: pmResult.artifacts[0].metadata.generatedAt
  });
  
  logger.info('\n✨ Mock content generation is working perfectly!');
}

if (require.main === module) {
  showMockContent()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}