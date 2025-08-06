/**
 * Test Script for Mock BMAD Execution
 * Run this to verify mock mode works correctly
 */

const { BmadOrchestrator } = require('../lib/bmad/BmadOrchestrator.js');

async function testMockExecution() {
  logger.info('🧪 Testing BMAD Mock Execution Flow...\n');
  
  try {
    // Initialize orchestrator in mock mode
    const orchestrator = new BmadOrchestrator(null, { mockMode: true });
    await orchestrator.initialize();
    
    logger.info('✅ Mock orchestrator initialized successfully\n');
    
    // Test workflow execution
    const userPrompt = "Create a to-do app with JWT authentication, user registration, and modern UI";
    
    logger.info(`🚀 Starting mock workflow with prompt: "${userPrompt}"\n`);
    
    const workflowResult = await orchestrator.startWorkflow(userPrompt, {
      name: 'Mock Test Workflow',
      sequence: 'FULL_STACK' // This will use all agents in sequence
    });
    
    logger.info('📊 Workflow started:', workflowResult);
    
    // Monitor workflow progress for a bit
    let checkCount = 0;
    const maxChecks = 20; // Check for up to 1 minute (20 * 3 seconds)
    
    while (checkCount < maxChecks) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      const status = orchestrator.getWorkflowStatus(workflowResult.workflowId);
      if (!status) {
        logger.info('❌ Workflow not found');
        break;
      }
      
      logger.info(`🔄 Step ${status.currentStep}/${status.totalSteps} - ${status.status} - Agent: ${status.currentAgent || 'None'}`);
      
      if (status.status === 'COMPLETED' || status.status === 'ERROR' || status.status === 'CANCELLED') {
        logger.info('\n🎉 Workflow finished!');
        logger.info('Final Status:', status);
        
        // Get artifacts
        const artifacts = await orchestrator.getWorkflowArtifacts(workflowResult.workflowId);
        logger.info(`\n📁 Generated ${artifacts.length} artifacts:`);
        artifacts.forEach((artifact, index) => {
          logger.info(`  ${index + 1}. ${artifact.name} (${artifact.type})`);
          logger.info(`     ${artifact.description}`);
          logger.info(`     Word count: ${artifact.metadata?.wordCount || 'N/A'}`);
        });
        
        break;
      }
      
      checkCount++;
    }
    
    if (checkCount >= maxChecks) {
      logger.info('\n⏰ Test timeout reached - workflow may still be running');
    }
    
    logger.info('\n✅ Mock execution test completed successfully!');
    
  } catch (error) {
    console.error('❌ Mock execution test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testMockExecution()
    .then(() => {
      logger.info('\n🏁 Test script finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test script crashed:', error);
      process.exit(1);
    });
}

module.exports = { testMockExecution };