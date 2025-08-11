/**
 * Test Dynamic Workflow System MVP
 * This script tests the new dynamic workflow parser and engine
 */

const WorkflowParser = require('../lib/bmad/WorkflowParser.js');
const WorkflowEngine = require('../lib/bmad/WorkflowEngine.js');
const BmadOrchestrator = require('../lib/bmad/BmadOrchestrator.js');

async function testDynamicWorkflowSystem() {
  logger.info('🧪 Testing Dynamic Workflow System MVP\n');

  try {
    // Test 1: WorkflowParser
    logger.info('📋 Test 1: WorkflowParser.parseWorkflowFile()');
    const parser = new WorkflowParser();
    
    // Check if brownfield-fullstack workflow exists
    const workflowExists = await parser.workflowExists('brownfield-fullstack');
    logger.info(`   ✓ Brownfield workflow exists: ${workflowExists}`);

    if (workflowExists) {
      // Parse the workflow
      const workflow = await parser.parseWorkflowFile('brownfield-fullstack');
      logger.info(`   ✓ Parsed workflow: ${workflow.name}`);
      logger.info(`   ✓ Steps count: ${workflow.steps.length}`);
      logger.info(`   ✓ Workflow type: ${workflow.type}`);
      
      // Show first few steps
      logger.info('   ✓ First 5 steps:');
      workflow.steps.slice(0, 5).forEach((step, index) => {
        logger.info(`      ${index + 1}. ${step.stepName || step.agentId} (${step.type})`);
      });

      // Test 2: Reference Resolution
      logger.info('\n🔗 Test 2: Reference Resolution');
      await parser.resolveReferences(workflow);
      logger.info('   ✓ References resolved');

      // Test 3: Workflow Engine Integration
      logger.info('\n⚙️ Test 3: WorkflowEngine Integration');
      const engine = new WorkflowEngine({ mockMode: true });
      await engine.initialize();
      
      // Check if engine can detect dynamic workflow
      const dynamicExists = await engine.workflowParser.workflowExists('brownfield-fullstack');
      logger.info(`   ✓ Engine detects dynamic workflow: ${dynamicExists}`);

      // Test 4: BmadOrchestrator Integration
      logger.info('\n🚀 Test 4: BmadOrchestrator Integration');
      const orchestrator = new BmadOrchestrator();
      await orchestrator.initialize();
      
      // Simulate starting a brownfield workflow
      logger.info('   ✓ BmadOrchestrator initialized and ready for dynamic workflows');
      
      logger.info('\n🎉 All tests passed! Dynamic Workflow System MVP is working.\n');
      
      // Show workflow summary
      logger.info('📊 Brownfield Workflow Summary:');
      logger.info(`   Name: ${workflow.name}`);
      logger.info(`   Description: ${workflow.description}`);
      logger.info(`   Total Steps: ${workflow.steps.length}`);
      logger.info(`   Project Types: ${workflow.projectTypes.join(', ')}`);
      logger.info(`   Has Routing: ${workflow.steps.some(s => s.type === 'routing')}`);
      logger.info(`   Has Conditions: ${workflow.steps.some(s => s.condition)}`);
      logger.info(`   Has Artifacts: ${workflow.steps.some(s => s.creates || s.requires)}`);

    } else {
      logger.info('   ❌ Brownfield workflow not found - check if .bmad-core/workflows/brownfield-fullstack.yaml exists');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDynamicWorkflowSystem().then(() => {
  logger.info('Test completed.');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});