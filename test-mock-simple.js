/**
 * Simple Mock Test - No Database Dependencies
 * Tests just the MockAgentExecutor functionality
 */

const { MockAgentExecutor } = require('./lib/bmad/MockAgentExecutor.js');

// Mock agent loader for testing
class MockAgentLoader {
  async loadAgent(agentId) {
    const agents = {
      'analyst': {
        id: 'analyst',
        agent: { name: 'Business Analyst' },
        persona: { role: 'Business Analyst' }
      },
      'pm': {
        id: 'pm',
        agent: { name: 'Product Manager' },
        persona: { role: 'Product Manager' }
      },
      'architect': {
        id: 'architect',
        agent: { name: 'System Architect' },
        persona: { role: 'System Architect' }
      }
    };
    return agents[agentId] || {
      id: agentId,
      agent: { name: `Mock Agent ${agentId}` },
      persona: { role: 'Mock Role' }
    };
  }
}

async function testMockExecutor() {
  console.log('🧪 Testing Mock Agent Executor...\n');

  try {
    const agentLoader = new MockAgentLoader();
    const mockExecutor = new MockAgentExecutor(agentLoader);
    
    // Configure faster execution for testing
    mockExecutor.setMockDelay(1000); // 1 second delay
    mockExecutor.setMockFailureRate(0); // No failures
    
    console.log('✅ Mock executor configured\n');
    
    // Test different agents
    const testAgents = ['analyst', 'pm', 'architect'];
    const context = {
      userPrompt: "Create a to-do app with JWT authentication, user registration, and modern UI",
      workflowId: 'test-workflow-123'
    };
    
    for (const agentId of testAgents) {
      console.log(`🤖 Testing agent: ${agentId}`);
      
      const agent = await agentLoader.loadAgent(agentId);
      const startTime = Date.now();
      
      const result = await mockExecutor.executeAgent(agent, context);
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Completed in ${duration}ms`);
      console.log(`   📄 Generated: ${result.artifacts[0]?.name || 'No artifact'}`);
      console.log(`   📝 Word count: ${result.artifacts[0]?.metadata?.wordCount || 'N/A'}`);
      console.log(`   🎯 Success: ${result.success}\n`);
      
      if (!result.success) {
        console.error(`   ❌ Error: ${result.error}`);
      }
    }
    
    console.log('🎉 All mock agent tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Mock executor test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testMockExecutor()
    .then(() => {
      console.log('\n🏁 Simple mock test finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Simple mock test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testMockExecutor };