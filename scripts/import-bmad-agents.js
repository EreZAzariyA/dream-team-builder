/**
 * Script to import all BMAD agents from .bmad-core/agents/*.md files into the database
 */

const mongoose = require('mongoose');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dream-team";

// Agent schema definition (matching the database model)
const AgentSchema = new mongoose.Schema({
  agentId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  icon: { type: String, default: '🤖' },
  whenToUse: { type: String, trim: true },
  persona: {
    role: { type: String, trim: true },
    style: { type: String, trim: true },
    identity: { type: String, trim: true },
    focus: { type: String, trim: true },
    core_principles: [{ type: String, trim: true }]
  },
  commands: {
    type: Map,
    of: String,
    default: () => new Map([['help', 'Show available commands'], ['exit', 'Exit agent mode']])
  },
  dependencies: {
    tasks: [{ type: String, trim: true }],
    templates: [{ type: String, trim: true }],
    checklists: [{ type: String, trim: true }],
    data: [{ type: String, trim: true }]
  },
  activationInstructions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  isActive: { type: Boolean, default: true },
  isSystemAgent: { type: Boolean, default: true }, // BMAD core agents
  category: { type: String, enum: ['core', 'workflow', 'design', 'custom'], default: 'core' },
  rawContent: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Pre-save middleware to ensure required commands
AgentSchema.pre('save', function(next) {
  if (!this.commands.has('help')) {
    this.commands.set('help', 'Show available commands');
  }
  if (!this.commands.has('exit')) {
    this.commands.set('exit', 'Exit agent mode');
  }
  next();
});

/**
 * Parse agent markdown file and extract YAML configuration
 */
function parseAgentMarkdown(content, filename) {
  const agentId = path.basename(filename, '.md');
  
  // Extract YAML block
  const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);
  if (!yamlMatch) {
    throw new Error(`No YAML block found in ${filename}`);
  }
  
  try {
    const yamlContent = yamlMatch[1];
    const agentData = yaml.load(yamlContent);
    
    if (!agentData.agent) {
      throw new Error(`Missing 'agent' section in ${filename}`);
    }
    
    // Convert commands array/object to Map format
    let commandsMap = new Map();
    if (agentData.commands) {
      if (Array.isArray(agentData.commands)) {
        // Handle array format: ["- help: Show commands", "- create: Create something"]
        agentData.commands.forEach(cmd => {
          if (typeof cmd === 'string') {
            // Parse "- command: description" format
            const match = cmd.match(/^-?\s*([^:]+):\s*(.+)$/);
            if (match) {
              commandsMap.set(match[1].trim(), match[2].trim());
            }
          } else if (typeof cmd === 'object') {
            Object.entries(cmd).forEach(([key, value]) => {
              commandsMap.set(key, value);
            });
          }
        });
      } else if (typeof agentData.commands === 'object') {
        // Handle object format
        Object.entries(agentData.commands).forEach(([key, value]) => {
          commandsMap.set(key, value);
        });
      }
    }
    
    // Ensure required commands
    if (!commandsMap.has('help')) {
      commandsMap.set('help', 'Show available commands');
    }
    if (!commandsMap.has('exit')) {
      commandsMap.set('exit', 'Exit agent mode');
    }
    
    return {
      agentId: agentData.agent.id || agentId,
      name: agentData.agent.name || agentId,
      title: agentData.agent.title || agentId,
      icon: agentData.agent.icon || '🤖',
      whenToUse: agentData.agent.whenToUse || '',
      persona: {
        role: agentData.persona?.role || '',
        style: agentData.persona?.style || '',
        identity: agentData.persona?.identity || '',
        focus: agentData.persona?.focus || '',
        core_principles: agentData.persona?.core_principles || []
      },
      commands: commandsMap,
      dependencies: {
        tasks: agentData.dependencies?.tasks || [],
        templates: agentData.dependencies?.templates || [],
        checklists: agentData.dependencies?.checklists || [],
        data: agentData.dependencies?.data || []
      },
      activationInstructions: agentData['activation-instructions'] || [],
      rawContent: content,
      isSystemAgent: true,
      category: 'core'
    };
  } catch (error) {
    throw new Error(`Failed to parse YAML in ${filename}: ${error.message}`);
  }
}

async function importBmadAgents() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Agent = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);

    // Get any user ID for createdBy (required field)
    const User = mongoose.model('User', new mongoose.Schema({}));
    const anyUser = await User.findOne();
    
    if (!anyUser) {
      console.log('❌ No users found in database. Please create a user first.');
      process.exit(1);
    }

    const agentsDir = path.join(__dirname, '.bmad-core', 'agents');
    const agentFiles = fs.readdirSync(agentsDir).filter(file => file.endsWith('.md'));
    
    console.log(`📖 Found ${agentFiles.length} agent files to import:`);
    agentFiles.forEach(file => console.log(`   - ${file}`));

    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const filename of agentFiles) {
      try {
        const filePath = path.join(agentsDir, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        
        console.log(`\n📋 Processing ${filename}...`);
        
        const agentData = parseAgentMarkdown(content, filename);
        
        // Check if agent already exists
        const existing = await Agent.findOne({ agentId: agentData.agentId });
        
        if (existing) {
          console.log(`⚠️ Agent '${agentData.agentId}' already exists, updating...`);
          
          // Update existing agent
          Object.assign(existing, agentData);
          existing.updatedBy = anyUser._id;
          existing.updatedAt = new Date();
          
          await existing.save();
          updatedCount++;
          console.log(`✅ Updated agent '${agentData.agentId}'`);
        } else {
          // Create new agent
          agentData.createdBy = anyUser._id;
          const agent = new Agent(agentData);
          await agent.save();
          importedCount++;
          console.log(`✅ Imported agent '${agentData.agentId}'`);
        }
        
        // Log agent details
        console.log(`   📝 Name: ${agentData.name}`);
        console.log(`   🎭 Title: ${agentData.title}`);
        console.log(`   📱 Commands: ${Array.from(agentData.commands.keys()).join(', ')}`);
        console.log(`   🔗 Dependencies: ${Object.values(agentData.dependencies).flat().length} total`);
        
      } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n🎉 BMAD Agent Import Summary:');
    console.log(`   ✅ Imported: ${importedCount} agents`);
    console.log(`   🔄 Updated: ${updatedCount} agents`);
    console.log(`   ❌ Errors: ${errorCount} agents`);
    console.log(`   📊 Total processed: ${importedCount + updatedCount + errorCount}/${agentFiles.length} files`);

    // Verify agents are in database
    const totalAgents = await Agent.countDocuments({ isActive: true });
    const coreAgents = await Agent.countDocuments({ isSystemAgent: true, isActive: true });
    
    console.log('\n📈 Database Status:');
    console.log(`   🤖 Total active agents: ${totalAgents}`);
    console.log(`   🏢 Core BMAD agents: ${coreAgents}`);
    console.log(`   👤 Custom agents: ${totalAgents - coreAgents}`);

    console.log('\n🎯 All BMAD agents are now available for workflow execution!');
    
    // List imported agents
    const agents = await Agent.find({ isSystemAgent: true, isActive: true }).select('agentId name title icon');
    console.log('\n📋 Available BMAD Agents:');
    agents.forEach(agent => {
      console.log(`   ${agent.icon} ${agent.agentId} - ${agent.name} (${agent.title})`);
    });

  } catch (error) {
    console.error('❌ Error importing agents:', error);
    if (error.code === 11000) {
      console.log('💡 Duplicate key error - some agents may already exist');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
importBmadAgents();