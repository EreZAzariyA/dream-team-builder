import s3Service from '../../storage/S3Service.js';
import fs from 'fs';
import path from 'path';
import logger from '../../utils/logger.js';

/**
 * BMAD File Manager
 * Handles file operations for BMAD agents with S3 cloud storage support
 * Falls back to local storage in development
 */
class FileManager {
  constructor() {
    this.useS3 = process.env.NODE_ENV === 'production' || process.env.FORCE_S3 === 'true';
    this.localBasePath = './bmad-files'; // Local fallback path
  }

  /**
   * Initialize file manager
   */
  async initialize() {
    if (this.useS3) {
      const isAvailable = await s3Service.isAvailable();
      if (!isAvailable) {
        console.warn('⚠️ S3 not available, falling back to local storage');
        this.useS3 = false;
      } else {
        console.log('✅ Using S3 for BMAD file storage');
      }
    } else {
      console.log('✅ Using local storage for BMAD files (development)');
      // Ensure local directory exists
      if (!fs.existsSync(this.localBasePath)) {
        fs.mkdirSync(this.localBasePath, { recursive: true });
      }
    }
  }

  /**
   * Write agent-generated file
   * @param {object} context - File context
   * @param {string} content - File content
   * @returns {Promise<object>} File info
   */
  async writeAgentFile(context, content) {
    const {
      userId,
      agentId,
      filename,
      chatContext = null, // For agent-chat
      workflowContext = null // For agent-teams
    } = context;

    try {
      if (this.useS3) {
        return await this._writeToS3(context, content);
      } else {
        return await this._writeToLocal(context, content);
      }
    } catch (error) {
      console.error('❌ Failed to write agent file:', error);
      throw error;
    }
  }

  /**
   * Read agent-generated file
   * @param {object} context - File context
   * @returns {Promise<string>} File content
   */
  async readAgentFile(context) {
    try {
      if (this.useS3) {
        return await this._readFromS3(context);
      } else {
        return await this._readFromLocal(context);
      }
    } catch (error) {
      console.error('❌ Failed to read agent file:', error);
      throw error;
    }
  }

  /**
   * List agent files
   * @param {object} context - Directory context
   * @returns {Promise<Array>} List of files
   */
  async listAgentFiles(context) {
    try {
      if (this.useS3) {
        return await this._listFromS3(context);
      } else {
        return await this._listFromLocal(context);
      }
    } catch (error) {
      console.error('❌ Failed to list agent files:', error);
      throw error;
    }
  }

  /**
   * Delete agent file
   * @param {object} context - File context
   * @returns {Promise<boolean>} Success status
   */
  async deleteAgentFile(context) {
    try {
      if (this.useS3) {
        return await this._deleteFromS3(context);
      } else {
        return await this._deleteFromLocal(context);
      }
    } catch (error) {
      console.error('❌ Failed to delete agent file:', error);
      throw error;
    }
  }

  /**
   * Generate file path/key based on context
   */
  _generatePath(context) {
    const { userId, agentId, filename, chatContext, workflowContext } = context;

    if (chatContext) {
      // Agent Chat: user123/agents-chat/pm/filename.md
      return {
        type: 'agents-chat',
        s3Key: s3Service.generateKey(userId, 'agents-chat', agentId, filename),
        localPath: path.join(this.localBasePath, userId, 'agents-chat', agentId, filename)
      };
    } else if (workflowContext) {
      // Agent Teams: user123/agent-teams/{team}/{workflowId}/pm/filename.md
      const { team, workflowId } = workflowContext;
      return {
        type: 'agent-teams',
        s3Key: s3Service.generateKey(userId, 'agent-teams', agentId, filename, team, workflowId),
        localPath: path.join(this.localBasePath, userId, 'agent-teams', team, workflowId, agentId, filename)
      };
    } else {
      throw new Error('Either chatContext or workflowContext must be provided');
    }
  }

  // S3 Implementation
  async _writeToS3(context, content) {
    const { s3Key } = this._generatePath(context);
    const result = await s3Service.writeFile(s3Key, content);
    
    return {
      success: true,
      path: s3Key,
      url: result.url,
      storage: 's3'
    };
  }

