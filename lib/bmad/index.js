/**
 * BMAD (Business Methodology for Autonomous Development) - Main Export
 * 
 * This module provides the main exports for the BMAD orchestration system.
 */

import { BmadOrchestrator } from './BmadOrchestrator.js';
import WorkflowManagerV2 from './WorkflowManagerV2.js';

export {
  BmadOrchestrator,
  WorkflowManagerV2 as WorkflowManager // Export V2 as the main WorkflowManager
};