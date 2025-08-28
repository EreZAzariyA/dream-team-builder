import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema({}, { strict: false, collection: 'workflows' });
const Workflow = mongoose.model('Workflow', workflowSchema);

async function debugWorkflowContext() {
  try {
    await mongoose.connect('mongodb://localhost:27017/dream-team');
    console.log('Connected to MongoDB');
    
    const workflow = await Workflow.findOne({ workflowId: 'workflow_1756032345571_9yy9n08' });
    
    if (!workflow) {
      console.log('❌ Workflow not found');
      return;
    }
    
    console.log('\n=== WORKFLOW DEBUG ANALYSIS ===');
    console.log('Workflow ID:', workflow.workflowId);
    console.log('Status:', workflow.status);
    
    console.log('\n=== REPOSITORY ANALYSIS CHECK ===');
    console.log('Has repositoryAnalysis field:', !!workflow.repositoryAnalysis);
    
    if (workflow.repositoryAnalysis) {
      console.log('Repository analysis keys:', Object.keys(workflow.repositoryAnalysis));
      if (workflow.repositoryAnalysis.repository) {
        console.log('Repository info:', workflow.repositoryAnalysis.repository);
      }
      if (workflow.repositoryAnalysis.metrics) {
        console.log('File count:', workflow.repositoryAnalysis.metrics.fileCount);
        console.log('Total lines:', workflow.repositoryAnalysis.metrics.totalLines);
      }
      if (workflow.repositoryAnalysis.fileIndex) {
        console.log('File index length:', workflow.repositoryAnalysis.fileIndex.length);
        console.log('Sample files:', workflow.repositoryAnalysis.fileIndex.slice(0, 3).map(f => f.path));
      }
    } else {
      console.log('❌ No repositoryAnalysis field found');
    }
    
    console.log('\n=== METADATA CHECK ===');
    console.log('Has metadata.github:', !!workflow.metadata?.github);
    if (workflow.metadata?.github) {
      console.log('GitHub metadata:', workflow.metadata.github);
    }
    
    console.log('\n=== BMAD WORKFLOW DATA CHECK ===');
    console.log('Has bmadWorkflowData:', !!workflow.bmadWorkflowData);
    if (workflow.bmadWorkflowData) {
      console.log('Current step:', workflow.bmadWorkflowData.currentStep);
      console.log('Total steps:', workflow.bmadWorkflowData.totalSteps);
      console.log('Messages count:', workflow.bmadWorkflowData.messages?.length || 0);
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugWorkflowContext();