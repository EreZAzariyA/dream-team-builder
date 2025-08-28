import mongoose from 'mongoose';

const repoAnalysisSchema = new mongoose.Schema({}, { strict: false, collection: 'repoanalyses' });
const RepoAnalysis = mongoose.model('RepoAnalysis', repoAnalysisSchema);

async function checkRepoAnalysis() {
  try {
    await mongoose.connect('mongodb://localhost:27017/dream-team');
    console.log('Connected to MongoDB');
    
    // Look for recent repository analyses
    const analyses = await RepoAnalysis.find({
      $or: [
        { 'owner': 'EreZAzariyA' },
        { 'name': 'video-scraper-challenge' },
        { 'fullName': 'EreZAzariyA/video-scraper-challenge' }
      ]
    }).sort({ createdAt: -1 }).limit(5);
    
    console.log(`Found ${analyses.length} repository analyses:`);
    
    for (const analysis of analyses) {
      console.log(`\nAnalysis ID: ${analysis._id}`);
      console.log(`Repository: ${analysis.fullName || analysis.owner + '/' + analysis.name}`);
      console.log(`Status: ${analysis.status}`);
      console.log(`Created: ${analysis.createdAt}`);
      if (analysis.error) {
        console.log(`Error: ${analysis.error}`);
      }
      if (analysis.metrics) {
        console.log(`File count: ${analysis.metrics.fileCount || 0}`);
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRepoAnalysis();