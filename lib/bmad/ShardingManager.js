/**
 * BMAD Document Sharding Engine
 * 
 * A critical component of Phase 3, this engine breaks down large markdown documents
 * into smaller, manageable, and linked files, optimized for IDE-based agent workflows.
 * 
 * Key Features:
 * - Splits markdown by heading levels (H2, H3, etc.).
 * - Creates an `index.md` file to maintain the document structure.
 * - Uses core-config.yaml for output locations.
 * - Integrates with the ArtifactManager for a seamless workflow.
 */

const fs = require('fs').promises;
const path = require('path');
const { ensureDirectoryExists } = require('../utils/fileValidator');
import logger from '../utils/logger.js';

class ShardingManager {
  constructor(configurationManager) {
    this.configManager = configurationManager;
  }

  /**
   * Shard a markdown document into smaller files.
   * @param {string} documentContent - The full markdown content of the document.
   * @param {string} documentType - The type of document ('prd' or 'architecture').
   * @returns {Object} An object containing the paths to the sharded files.
   */
  async shardDocument(documentContent, documentType) {
    const shardingConfig = this.getShardingConfig(documentType);
    if (!shardingConfig.sharded) {
      logger.info(`[SHARDING] Sharding is disabled for document type: ${documentType}`);
      return null;
    }

    logger.info(`[SHARDING] Starting to shard document type: ${documentType}`);
    await ensureDirectoryExists(shardingConfig.location);

    const sections = this.parseSections(documentContent);
    const shardedFiles = [];

    for (const section of sections) {
      const fileName = this.generateFileName(section.title);
      const filePath = path.join(shardingConfig.location, fileName);
      await fs.writeFile(filePath, section.content, 'utf8');
      shardedFiles.push({ title: section.title, path: fileName });
    }

    await this.createIndexFile(shardingConfig.location, shardedFiles);

    logger.info(`✅ [SHARDING] Successfully sharded ${sections.length} sections for ${documentType}.`);
    return { shardedFiles, indexPath: path.join(shardingConfig.location, 'index.md') };
  }

  /**
   * Get the sharding configuration for a given document type.
   * @param {string} documentType - The type of document.
   * @returns {Object} The sharding configuration.
   */
  getShardingConfig(documentType) {
    const config = this.configManager.get(documentType);
    return {
      sharded: config.sharded,
      location: this.configManager.getAbsolutePath(config.shardedLocation),
    };
  }

  /**
   * Parse the markdown content into sections based on H2 headings.
   * @param {string} documentContent - The full markdown content.
   * @returns {Array<Object>} An array of section objects.
   */
  parseSections(documentContent) {
    const sections = [];
    const lines = documentContent.split('\n');
    let currentSection = null;

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.substring(3).trim(),
          content: line + '\n',
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Generate a safe filename from a section title.
   * @param {string} title - The title of the section.
   * @returns {string} A safe filename.
   */
  generateFileName(title) {
    return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  }

  /**
   * Create the index.md file that links to all sharded files.
   * @param {string} location - The directory where the sharded files are saved.
   * @param {Array<Object>} shardedFiles - An array of the sharded file details.
   */
  async createIndexFile(location, shardedFiles) {
    let indexContent = '# Document Index\n\n';
    for (const file of shardedFiles) {
      indexContent += `- [${file.title}](./${file.path})\n`;
    }

    const indexPath = path.join(location, 'index.md');
    await fs.writeFile(indexPath, indexContent, 'utf8');
  }
}

module.exports = { ShardingManager };