  async _readFromS3(context) {
    const { s3Key } = this._generatePath(context);
    return await s3Service.readFile(s3Key);
  }

  async _listFromS3(context) {
    const { s3Key } = this._generatePath({ ...context, filename: '' });
    const prefix = s3Key.replace(/\/$/, ''); // Remove trailing slash
    return await s3Service.listFiles(prefix);
  }

  async _deleteFromS3(context) {
    const { s3Key } = this._generatePath(context);
    await s3Service.deleteFile(s3Key);
    return true;
  }

  // Local Implementation (Development fallback)
  async _writeToLocal(context, content) {
    const { localPath } = this._generatePath(context);
    
    // Ensure directory exists
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(localPath, content, 'utf8');
    
    return {
      success: true,
      path: localPath,
      url: null, // No URL for local files
      storage: 'local'
    };
  }

  async _readFromLocal(context) {
    const { localPath } = this._generatePath(context);
    return fs.readFileSync(localPath, 'utf8');
  }

  async _listFromLocal(context) {
    const { localPath } = this._generatePath({ ...context, filename: '' });
    const dir = path.dirname(localPath);
    
    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir);
    return files.map(file => ({
      key: path.join(dir, file),
      name: file,
      storage: 'local'
    }));
  }

  async _deleteFromLocal(context) {
    const { localPath } = this._generatePath(context);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    return true;
  }

  /**
   * Determine if the agent result should be saved as a file
   */
  shouldSaveAsFile(result, template, context) {
    // Save if result has substantial content (indicating document generation)
    if (result.content && result.content.length > 500) {
      return true;
    }
    
    // Save if template indicates file output
    if (template && template.output && template.output.filename) {
      return true;
    }
    
    // Save if context suggests file creation
    if (context && (context.creates || context.command)) {
      const commands = ['create-project-brief', 'create-prd', 'doc-out', 'create-architecture', 'perform-market-research'];
      if (commands.some(cmd => context.command === cmd || context.userPrompt?.includes(cmd))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Save agent-generated content as a file using FileManager
   */
  async saveAgentFile(result, agent, template, context) {
    try {
      // Initialize FileManager if not already done
      if (!this.initialized) {
        await this.initialize();
        this.initialized = true;
      }

      // Determine filename
      let filename = 'document.md'; // Default
      if (template && template.output && template.output.filename) {
        filename = template.output.filename;
      } else if (context.creates) {
        filename = context.creates;
      }
      
      // Ensure .md extension
      if (!filename.endsWith('.md')) {
        filename += '.md';
      }

      // Prepare file context for FileManager
      const fileContext = {
        userId: context.userId,
        agentId: agent.id,
        filename: filename,
        chatContext: context.chatMode ? { chatId: context.conversationId } : null,
        workflowContext: !context.chatMode ? { workflowId: context.workflowId } : null
      };

      // Extract content (handle JSON format if needed)
      let content = result.content;
      if (content.startsWith('```json') && content.includes('main_response')) {
        try {
          const jsonMatch = content.match(/```json\n(.*?)\n```/s);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            content = parsed.main_response || content;
          }
        } catch (e) {
          // Keep original content if JSON parsing fails
        }
      }

      // Save file using FileManager
      const fileInfo = await this.writeAgentFile(fileContext, content);
      
      logger.info(`✅ [FILE SAVED] Agent ${agent.id} file saved: ${fileInfo.url || fileInfo.path}`);
      return fileInfo.url || fileInfo.path;
      
    } catch (error) {
      logger.error(`❌ [FILE SAVE ERROR] Failed to save agent file: ${error.message}`);
      return null;
    }
  }

  /**
   * Helper methods for BMAD contexts
   */
  static contexts = {
    /**
     * Create context for agent chat
     */
    agentChat: (userId, agentId, filename, chatSessionId = null) => ({
      userId,
      agentId,
      filename,
      chatContext: { chatSessionId }
    }),

    /**
     * Create context for agent team workflow
     */
    agentTeam: (userId, agentId, filename, team, workflowId) => ({
      userId,
      agentId,
      filename,
      workflowContext: { team, workflowId }
    })
  };
}

// Create singleton instance
const fileManager = new FileManager();

export { FileManager, fileManager };
export default fileManager;