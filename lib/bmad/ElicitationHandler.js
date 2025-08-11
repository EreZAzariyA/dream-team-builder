/**
 * BMAD Dynamic Elicitation Handler
 * 
 * Supports both 1-9 numbered selection AND natural text responses.
 * Mode is determined by the elicitation context and step requirements.
 * 
 * Key Features:
 * - DYNAMIC: 1-9 numbered options when step requires method selection
 * - DYNAMIC: Free text input when step allows natural responses
 * - Automatically detects which mode to use based on elicitation details
 * - Processes both formats seamlessly
 */

const fs = require('fs').promises;
const path = require('path');
const { validateFilePath } = require('../utils/fileValidator');
import logger from '../utils/logger.js';

class ElicitationHandler {
  constructor(configurationManager) {
    this.configManager = configurationManager;
    this.elicitationMethods = null;
  }

  /**
   * Load the elicitation methods from the data directory.
   */
  async loadMethods() {
    if (this.elicitationMethods) {
      return;
    }

    if (!this.configManager) {
      logger.warn('🗣️ [ELICIT] ConfigurationManager not available, using fallback elicitation methods');
      this.elicitationMethods = this.getFallbackMethods();
      return;
    }

    const dataPath = this.configManager.getBmadCorePaths().data;
    const methodsPath = path.join(dataPath, 'elicitation-methods.md');
    logger.info(`🗣️ [ELICIT] Loading elicitation methods from: ${methodsPath}`);

    try {
      validateFilePath(methodsPath);
      const content = await fs.readFile(methodsPath, 'utf8');
      
      // Parse markdown file to extract elicitation methods
      const methods = [];
      const lines = content.split('\n');
      let currentMethod = null;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Look for method headers (bold text like **Method Name**)
        if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
          if (currentMethod) {
            methods.push(currentMethod);
          }
          const title = trimmed.substring(2, trimmed.length - 2);
          currentMethod = {
            id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            title: title,
            description: ''
          };
        }
        // Collect description lines starting with -
        else if (currentMethod && trimmed.startsWith('- ')) {
          if (currentMethod.description) {
            currentMethod.description += ' ';
          }
          currentMethod.description += trimmed.substring(2);
        }
      }
      
      // Don't forget the last method
      if (currentMethod) {
        methods.push(currentMethod);
      }

