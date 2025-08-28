/**
 * Script to import the brownfield-fullstack YAML workflow into the database
 */

const mongoose = require('mongoose');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dream-team";

async function importBrownfieldWorkflow() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Read the YAML workflow file
    const workflowPath = path.join(__dirname, '.bmad-core', 'workflows', 'brownfield-fullstack.yaml');
    console.log('📖 Reading workflow file:', workflowPath);
    
    const yamlContent = fs.readFileSync(workflowPath, 'utf8');
    const workflowData = yaml.load(yamlContent);
    
    if (!workflowData || !workflowData.workflow) {
      throw new Error('Invalid YAML structure: missing workflow section');
    }
    
    const workflow = workflowData.workflow;
    console.log('📋 Workflow loaded:', workflow.name);

    // Import the WorkflowTemplate model schema
    const WorkflowTemplateSchema = new mongoose.Schema({
      templateId: { type: String, required: true, unique: true, trim: true },
      name: { type: String, required: true, trim: true },
      description: { type: String, required: false, trim: true },
      type: { type: String, enum: ['greenfield', 'brownfield', 'maintenance', 'enhancement', 'general'], default: 'general' },
      project_types: [{ type: String, trim: true }],
      config: { type: mongoose.Schema.Types.Mixed, required: true }, // Store the full workflow config
      status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active' },
      agents: [{ type: String }],
      stepCount: { type: Number, default: 0 },
      complexity: { type: String, enum: ['Simple', 'Moderate', 'Complex'], default: 'Simple' },
      estimatedTime: { type: String, default: '15-30 minutes' },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }, { timestamps: true, versionKey: false });

    // Pre-save middleware to calculate computed fields
    WorkflowTemplateSchema.pre('save', function(next) {
      // Extract agents from workflow sequence
      const agents = new Set();
      if (this.config.sequence && Array.isArray(this.config.sequence)) {
        for (const step of this.config.sequence) {
          if (step.agent) {
            agents.add(step.agent);
          }
        }
      }
      this.agents = Array.from(agents);
      this.stepCount = this.config.sequence ? this.config.sequence.length : 0;
      
      // Set complexity based on step count and agents
      const stepCount = this.stepCount;
      const uniqueAgents = this.agents.length;
      
      if (stepCount <= 3 && uniqueAgents <= 2) {
        this.complexity = 'Simple';
        this.estimatedTime = '10-15 minutes';
      } else if (stepCount <= 8 && uniqueAgents <= 4) {
        this.complexity = 'Moderate';
        this.estimatedTime = '20-30 minutes';
      } else {
        this.complexity = 'Complex';
        this.estimatedTime = '45-60 minutes';
      }
      
      next();
    });

    const WorkflowTemplate = mongoose.models.WorkflowTemplate || mongoose.model('WorkflowTemplate', WorkflowTemplateSchema);

    // Check if template already exists
    const existing = await WorkflowTemplate.findOne({ templateId: workflow.id });
    if (existing) {
      console.log('⚠️ Brownfield workflow template already exists');
      console.log('📋 Template ID:', existing.templateId);
      console.log('🔄 Updating existing template...');
      
      // Update existing template
      existing.config = workflow;
      existing.name = workflow.name;
      existing.description = workflow.description;
      existing.type = workflow.type;
      existing.project_types = workflow.project_types || [];
      existing.updatedAt = new Date();
      
      await existing.save();
      console.log('✅ Template updated successfully!');
      console.log('📋 Updated Template Details:');
      console.log(`   - Name: ${existing.name}`);
      console.log(`   - Template ID: ${existing.templateId}`);
      console.log(`   - Steps: ${existing.stepCount}`);
      console.log(`   - Agents: ${existing.agents.join(', ')}`);
      console.log(`   - Complexity: ${existing.complexity}`);
      console.log(`   - Estimated Time: ${existing.estimatedTime}`);
      return;
    }

    // Get any user ID for createdBy (required field)
    const User = mongoose.model('User', new mongoose.Schema({}));
    const anyUser = await User.findOne();
    
    if (!anyUser) {
      console.log('❌ No users found in database. Please create a user first.');
      process.exit(1);
    }

    // Create new template
    const templateData = {
      templateId: workflow.id,
      name: workflow.name,
      description: workflow.description,
      type: workflow.type || 'brownfield',
      project_types: workflow.project_types || [],
      config: workflow, // Store the entire workflow configuration
      status: 'active',
      createdBy: anyUser._id
    };

    console.log('📝 Creating brownfield workflow template...');
    const template = new WorkflowTemplate(templateData);
    await template.save();

    console.log('✅ Brownfield workflow template created successfully!');
    console.log('📋 Template Details:');
    console.log(`   - Name: ${template.name}`);
    console.log(`   - Template ID: ${template.templateId}`);
    console.log(`   - Database ID: ${template._id}`);
    console.log(`   - Steps: ${template.stepCount}`);
    console.log(`   - Agents: ${template.agents.join(', ')}`);
    console.log(`   - Complexity: ${template.complexity}`);
    console.log(`   - Estimated Time: ${template.estimatedTime}`);

    console.log('\n🎯 Workflow is now available for execution via BMAD!');

  } catch (error) {
    console.error('❌ Error importing workflow:', error);
    if (error.code === 11000) {
      console.log('💡 Template with this ID already exists');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
importBrownfieldWorkflow();