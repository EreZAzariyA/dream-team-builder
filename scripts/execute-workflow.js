/**
 * Direct BMAD Workflow Execution Script
 * Executes the brownfield-fullstack workflow directly without API authentication
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function executeWorkflow() {
  try {
    console.log('🚀 Starting brownfield-fullstack workflow execution...');
    
    // Import required modules dynamically
    const { BmadOrchestrator } = await import('../lib/bmad/BmadOrchestrator.js');
    
    // Initialize orchestrator with mock mode
    const orchestrator = new BmadOrchestrator();
    await orchestrator.initialize();
    
    console.log('✅ BMAD Orchestrator initialized');
    
    // Define the workflow execution parameters
    const workflowConfig = {
      userPrompt: "Execute the brownfield-fullstack workflow for enhancing an existing application. This is a test execution to validate the workflow steps and demonstrate the BMAD system capabilities.",
      name: "Brownfield Enhancement Workflow Test",
      sequence: "brownfield-fullstack",
      description: "Running the complete brownfield full-stack enhancement workflow as defined in the YAML file",
      priority: "normal",
      tags: ["brownfield", "fullstack", "enhancement", "test"],
      workflowId: `test_workflow_${Date.now()}`,
      userId: "test_user",
      mockMode: true,
      context: {
        initiatedBy: "test_user",
        timestamp: new Date(),
        testExecution: true
      }
    };
    
    console.log(`📋 Starting workflow: ${workflowConfig.sequence}`);
    console.log(`📝 User prompt: ${workflowConfig.userPrompt}`);
    
    // Start the workflow
    const result = await orchestrator.startWorkflow(workflowConfig.userPrompt, workflowConfig);
    
    console.log('🎉 Workflow execution result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Get workflow status to see execution details
    if (result.workflowId) {
      console.log('📊 Fetching workflow status...');
      const status = await orchestrator.getWorkflowStatus(result.workflowId);
      console.log('📈 Workflow status:');
      console.log(JSON.stringify(status, null, 2));
    }
    
    console.log('✅ Workflow execution completed successfully');
    
  } catch (error) {
    console.error('❌ Error executing workflow:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Execute the workflow
executeWorkflow().catch(console.error);