      this.elicitationMethods = methods;
      logger.info(`✅ [ELICIT] Successfully loaded ${methods.length} elicitation methods.`);

    } catch (error) {
      logger.error(`❌ [ELICIT] Failed to load elicitation methods:`, error.message);
      // Fallback to default methods if loading fails
      this.elicitationMethods = [
        { id: 'proceed', title: 'Proceed', description: 'Continue with the current instruction.' },
        { id: 'clarify', title: 'Clarify', description: 'Ask clarifying questions.' },
      ];
    }
  }

  /**
   * Get fallback elicitation methods when ConfigurationManager is not available
   * @returns {Array} Default elicitation methods
   */
  getFallbackMethods() {
    return [
      { 
        id: 'clarify', 
        title: 'Clarify Requirements', 
        description: 'Ask for more details or clarification on the current task' 
      },
      { 
        id: 'alternative', 
        title: 'Suggest Alternative', 
        description: 'Propose an alternative approach or solution' 
      },
      { 
        id: 'breakdown', 
        title: 'Break Down Task', 
        description: 'Divide the current task into smaller, more manageable steps' 
      },
      { 
        id: 'validate', 
        title: 'Validate Approach', 
        description: 'Confirm the current approach meets requirements' 
      },
      { 
        id: 'research', 
        title: 'Research Options', 
        description: 'Investigate different options or technologies' 
      },
      { 
        id: 'dependencies', 
        title: 'Check Dependencies', 
        description: 'Verify all required dependencies are met' 
      },
      { 
        id: 'optimize', 
        title: 'Optimize Solution', 
        description: 'Look for ways to improve or optimize the current solution' 
      },
      { 
        id: 'review', 
        title: 'Review Progress', 
        description: 'Review current progress and next steps' 
      }
    ];
  }

  /**
   * Determine if elicitation should use 1-9 method selection or free text
   * @param {Object} elicitationDetails - Details from the TemplateProcessor
   * @returns {boolean} True if should use 1-9 method selection
   */
  shouldUseMethodSelection(elicitationDetails) {
    // DYNAMIC MODE DETECTION LOGIC:
    
    // 1. Check if explicitly set in elicitation details
    if (elicitationDetails.requiresMethodSelection === true) return true;
    if (elicitationDetails.requiresMethodSelection === false) return false;
    
    // 2. Check if it's a create-doc task with elicit: true (REQUIRES 1-9)
    if (elicitationDetails.command === 'create-doc' || 
        (elicitationDetails.sectionId && elicitationDetails.instruction && 
         elicitationDetails.command && elicitationDetails.command.includes('create'))) {
      // create-doc tasks with elicit: true sections MUST use 1-9 method selection
      return true;
    }
    
    // 3. Check agent command type for templates that require 1-9
    if (elicitationDetails.command && 
        (elicitationDetails.command.includes('-tmpl') || 
         elicitationDetails.command.includes('elicitation'))) {
      // Template-based elicitation with -tmpl suffix uses 1-9 method selection
      return true;
    }
    
    // 4. Check if it's a simple template elicitation (document-project.md uses free text)
    if (elicitationDetails.type === 'template_elicitation' && 
        elicitationDetails.command && 
        (elicitationDetails.command.includes('document-project') || 
         elicitationDetails.command.includes('.md'))) {
      return false; // Simple .md template tasks use free text
    }
    
    // 5. Check for specific patterns that indicate 1-9 requirement
    if (elicitationDetails.instruction && 
        elicitationDetails.instruction.toLowerCase().includes('select 1-9')) {
      return true;
    }
    
    // 6. Default fallback based on context
    // If it has structured sections with IDs, likely needs 1-9
    if (elicitationDetails.sectionId && elicitationDetails.agentId) {
      return true;
    }
    
    // 7. Final fallback: use free text for simple questions
    return false;
  }

  /**
   * Prepare an elicitation request for the user.
   * @param {Object} elicitationDetails - Details from the TemplateProcessor.
   * @returns {Object} A formatted object for the UI/user to process.
   */
  async prepareElicitationRequest(elicitationDetails) {
    await this.loadMethods();

    // DYNAMIC MODE DETECTION:
    // Check if this elicitation requires 1-9 method selection
    const requiresMethodSelection = this.shouldUseMethodSelection(elicitationDetails);
    
    if (requiresMethodSelection) {
      // MODE: 1-9 Numbered Selection
      const options = [
        { number: 1, text: 'Proceed as instructed', value: 'proceed' },
      ];

      // Add methods from the loaded configuration, up to 9 total options
      this.elicitationMethods.slice(0, 8).forEach((method, index) => {
        options.push({ number: index + 2, text: `${method.title}: ${method.description}`, value: method.id });
      });

      return {
        type: 'method_selection_elicitation',
        title: `Elicitation for: ${elicitationDetails.sectionTitle}`,
        instruction: elicitationDetails.instruction,
        options: options,
        requiresNumberedSelection: true,
        acceptsFreeText: true // Still allow free text as fallback
      };
    } else {
      // MODE: Free Text Input
      return {
        type: 'natural_text_elicitation',
        title: `Question from ${elicitationDetails.agentName || 'Agent'}`,
        instruction: elicitationDetails.instruction || elicitationDetails.sectionTitle,
        expectsTextResponse: true,
        requiresNumberedSelection: false,
        acceptsFreeText: true
      };
    }
  }

  /**
   * Process the user's response to an elicitation request.
   * @param {number|string|object} elicitationResponse - User response (1-9 number OR natural text).
   * @param {Object} elicitationContext - Context to determine processing mode.
   * @returns {string|Object} The processed response.
   */
  async processResponse(elicitationResponse, elicitationContext = {}) {
    await this.loadMethods();
    
    // DYNAMIC PROCESSING: Handle both 1-9 selection and free text
    
    // First, try to extract the actual response content
    let responseContent;
    let isNumberSelection = false;
    
    if (typeof elicitationResponse === 'number') {
      responseContent = elicitationResponse;
      isNumberSelection = true;
    } else if (typeof elicitationResponse === 'string') {
      responseContent = elicitationResponse.trim();
      // Check if it's a number (1-9)
      const parsed = parseInt(responseContent);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 9 && responseContent === String(parsed)) {
        responseContent = parsed;
        isNumberSelection = true;
      }
    } else if (typeof elicitationResponse === 'object' && elicitationResponse !== null) {
      // Handle object format {selection: number, text: string, etc.}
      if (elicitationResponse.selection !== undefined) {
        const parsed = parseInt(elicitationResponse.selection);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 9) {
          responseContent = parsed;
          isNumberSelection = true;
        }
      } else if (elicitationResponse.text !== undefined) {
        responseContent = elicitationResponse.text.trim();
        // Check if text is a number
        const parsed = parseInt(responseContent);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 9 && responseContent === String(parsed)) {
          responseContent = parsed;
          isNumberSelection = true;
        }
      } else {
        responseContent = JSON.stringify(elicitationResponse);
      }
    } else {
      responseContent = String(elicitationResponse);
    }
    
    // DYNAMIC PROCESSING based on response type
    if (isNumberSelection) {
      // MODE: Process as 1-9 method selection
      const selection = responseContent;
      
      if (selection === 1) {
        return { mode: 'method_selection', method: 'proceed', response: 'proceed' };
      }

      const selectedMethod = this.elicitationMethods[selection - 2];
      if (!selectedMethod) {
        throw new Error(`Invalid elicitation selection: No method available for option ${selection}`);
      }

      return { 
        mode: 'method_selection', 
        method: selectedMethod.id, 
        methodTitle: selectedMethod.title,
        response: `Selected method: ${selectedMethod.title}`
      };
    } else {
      // MODE: Process as free text
      return { 
        mode: 'free_text', 
        method: 'user_input', 
        response: responseContent 
      };
    }
  }
}

module.exports = { ElicitationHandler };
