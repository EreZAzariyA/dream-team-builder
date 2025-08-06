/**
 * Standardized Workflow ID Utility
 * Provides consistent workflow ID handling across the BMAD system
 */

import { v4 as uuidv4 } from 'uuid';

export const WorkflowId = {
  /**
   * Generate a new standardized workflow ID
   * @returns {string} UUID v4 format
   */
  generate() {
    return uuidv4();
  },

  /**
   * Validate if a string is a valid workflow ID
   * @param {string} id - The ID to validate
   * @returns {boolean} True if valid UUID format
   */
  validate(id) {
    if (!id || typeof id !== 'string') return false;
    
    // UUID v4 regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    // Also accept MongoDB ObjectId format for backward compatibility
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    
    return uuidRegex.test(id) || objectIdRegex.test(id);
  },

  /**
   * Normalize workflow ID from different formats
   * Handles inconsistent ID fields across the system
   * @param {Object} workflow - Workflow object with potential ID fields
   * @returns {string|null} Normalized workflow ID
   */
  normalize(workflow) {
    if (!workflow || typeof workflow !== 'object') return null;
    
    // Priority order: id, workflowId, _id (MongoDB)
    const possibleIds = [
      workflow.id,
      workflow.workflowId,
      workflow._id?.toString?.() || workflow._id
    ];
    
    for (const id of possibleIds) {
      if (id && this.validate(id)) {
        return id.toString();
      }
    }
    
    return null;
  },

  /**
   * Extract workflow ID from various sources with validation
   * @param {string|Object} source - Source containing workflow ID
   * @returns {string|null} Valid workflow ID or null
   */
  extract(source) {
    if (typeof source === 'string') {
      return this.validate(source) ? source : null;
    }
    
    if (typeof source === 'object') {
      return this.normalize(source);
    }
    
    return null;
  },

  /**
   * Compare two workflow IDs for equality
   * @param {string|Object} id1 - First workflow ID or object
   * @param {string|Object} id2 - Second workflow ID or object
   * @returns {boolean} True if IDs match
   */
  equals(id1, id2) {
    const normalizedId1 = this.extract(id1);
    const normalizedId2 = this.extract(id2);
    
    if (!normalizedId1 || !normalizedId2) return false;
    
    return normalizedId1 === normalizedId2;
  },

  /**
   * Create a temporary workflow ID for fallback scenarios
   * @param {string} prefix - Optional prefix for the temporary ID
   * @returns {string} Temporary workflow ID
   */
  createTemporary(prefix = 'temp') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Check if an ID is a temporary ID
   * @param {string} id - ID to check
   * @returns {boolean} True if temporary ID format
   */
  isTemporary(id) {
    if (!id || typeof id !== 'string') return false;
    return id.includes('-') && (id.startsWith('temp-') || /^\w+-\d+-\w+$/.test(id));
  },

  /**
   * Validate if a string is a valid template identifier
   * @param {string} templateId - Template ID to validate
   * @returns {boolean} True if valid template format
   */
  isValidTemplate(templateId) {
    if (!templateId || typeof templateId !== 'string') return false;
    
    // Template IDs are kebab-case strings, typically 3-50 characters
    const templateRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;
    
    return templateId.length >= 3 && 
           templateId.length <= 50 && 
           templateRegex.test(templateId) &&
           !templateId.startsWith('-') &&
           !templateId.endsWith('-') &&
           !templateId.includes('--'); // No double dashes
  },

  /**
   * Validate if a string could be either a workflow ID or template ID
   * @param {string} id - ID to validate
   * @param {boolean} allowTemplates - Whether template IDs are valid
   * @returns {boolean} True if valid format
   */
  isValidIdentifier(id, allowTemplates = false) {
    if (!id || typeof id !== 'string') return false;
    
    // Check if it's a standard workflow ID (UUID or ObjectId)
    if (this.validate(id)) return true;
    
    // Check if it's a template ID and templates are allowed
    if (allowTemplates && this.isValidTemplate(id)) return true;
    
    return false;
  },

  /**
   * Generate workflow channel name for Pusher
   * @param {string|Object} workflowId - Workflow ID or object
   * @returns {string} Channel name for Pusher
   */
  toChannelName(workflowId) {
    const id = this.extract(workflowId);
    return id ? `workflow-${id}` : null;
  },

  /**
   * Parse channel name back to workflow ID
   * @param {string} channelName - Pusher channel name
   * @returns {string|null} Workflow ID or null
   */
  fromChannelName(channelName) {
    if (!channelName || typeof channelName !== 'string') return null;
    
    const match = channelName.match(/^workflow-(.+)$/);
    if (match && this.validate(match[1])) {
      return match[1];
    }
    
    return null;
  }
};

/**
 * Legacy support - export individual functions for backward compatibility
 */
export const generateWorkflowId = WorkflowId.generate;
export const validateWorkflowId = WorkflowId.validate;
export const normalizeWorkflowId = WorkflowId.normalize;
export const compareWorkflowIds = WorkflowId.equals;

export default WorkflowId;