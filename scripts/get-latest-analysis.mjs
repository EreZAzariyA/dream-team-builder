import mongoose from 'mongoose';

const repoAnalysisSchema = new mongoose.Schema({}, { strict: false, collection: 'repoanalyses' });
const RepoAnalysis = mongoose.model('RepoAnalysis', repoAnalysisSchema);

async function getLatestAnalysis() {
  try {
    await mongoose.connect('mongodb://localhost:27017/dream-team');
    console.log('Connected to MongoDB');
    
    const analysis = await RepoAnalysis.findOne({
      fullName: 'EreZAzariyA/video-scraper-challenge',
      status: 'completed'
    }).sort({ createdAt: -1 });
    
    if (analysis) {
      console.log('Latest analysis details:');
      console.log('ID:', analysis._id.toString());
      console.log('Repository ID:', analysis.repositoryId);
      console.log('Owner:', analysis.owner);
      console.log('Name:', analysis.name);
      console.log('Full Name:', analysis.fullName);
      console.log('User ID:', analysis.userId.toString());
      console.log('Status:', analysis.status);
      console.log('File count:', analysis.metrics?.fileCount);
      console.log('Summary length:', analysis.summary?.length || 0);
      console.log('Has file index:', !!analysis.fileIndex);
      console.log('File index length:', analysis.fileIndex?.length || 0);
    } else {
      console.log('No completed analysis found');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getLatestAnalysis();