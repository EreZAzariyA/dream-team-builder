/**
 * Migration script to move existing file-based agents to database
 * Run this once to populate the database with existing .bmad-core/agents
 */

const { promises: fs } = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const mongoose = require('mongoose');

// MongoDB connection
const connectToDatabase = async () => {
  if (mongoose.connections[0].readyState) return;
  
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream-team';
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
};

// Agent schema (simplified for migration)
const AgentSchema = new mongoose.Schema({
  agentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  title: { type: String, required: true },
  icon: { type: String, default: '🤖' },
  whenToUse: { type: String },
  persona: {
    role: String,
    style: String,
    identity: String,
    focus: String,
    core_principles: [String]
  },
  commands: {
    type: Map,
    of: String,
    default: () => new Map([['help', 'Show available commands'], ['exit', 'Exit agent mode']])
  },
  dependencies: {
    tasks: [String],
    templates: [String],
    checklists: [String],
    data: [String]
  },
  activationInstructions: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  isActive: { type: Boolean, default: true },
  isSystemAgent: { type: Boolean, default: true },
  category: { type: String, default: 'core' },
  rawContent: String
}, { timestamps: true });

const Agent = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);

// Function to parse agent file
const parseAgentFile = async (filePath, agentId) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Extract YAML block
    const yamlMatch = content.match(/```yaml\s*\n([\s\S]*?)\n```/);
    if (!yamlMatch) {
      console.warn(`No YAML block found in ${agentId}.md`);
      return null;
    }

    const yamlContent = yamlMatch[1];
    const agentData = yaml.load(yamlContent);

    if (!agentData || !agentData.agent) {
      console.warn(`Invalid agent data in ${agentId}.md`);
      return null;
    }

    // Determine category based on agent ID
    let category = 'core';
    if (['bmad-master', 'bmad-orchestrator'].includes(agentId)) {
      category = 'workflow';
    } else if (['ux-expert'].includes(agentId)) {
      category = 'design';
    }

    return {
      agentId: agentData.agent.id || agentId,
      name: agentData.agent.name || agentId,
      title: agentData.agent.title || 'Agent',
      icon: agentData.agent.icon || '🤖',
      whenToUse: agentData.agent.whenToUse || '',
      persona: {
        role: agentData.persona?.role || '',
        style: agentData.persona?.style || '',
        identity: agentData.persona?.identity || '',
        focus: agentData.persona?.focus || '',
        core_principles: agentData.persona?.core_principles || []
      },
      commands: agentData.commands ? new Map(Object.entries(
        agentData.commands.reduce ? 
          agentData.commands.reduce((acc, cmd) => {
            const entries = Object.entries(cmd);
            for (const [key, value] of entries) {
              // Convert complex values to JSON strings
              acc[key] = typeof value === 'object' ? JSON.stringify(value) : value;
            }
            return acc;
          }, {}) : 
          agentData.commands
      )) : new Map([['help', 'Show available commands'], ['exit', 'Exit agent mode']]),
      dependencies: {
        tasks: agentData.dependencies?.tasks || [],
        templates: agentData.dependencies?.templates || [],
        checklists: agentData.dependencies?.checklists || [],
        data: agentData.dependencies?.data || []
      },
      activationInstructions: agentData['activation-instructions'] || agentData.activationInstructions || [],
      isActive: true,
      isSystemAgent: true,
      category,
      rawContent: content
    };
  } catch (error) {
    console.error(`Error parsing ${agentId}.md:`, error.message);
    return null;
  }
};

// Main migration function
const migrateAgents = async () => {
  try {
    await connectToDatabase();

    const agentsDir = path.join(process.cwd(), '.bmad-core', 'agents');
    console.log(`Looking for agents in: ${agentsDir}`);

    // Check if agents directory exists
    try {
      await fs.access(agentsDir);
    } catch {
      console.error('Agents directory not found. Make sure .bmad-core/agents exists.');
      return;
    }

    // Read all agent files
    const files = await fs.readdir(agentsDir);
    const agentFiles = files.filter(file => file.endsWith('.md'));
    
    console.log(`Found ${agentFiles.length} agent files to migrate`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const file of agentFiles) {
      const agentId = file.replace('.md', '');
      const filePath = path.join(agentsDir, file);

      console.log(`Processing ${agentId}...`);

      // Check if agent already exists in database
      const existingAgent = await Agent.findOne({ agentId });
      if (existingAgent) {
        console.log(`  ⏭️  Skipped (already exists)`);
        skipCount++;
        continue;
      }

      // Parse agent file
      const agentData = await parseAgentFile(filePath, agentId);
      if (!agentData) {
        errorCount++;
        continue;
      }

      // Save to database
      try {
        const agent = new Agent(agentData);
        await agent.save();
        console.log(`  ✅ Migrated successfully`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to save: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped (already exists): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📁 Total files processed: ${agentFiles.length}`);

    // List migrated agents
    if (successCount > 0) {
      console.log('\n🎉 Migrated agents:');
      const agents = await Agent.find({ isSystemAgent: true }).sort({ category: 1, name: 1 });
      agents.forEach(agent => {
        console.log(`  - ${agent.agentId} (${agent.name}) - ${agent.category}`);
      });
    }

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

// Run migration if called directly
if (require.main === module) {
  console.log('🚀 Starting agent migration to database...\n');
  migrateAgents().catch(console.error);
}

module.exports = { migrateAgents };