/**
 * BMAD Checklist Validation System
 * 
 * A key component of Phase 3, this system allows agents to execute and validate
 * checklists, ensuring process adherence and quality control.
 * 
 * Key Features:
 * - Loads checklist definitions from markdown files.
 * - Parses checklists into a structured, executable format.
 * - (Future) Supports interactive checklist execution.
 * - Integrates with the WorkflowEngine to be available to all agents.
 */

const fs = require('fs').promises;
const path = require('path');
const { validateFilePath } = require('../utils/fileValidator');
import logger from '../utils/logger.js';

class ChecklistManager {
  constructor(configurationManager) {
    this.configManager = configurationManager;
  }

  /**
   * Execute a checklist.
   * @param {string} checklistName - The name of the checklist (e.g., 'story-dod-checklist').
   * @returns {Object} An object representing the parsed checklist.
   */
  async executeChecklist(checklistName) {
    logger.info(`[CHECKLIST] Executing checklist: ${checklistName}`);
    const checklistsPath = this.configManager.getBmadCorePaths().checklists;
    const checklistPath = path.join(checklistsPath, `${checklistName}.md`);

    try {
      validateFilePath(checklistPath);
      const content = await fs.readFile(checklistPath, 'utf8');
      const parsedChecklist = this.parseChecklist(content);

      logger.info(`✅ [CHECKLIST] Successfully parsed checklist: ${checklistName}`);
      return { name: checklistName, items: parsedChecklist };

    } catch (error) {
      logger.error(`❌ [CHECKLIST] Failed to execute checklist ${checklistName}:`, error.message);
      throw new Error(`Failed to execute checklist ${checklistName}: ${error.message}`);
    }
  }

  /**
   * Parse the markdown content of a checklist file.
   * @param {string} checklistContent - The full markdown content.
   * @returns {Array<Object>} An array of checklist item objects.
   */
  parseChecklist(checklistContent) {
    const items = [];
    const lines = checklistContent.split('\n');

    for (const line of lines) {
      if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
        items.push({
          text: line.substring(5).trim(),
          checked: line.startsWith('- [x]'),
        });
      }
    }

    return items;
  }
}

module.exports = { ChecklistManager };
