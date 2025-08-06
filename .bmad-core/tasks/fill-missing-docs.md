import { DocumentationManager } from '../../lib/documentation/DocumentationManager.js';
import { ElicitationEngine } from '../../lib/elicitation/ElicitationEngine.js';
import { MarkdownGenerator } from '../../lib/documentation/MarkdownGenerator.js';
import logger from '../../lib/utils/logger.js';

/**
 * Task to detect and fill missing essential documentation files.
 * @param {object} context - The execution context, including projectRoot.
 * @param {function} elicitCallback - Callback function for interactive elicitation (UI/CLI specific).
 */
async function execute(context, elicitCallback) {
  const projectRoot = context.projectRoot || process.cwd(); // Default to current working directory
  const docManager = new DocumentationManager();
  const elicitationEngine = new ElicitationEngine();
  const markdownGenerator = new MarkdownGenerator();

  logger.info('🔍 Checking for missing essential documentation files...');
  const missingDocs = await docManager.checkMissingDocs(projectRoot);

  if (missingDocs.length === 0) {
    logger.info('✅ All essential documentation files are present.');
    return { status: 'success', message: 'No missing documentation.' };
  }

  logger.warn(`⚠️ Found missing documentation files: ${missingDocs.join(', ')}`);

  for (const docFileName of missingDocs) {
    const docType = docFileName.replace('.md', ''); // e.g., 'existing_documentation_or_analysis'
    logger.info(`
📝 Starting interactive session to collect content for: ${docFileName}`);

    try {
      const collectedData = await elicitationEngine.startInteractiveSession(
        docType,
        async (prompt, type, defaultValue) => {
          // This is where the actual UI/CLI interaction happens.
          // For CLI, you would use readline or a similar module here.
          // For UI, this would be a callback to send the question to the frontend
          // and await the user's response.
          logger.info(`
${prompt}`);
          if (type === 'multiline') {
            logger.info("Please provide your answer. Type 'END' on a new line to finish.");
          }
          // In a real CLI, you'd read from stdin. For this simulation, I'll ask you.
          const answer = await elicitCallback(prompt, type, defaultValue);
          return answer;
        }
      );

      // Generate Markdown content
      const markdownContent = await markdownGenerator.generateMarkdown(docType, collectedData);

      // Save the document (assuming 'docs' subfolder in project root)
      const filePath = path.join(projectRoot, 'docs', docFileName);
      await docManager.saveDocument(filePath, markdownContent);
      logger.info(`✅ Successfully generated and saved: ${filePath}`);

    } catch (error) {
      logger.error(`❌ Failed to process ${docFileName}: ${error.message}`);
      // If user cancelled or other critical error, stop processing further docs
      return { status: 'partial_failure', message: `Failed to complete documentation for ${docFileName}. Error: ${error.message}` };
    }
  }

  logger.info('🎉 All identified missing documentation files have been processed.');
  return { status: 'success', message: 'Missing documentation filled.' };
}

export { execute };
