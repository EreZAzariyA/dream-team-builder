import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema({}, { strict: false, collection: 'workflows' });
const Workflow = mongoose.model('Workflow', workflowSchema);

async function checkWorkflow() {
  try {
    await mongoose.connect('mongodb://localhost:27017/dream-team');
    console.log('Connected to MongoDB');
    
    const workflow = await Workflow.findOne({ workflowId: 'workflow_1756031791760_8br0xbp' });
    
    if (!workflow) {
      console.log('Workflow not found');
      return;
    }
    
    console.log('Workflow found:', workflow.workflowId);
    console.log('Has GitHub metadata:', !!workflow.metadata?.github);
    console.log('Has repositoryAnalysis:', !!workflow.repositoryAnalysis);
    console.log('Has repositoryContext:', !!workflow.repositoryContext);
    
    if (workflow.metadata?.github) {
      console.log('GitHub repo:', workflow.metadata.github.owner + '/' + workflow.metadata.github.name);
    }
    
    // Check if there's repository analysis data
    if (workflow.repositoryAnalysis) {
      console.log('Repository analysis summary length:', workflow.repositoryAnalysis.summary?.length || 0);
      console.log('File count:', workflow.repositoryAnalysis.metrics?.fileCount || 0);
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkWorkflow();