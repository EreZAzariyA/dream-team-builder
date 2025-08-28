import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
  // Basic agent information
  agentId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z-]+$/,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    default: '🤖'
  },
  whenToUse: {
    type: String,
    trim: true
  },
  
  // Persona configuration
  persona: {
    role: {
      type: String,
      trim: true
    },
    style: {
      type: String,
      trim: true
    },
    identity: {
      type: String,
      trim: true
    },
    focus: {
      type: String,
      trim: true
    },
    core_principles: [{
      type: String,
      trim: true
    }]
  },

  // Agent capabilities - commands as key-value pairs
  commands: {
    type: Map,
    of: String,
    default: () => new Map([['help', 'Show available commands'], ['exit', 'Exit agent mode']])
  },

  // Dependencies structure
  dependencies: {
    tasks: [{
      type: String,
      trim: true
    }],
    templates: [{
      type: String,
      trim: true
    }],
    checklists: [{
      type: String,
      trim: true
    }],
    data: [{
      type: String,
      trim: true
    }]
  },

  // Activation instructions (can be strings, objects, or mixed)
  activationInstructions: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },

  // Agent status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemAgent: {
    type: Boolean,
    default: false // true for core BMAD agents, false for custom agents
  },
  category: {
    type: String,
    enum: ['core', 'workflow', 'design', 'custom'],
    default: 'custom'
  },

  // Raw markdown content (for backup/export)
  rawContent: {
    type: String
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
AgentSchema.index({ isActive: 1, category: 1 });
AgentSchema.index({ 'commands': 1 });
AgentSchema.index({ agentId: 1, isActive: 1 });

// Virtual for compatibility with existing code
AgentSchema.virtual('id').get(function() {
  return this.agentId;
});

// Virtual for dependency count
AgentSchema.virtual('dependencyCount').get(function() {
  const deps = this.dependencies;
  return Object.values(deps).reduce((sum, arr) => sum + (arr?.length || 0), 0);
});

// Pre-save middleware to ensure required commands
AgentSchema.pre('save', function(next) {
  // Ensure help and exit commands are always present
  if (!this.commands.has('help')) {
    this.commands.set('help', 'Show available commands');
  }
  if (!this.commands.has('exit')) {
    this.commands.set('exit', 'Exit agent mode');
  }
  next();
});

// Static method to get all active agents
AgentSchema.statics.getActiveAgents = function() {
  return this.find({ isActive: true }).sort({ category: 1, name: 1 });
};

// Static method to get core BMAD agents
AgentSchema.statics.getCoreAgents = function() {
  return this.find({ isActive: true, isSystemAgent: true }).sort({ name: 1 });
};

// Static method to get custom agents
AgentSchema.statics.getCustomAgents = function() {
  return this.find({ isActive: true, isSystemAgent: false }).sort({ name: 1 });
};

// Instance method to generate markdown content
AgentSchema.methods.generateMarkdown = function() {
  // Ensure activation instructions are properly formatted as YAML list
  const formatActivationInstructions = (instructions) => {
    if (!Array.isArray(instructions) || instructions.length === 0) {
      return [
        'STEP 1: Read THIS ENTIRE FILE - it contains your complete persona definition',
        'STEP 2: Adopt the persona defined in the \'agent\' and \'persona\' sections below',
        'STEP 3: Greet user with your name/role and mention `*help` command',
        'DO NOT: Load any other agent files during activation',
        'ONLY load dependency files when user selects them for execution via command or request of a task',
        'The agent.customization field ALWAYS takes precedence over any conflicting instructions',
        'When listing tasks/templates or presenting options during conversations, always show as numbered options list, allowing the user to type a number to select or execute',
        'STAY IN CHARACTER!',
        'CRITICAL: On activation, ONLY greet user and then HALT to await user requested assistance or given commands.'
      ];
    }
    
    // Convert all instructions to strings for consistent YAML output
    return instructions.map(instruction => {
      if (typeof instruction === 'string') return instruction;
      if (typeof instruction === 'object' && instruction !== null) {
        const entries = Object.entries(instruction);
        if (entries.length === 1) {
          const [key, value] = entries[0];
          return `${key}: ${value}`;
        }
        return JSON.stringify(instruction);
      }
      return String(instruction);
    });
  };

  const yamlData = {
    'activation-instructions': formatActivationInstructions(this.activationInstructions),
    agent: {
      name: this.name,
      id: this.agentId,
      title: this.title,
      icon: this.icon,
      whenToUse: this.whenToUse || ''
    },
    persona: this.persona,
    commands: Object.fromEntries(this.commands),
    dependencies: this.dependencies
  };

  const yaml = require('js-yaml');
  const yamlContent = yaml.dump(yamlData, { indent: 2 });

  return `# ${this.agentId}

ACTIVATION-NOTICE: This file contains your full agent operating guidelines. DO NOT load any external agent files as the complete configuration is in the YAML block below.

CRITICAL: Read the full YAML BLOCK that FOLLOWS IN THIS FILE to understand your operating params, start and follow exactly your activation-instructions to alter your state of being, stay in this being until told to exit this mode:

## COMPLETE AGENT DEFINITION FOLLOWS - NO EXTERNAL FILES NEEDED

\`\`\`yaml
${yamlContent}
\`\`\`
`;
};

// Instance method to convert to API format
AgentSchema.methods.toApiFormat = function() {
  return {
    id: this.agentId,
    name: this.name,
    title: this.title,
    icon: this.icon,
    description: this.whenToUse,
    commands: Array.from(this.commands.keys()),
    capabilities: this.persona.core_principles || [],
    persona: this.persona,
    dependencies: this.dependencies,
    category: this.category,
    isSystemAgent: this.isSystemAgent,
    dependencyCount: this.dependencyCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const Agent = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);

export default Agent;