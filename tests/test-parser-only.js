/**
 * Simple test for WorkflowParser only
 */

const WorkflowParser = require('../lib/bmad/WorkflowParser.js');

async function testParser() {
  logger.info('🧪 Testing WorkflowParser MVP\n');

  try {
    const parser = new WorkflowParser();
    
    // Test if workflow file exists
    logger.info('📋 Checking if brownfield-fullstack.yaml exists...');
    const workflowExists = await parser.workflowExists('brownfield-fullstack');
    logger.info(`   Result: ${workflowExists ? '✅ Found' : '❌ Not found'}`);

    if (workflowExists) {
      logger.info('\n📖 Parsing brownfield-fullstack.yaml...');
      const workflow = await parser.parseWorkflowFile('brownfield-fullstack');
      
      logger.info(`✅ Successfully parsed workflow!`);
      logger.info(`   Name: ${workflow.name}`);
      logger.info(`   Description: ${workflow.description.substring(0, 100)}...`);
      logger.info(`   Type: ${workflow.type}`);
      logger.info(`   Total Steps: ${workflow.steps.length}`);
      logger.info(`   Source: ${workflow.source}`);

      logger.info('\n📝 First 5 steps:');
      workflow.steps.slice(0, 5).forEach((step, index) => {
        const stepName = step.stepName || step.agentId || 'Unknown';
        const stepType = step.type || 'unknown';
        logger.info(`   ${index + 1}. ${stepName} (${stepType}) - ${step.agentId || 'no agent'}`);
      });

      // Check for routing steps
      const routingSteps = workflow.steps.filter(s => s.type === 'routing');
      logger.info(`\n🔀 Routing steps found: ${routingSteps.length}`);
      routingSteps.forEach(step => {
        logger.info(`   - ${step.stepName}: ${step.routingOptions?.join(', ')}`);
      });

      // Check for conditional steps
      const conditionalSteps = workflow.steps.filter(s => s.condition);
      logger.info(`\n⚡ Conditional steps found: ${conditionalSteps.length}`);
      conditionalSteps.forEach(step => {
        logger.info(`   - ${step.stepName || step.agentId}: condition "${step.condition}"`);
      });

      // Check for artifact steps
      const artifactSteps = workflow.steps.filter(s => s.creates || s.requires);
      logger.info(`\n📄 Artifact steps found: ${artifactSteps.length}`);
      artifactSteps.forEach(step => {
        if (step.creates) logger.info(`   - ${step.stepName || step.agentId}: creates "${step.creates}"`);
        if (step.requires) logger.info(`   - ${step.stepName || step.agentId}: requires "${step.requires}"`);
      });

      logger.info('\n🎉 WorkflowParser MVP test completed successfully!');
      
    } else {
      logger.info('❌ Cannot test parser - workflow file not found');
      logger.info('   Expected location: .bmad-core/workflows/brownfield-fullstack.yaml');
    }

  } catch (error) {
    console.error('❌ Parser test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

testParser();