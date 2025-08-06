/**
 * Test 10-second timing for mock agents
 */

const { MockAgentExecutor } = require('../lib/bmad/MockAgentExecutor.js');

class MockAgentLoader {
  async loadAgent(agentId) {
    return {
      id: agentId,
      agent: { name: `${agentId} Agent` },
      persona: { role: `${agentId} Role` }
    };
  }
}

async function test10SecTiming() {
  logger.info('⏱️  Testing 10-second agent execution timing...\n');
  
  const agentLoader = new MockAgentLoader();
  const mockExecutor = new MockAgentExecutor(agentLoader);
  
  const context = {
    userPrompt: "Test timing with a simple request",
    workflowId: 'timing-test'
  };
  
  const agent = await agentLoader.loadAgent('analyst');
  
  logger.info('🚀 Starting agent execution...');
  const startTime = Date.now();
  
  const result = await mockExecutor.executeAgent(agent, context);
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  logger.info(`✅ Agent completed in ${duration}ms`);
  logger.info(`📊 Expected: ~10000ms, Actual: ${duration}ms`);
  logger.info(`🎯 Success: ${result.success}`);
  logger.info(`📄 Generated: ${result.artifacts[0]?.name}`);
  
  const tolerance = 500; // 500ms tolerance
  if (Math.abs(duration - 10000) <= tolerance) {
    logger.info('✅ Timing is correct!');
  } else {
    logger.info('⚠️  Timing seems off');
  }
}

if (require.main === module) {
  test10SecTiming()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Timing test failed:', error);
      process.exit(1);
    });
}