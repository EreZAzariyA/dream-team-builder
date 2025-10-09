/**
 * Script to add Production Development Workflow template to database
 */

const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dream-team";

// Template data converted from markdown to database format
const productionWorkflowTemplate = {
  name: "Production Development Workflow",
  description: "A comprehensive AI development workflow that includes git integration, code execution, testing, and quality gates for real production development.",
  type: "general",
  project_types: ["fullstack", "backend", "frontend", "api", "microservice"],
  sequence: [
    {
      agent: "analyst",
      action: "Analyze development requirements and scope",
      creates: "requirements_analysis",
      requires: [],
      notes: "Analyze the development request and break down requirements into actionable tasks",
      optional: false
    },
    {
      agent: "architect",
      action: "Design technical architecture and approach",
      creates: "technical_design",
      requires: ["requirements_analysis"],
      notes: "Create comprehensive technical design including system architecture, technology choices, and implementation approach",
      optional: false
    },
    {
      agent: "developer",
      action: "Initialize development environment and repository structure",
      creates: "dev_environment_setup",
      requires: ["technical_design"],
      notes: "Set up the development environment, create project structure, and initialize necessary configurations",
      optional: false
    },
    {
      agent: "developer",
      action: "Implement the core functionality",
      creates: "core_implementation",
      requires: ["dev_environment_setup"],
      notes: "Develop the main features according to the technical design",
      optional: false
    },
    {
      agent: "developer",
      action: "Create unit and integration tests",
      creates: "test_suite",
      requires: ["core_implementation"],
      notes: "Implement comprehensive test coverage including unit tests, integration tests, and end-to-end tests",
      optional: false
    },
    {
      agent: "qa",
      action: "Perform quality validation and testing",
      creates: "qa_report",
      requires: ["test_suite"],
      notes: "Execute quality assurance processes including automated testing, code review, and validation",
      optional: false
    },
    {
      agent: "developer",
      action: "Review code and optimize based on QA feedback",
      creates: "optimized_code",
      requires: ["qa_report"],
      notes: "Address QA feedback, optimize code performance, and ensure production readiness",
      optional: false
    },
    {
      agent: "pm",
      action: "Create comprehensive documentation",
      creates: "project_documentation",
      requires: ["optimized_code"],
      notes: "Generate user documentation, API documentation, and deployment guides",
      optional: false
    },
    {
      agent: "qa",
      action: "Final production readiness validation",
      creates: "final_validation_report",
      requires: ["project_documentation"],
      notes: "Perform final validation to ensure the solution is production-ready",
      optional: false
    }
  ],
  decision_guidance: {
    when_to_use: [
      "Building production-ready applications",
      "Need comprehensive testing and quality assurance",
      "Require git integration and automated workflows",
      "Want automated code execution and validation",
      "Building for enterprise or professional use"
    ],
    complexity: "Complex",
    estimated_time: "60-120 minutes"
  },
  handoff_prompts: {
    production_features: {
      git_integration: "Automatic branch creation, commits, and pull request generation",
      code_execution: "Automated testing, building, and linting",
      quality_gates: "Code coverage, security scanning, and performance validation"
    }
  }
};

async function addProductionTemplate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import the WorkflowTemplate model
    const WorkflowTemplateSchema = new mongoose.Schema({
      name: { type: String, required: true, unique: true, trim: true },
      description: { type: String, required: false, trim: true },
      type: { type: String, enum: ['greenfield', 'brownfield', 'maintenance', 'enhancement', 'general'], default: 'general' },
      project_types: [{ type: String, trim: true }],
      sequence: [{
        agent: { type: String, required: true },
        action: { type: String },
        creates: { type: String },
        requires: [{ type: String }],
        notes: { type: String },
        optional: { type: Boolean, default: false },
        condition: { type: String },
        optional_steps: [{ type: String }],
      }],
      decision_guidance: {
        when_to_use: [{ type: String }],
        complexity: { type: String, enum: ['Simple', 'Moderate', 'Complex'] },
        estimated_time: { type: String },
      },
      handoff_prompts: { type: mongoose.Schema.Types.Mixed, default: {} },
      agents: [{ type: String }],
      stepCount: { type: Number, default: 0 },
      complexity: { type: String, enum: ['Simple', 'Moderate', 'Complex'], default: 'Simple' },
      estimatedTime: { type: String, default: '15-30 minutes' },
      isActive: { type: Boolean, default: true },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }, { timestamps: true, versionKey: false });

    // Pre-save middleware to calculate computed fields
    WorkflowTemplateSchema.pre('save', function(next) {
      const agents = new Set();
      for (const step of this.sequence) {
        if (step.agent) {
          agents.add(step.agent);
        }
      }
      this.agents = Array.from(agents);
      this.stepCount = this.sequence.length;
      
      const stepCount = this.sequence.length;
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
    const existing = await WorkflowTemplate.findOne({ name: productionWorkflowTemplate.name });
    if (existing) {
      console.log('⚠️ Production Development Workflow template already exists');
      console.log('📋 Template ID:', existing._id);
      process.exit(0);
    }

    // Get any user ID for createdBy (required field)
    const User = mongoose.model('User', new mongoose.Schema({}));
    const anyUser = await User.findOne();
    
    if (!anyUser) {
      console.log('❌ No users found in database. Please create a user first.');
      process.exit(1);
    }

    // Add createdBy field
    productionWorkflowTemplate.createdBy = anyUser._id;

    console.log('📝 Creating Production Development Workflow template...');
    const template = new WorkflowTemplate(productionWorkflowTemplate);
    await template.save();

    console.log('✅ Production Development Workflow template created successfully!');
    console.log('📋 Template Details:');
    console.log(`   - Name: ${template.name}`);
    console.log(`   - ID: ${template._id}`);
    console.log(`   - Steps: ${template.stepCount}`);
    console.log(`   - Agents: ${template.agents.join(', ')}`);
    console.log(`   - Complexity: ${template.complexity}`);
    console.log(`   - Estimated Time: ${template.estimatedTime}`);

    console.log('\n🎯 Template is now available in Admin > Workflow Templates!');

  } catch (error) {
    console.error('❌ Error creating template:', error);
    if (error.code === 11000) {
      console.log('💡 Template with this name already exists');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
addProductionTemplate();