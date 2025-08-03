/**
 * Test Mock Content Quality
 * Shows sample generated content from mock agents
 */

const { MockAgentExecutor } = require('./lib/bmad/MockAgentExecutor.js');

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
  console.log('📋 Mock Content Generation Demo\n');
  
  const agentLoader = new MockAgentLoader();
  const mockExecutor = new MockAgentExecutor(agentLoader);
  mockExecutor.setMockDelay(500); // Faster for demo
  
  const context = {
    userPrompt: "Create a task management application with JWT authentication, user registration, and modern UI",
    workflowId: 'demo-workflow'
  };
  
  // Test analyst content
  console.log('🔍 Business Analyst Output:');
  console.log('=' .repeat(50));
  
  const analystAgent = await agentLoader.loadAgent('analyst');
  const analystResult = await mockExecutor.executeAgent(analystAgent, context);
  
  // Show first 500 characters of content
  const analystContent = analystResult.artifacts[0].content;
  console.log(analystContent.substring(0, 500) + '...\n');
  
  // Test PM content
  console.log('📋 Product Manager Output:');
  console.log('=' .repeat(50));
  
  const pmAgent = await agentLoader.loadAgent('pm');
  const pmResult = await mockExecutor.executeAgent(pmAgent, context);
  
  const pmContent = pmResult.artifacts[0].content;
  console.log(pmContent.substring(0, 500) + '...\n');
  
  // Show artifact metadata
  console.log('📊 Artifact Metadata:');
  console.log('=' .repeat(50));
  console.log('Analyst Artifact:', {
    name: analystResult.artifacts[0].name,
    type: analystResult.artifacts[0].type,
    filename: analystResult.artifacts[0].filename,
    wordCount: analystResult.artifacts[0].metadata.wordCount,
    generatedAt: analystResult.artifacts[0].metadata.generatedAt
  });
  
  console.log('\nPM Artifact:', {
    name: pmResult.artifacts[0].name,
    type: pmResult.artifacts[0].type,
    filename: pmResult.artifacts[0].filename,
    wordCount: pmResult.artifacts[0].metadata.wordCount,
    generatedAt: pmResult.artifacts[0].metadata.generatedAt
  });
  
  console.log('\n✨ Mock content generation is working perfectly!');
}

if (require.main === module) {
  showMockContent()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}