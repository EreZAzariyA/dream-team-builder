import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml'; // Assuming js-yaml is available or will be installed
import logger from '../utils/logger.js';

export class ElicitationEngine {
  constructor() {
    this.questionsFilePath = path.join(process.cwd(), '.bmad-core', 'data', 'doc_questions.yaml');
  }

  /**
   * Loads questions for a specific document type from the doc_questions.yaml file.
   * @param {string} docType - The type of document (e.g., 'existing_documentation_or_analysis').
   * @returns {Promise<Array<Object>>} An array of question objects.
   */
  async loadQuestionsForDoc(docType) {
    try {
      const fileContent = await fs.readFile(this.questionsFilePath, 'utf8');
      const allQuestions = yaml.load(fileContent);
      if (!allQuestions || !allQuestions[docType]) {
        throw new Error(`No questions found for document type: ${docType}`);
      }
      return allQuestions[docType];
    } catch (error) {
      logger.error(`Failed to load questions for ${docType}: ${error.message}`);
      throw new Error(`Could not load questions: ${error.message}`);
    }
  }

  /**
   * Starts an interactive session to collect data for a document.
   * @param {string} docType - The type of document.
   * @param {function} onQuestion - Callback to handle asking the question and getting the answer.
   * @returns {Promise<Object>} An object containing the collected data.
   */
  async startInteractiveSession(docType, onQuestion) {
    const questions = await this.loadQuestionsForDoc(docType);
    const collectedData = {};

    for (const question of questions) {
      logger.info(`
Question: ${question.prompt}`);
      if (question.type === 'multiline') {
        logger.info('Please provide your answer. Type \"END\" on a new line to finish.');
      }

      let answer = await onQuestion(question.prompt, question.type, question.default);

      if (answer.toLowerCase() === 'skip') {
        logger.info(`Skipping question: ${question.key}`);
        collectedData[question.key] = null;
        continue;
      } else if (answer.toLowerCase() === 'cancel') {
        throw new Error('User cancelled the documentation process.');
      }

      collectedData[question.key] = answer;
    }
    return collectedData;
  }
}
