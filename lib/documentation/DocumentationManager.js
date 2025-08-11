import { promises as fs } from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export class DocumentationManager {
  constructor() {
    this.essentialDocs = [
      'existing_documentation_or_analysis.md',
      'all_artifacts_in_project.md',
      'sharded_docs_or_brownfield_docs.md',
    ];
    this.docTemplatesPath = path.join(process.cwd(), '.bmad-core', 'templates', 'doc_filler');
  }

  /**
   * Checks for missing essential documentation files in the project's docs folder.
   * @param {string} projectRoot - The absolute path to the project root.
   * @returns {Promise<string[]>} An array of missing file names.
   */
  async checkMissingDocs(projectRoot) {
    const docsFolder = path.join(projectRoot, 'docs');
    const missing = [];

    for (const docName of this.essentialDocs) {
      const docPath = path.join(docsFolder, docName);
      try {
        await fs.access(docPath);
        logger.info(`Found existing document: ${docName}`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          missing.push(docName);
          logger.warn(`Missing essential document: ${docName}`);
        } else {
          logger.error(`Error checking document ${docName}: ${error.message}`);
        }
      }
    }
    return missing;
  }

  /**
   * Loads a predefined Markdown template for a given document file name.
   * @param {string} templateFileName - The name of the template file (e.g., 'existing_documentation_or_analysis_tmpl.md').
   * @returns {Promise<string>} The content of the template.
   */
  async getDocTemplate(templateFileName) {
    const templatePath = path.join(this.docTemplatesPath, templateFileName);
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      return content;
    } catch (error) {
      logger.error(`Failed to load template ${templateFileName}: ${error.message}`);
      throw new Error(`Template not found or unreadable: ${templateFileName}`);
    }
  }

  /**
   * Saves content to a specified file path.
   * @param {string} filePath - The absolute path where the file should be saved.
   * @param {string} content - The content to write to the file.
   * @returns {Promise<void>}
   */
  async saveDocument(filePath, content) {
    const dir = path.dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
      logger.info(`Document saved: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save document ${filePath}: ${error.message}`);
      throw new Error(`Could not save document: ${filePath}`);
    }
  }

  /**
   * Updates an existing document. Currently appends content.
   * @param {string} filePath - The absolute path to the file to update.
   * @param {string} newContent - The content to append.
   * @param {'append' | 'replace_placeholders'} mergeStrategy - Strategy for merging content.
   * @returns {Promise<void>}
   */
  async updateDocument(filePath, newContent, mergeStrategy = 'append') {
    if (mergeStrategy === 'append') {
      try {
        await fs.appendFile(filePath, '\n' + newContent, 'utf8');
        logger.info(`Document updated (appended): ${filePath}`);
      } catch (error) {
        logger.error(`Failed to append to document ${filePath}: ${error.message}`);
        throw new Error(`Could not update document: ${filePath}`);
      }
    } else {
      logger.warn(`Merge strategy '${mergeStrategy}' not yet implemented for updateDocument.`);
      throw new Error(`Unsupported merge strategy: ${mergeStrategy}`);
    }
  }
}
