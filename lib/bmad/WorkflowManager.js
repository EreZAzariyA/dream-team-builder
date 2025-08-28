/**
 * WORKFLOW MANAGER
 * 
 * Simple, direct workflow management - no abstraction layers, no delegation chains
 * Handles ALL workflow operations in one clean interface
 */

import { WorkflowStatus } from './types.js';
import WorkflowParser from './WorkflowParser.js';
import { AgentLoader } from './AgentLoader.js';
import { CheckpointManager } from './engine/CheckpointManager.js';
import InteractiveMessaging from './InteractiveMessaging.js';
import { EVENTS } from '../pusher/config.js';
import logger from '../utils/logger.js';
import Workflow from '../database/models/Workflow.js';

class WorkflowManager {
  constructor(options = {}) {
    this.workflowParser = new WorkflowParser();
    this.agentLoader = new AgentLoader();
    this.aiService = options.aiService;
    this.communicator = options.communicator;
    this.pusherService = options.pusherService;
    this.interactiveMessaging = new InteractiveMessaging(options.pusherService, this.communicator.messageService);
    // Initialize CheckpointManager with this as the workflow engine
    this.checkpointManager = new CheckpointManager(this);
  }

  async initialize() {
    // AgentLoader doesn't need initialization - agents are loaded on-demand
    logger.info('✅ WorkflowManager initialized');
  }

  /**
   * Start a workflow - the main entry point
   */
  async startWorkflow(userPrompt, options = {}) {
    try {
      // Validate input
      if (!userPrompt || userPrompt.trim().length < 10) {
        throw new Error('User prompt must be at least 10 characters long');
      }

      const workflowTemplate = options.sequence || 'greenfield-fullstack';
      
      // Check if this is a dynamic workflow
      const isDynamicWorkflow = await this.workflowParser.workflowExists(workflowTemplate);
      
      if (!isDynamicWorkflow) {
        throw new Error(`Workflow template "${workflowTemplate}" not found`);
      }

      logger.info(`🚀 Starting workflow: ${workflowTemplate}`);
      
      // Parse and start the dynamic workflow
      const dynamicWorkflow = await this.workflowParser.parseWorkflowFile(workflowTemplate);
      await this.workflowParser.resolveReferences(dynamicWorkflow);

      // Validate workflow has steps
      if (!dynamicWorkflow.steps || !Array.isArray(dynamicWorkflow.steps) || dynamicWorkflow.steps.length === 0) {
        throw new Error(`Workflow ${workflowTemplate} has no executable steps`);
      }

      // Create workflow configuration
      const workflowId = options.workflowId || this.generateWorkflowId();
      const workflow = {
        id: workflowId,
        workflowId: workflowId,
        name: dynamicWorkflow.name || options.name || `${workflowTemplate} Workflow`,
        title: dynamicWorkflow.name || options.name || `${workflowTemplate} Workflow`,
        description: dynamicWorkflow.description || options.description || 'AI-powered workflow execution',
        template: workflowTemplate,
        prompt: userPrompt.trim(),
        userPrompt: userPrompt.trim(),
        userId: options.userId,
        status: WorkflowStatus.RUNNING,
        bmadWorkflowData: { sequence: dynamicWorkflow.steps, currentStep: 0 },
        
        currentAgent: null,
        startTime: new Date(),
        context: {
          initiatedBy: options.userId || 'system',
          priority: options.priority || 'normal',
          tags: options.tags || [workflowTemplate],
          artifacts: new Map(),
          routingDecisions: {},
          elicitationHistory: [],
          // Include GitHub context if provided
          ...(options.githubContext && {
            githubContext: options.githubContext,
            repositoryUrl: options.githubContext.repository?.html_url
          }),
          // Include repository analysis if provided
          ...(options.repositoryAnalysis && {
            repositoryAnalysis: options.repositoryAnalysis
          })
        },
        metadata: {
          priority: 'medium',
          tags: [workflowTemplate],
          category: 'workflow-template',
          workflowType: 'dynamic',
          yamlSource: workflowTemplate,
          originalYaml: dynamicWorkflow.originalYaml,
          // GitHub metadata
          ...(options.githubContext && {
            github: {
              owner: options.githubContext.repository.owner,
              name: options.githubContext.repository.name,
              repositoryUrl: options.githubContext.repository.html_url,
              targetBranch: options.githubContext.targetBranch || 'main'
            }
          })
        },
        artifacts: [],
        messages: [],
        errors: [],
        handoffPrompts: dynamicWorkflow.handoffPrompts || {},
        // Include repository analysis for agents
        ...(options.repositoryAnalysis && {
          repositoryAnalysis: options.repositoryAnalysis
        })
      };

      // Save to database
      await this.saveWorkflowToDatabase(workflow);
      
      // Create checkpoint
      await this.checkpointManager.create(workflowId, 'workflow_initialized', `Workflow ${workflowTemplate} started`);

      // Start execution asynchronously with proper context binding
      const executeAsync = async () => {
        try {
          logger.info(`🚀 Starting async execution for workflow: ${workflowId}`);
          workflow.status = WorkflowStatus.RUNNING;
          await this.saveWorkflowToDatabase(workflow);
          
          // Start the execution loop directly
          await this.executeWorkflow(workflowId);
        } catch (error) {
          logger.error(`❌ Error in workflow execution: ${error.message}`);
          workflow.status = WorkflowStatus.ERROR;
          workflow.errors.push({
            error: error.message,
            timestamp: new Date(),
            step: workflow.bmadWorkflowData.currentStep
          });
          await this.saveWorkflowToDatabase(workflow);
        }
      };
      
      setImmediate(() => executeAsync());

      // Send workflow started event
      if (this.pusherService) {
        try {
          // Import WorkflowId utility for channel naming
          const { WorkflowId } = await import('../utils/workflowId.js');
          const channelName = WorkflowId.toChannelName(workflowId);
          
          await this.pusherService.trigger(channelName, 'workflow-started', {
            workflowId: workflowId,
            template: workflowTemplate,
            status: WorkflowStatus.RUNNING
          });
        } catch (error) {
          logger.warn('Failed to send workflow started event:', error.message);
        }
      }

      return {
        workflowId: workflowId,
        status: WorkflowStatus.RUNNING,
        message: 'Workflow started successfully'
      };

    } catch (error) {
      logger.error(`❌ Failed to start workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId) {
    const workflow = await this.loadWorkflowFromDatabase(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    return workflow;
  }

  /**
   * Pause workflow
   */
  async pauseWorkflow(workflowId) {
    const workflow = await this.loadWorkflowFromDatabase(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    workflow.status = WorkflowStatus.PAUSED;
    workflow.pausedAt = new Date();
    await this.saveWorkflowToDatabase(workflow);
    
    logger.info(`⏸️ Workflow ${workflowId} paused`);
    return workflow;
  }

  /**
   * Resume workflow
   */
  async resumeWorkflow(workflowId) {
    const workflow = await this.loadWorkflowFromDatabase(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    workflow.status = WorkflowStatus.RUNNING;
    workflow.pausedAt = null;
    await this.saveWorkflowToDatabase(workflow);
    
    // Resume execution
    setImmediate(async () => {
      try {
        await this.executeWorkflow(workflowId);
      } catch (error) {
        logger.error(`❌ Error resuming workflow: ${error.message}`);
      }
    });
    
    logger.info(`▶️ Workflow ${workflowId} resumed`);
    return workflow;
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(workflowId) {
    const workflow = await this.loadWorkflowFromDatabase(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    workflow.status = WorkflowStatus.CANCELLED;
    workflow.completedAt = new Date();
    await this.saveWorkflowToDatabase(workflow);
    
    logger.info(`🛑 Workflow ${workflowId} cancelled`);
    return workflow;
  }

  /**
   * Complete workflow
   */
  async completeWorkflow(workflowId) {
    const workflow = await this.loadWorkflowFromDatabase(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    workflow.status = WorkflowStatus.COMPLETED;
    workflow.completedAt = new Date();
    workflow.endTime = new Date();
    await this.saveWorkflowToDatabase(workflow);
    
    logger.info(`✅ Workflow ${workflowId} completed`);
    return workflow;
  }

  /**
   * Execute workflow steps directly - no delegation layers
   */
  async executeWorkflow(workflowId) {
    let workflow = await this.loadWorkflowFromDatabase(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    logger.info(`🔄 Executing workflow: ${workflowId}, current step: ${workflow.bmadWorkflowData.currentStep}/${workflow.bmadWorkflowData.sequence?.length || 0}`);

    // Execute steps until workflow is complete or paused
    while (workflow.status === WorkflowStatus.RUNNING) {
      // Reload workflow from database to get latest state including context
      workflow = await this.loadWorkflowFromDatabase(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found during execution`);
      }

      // DEBUG: Check workflow state after reload
      
      // Check if workflow is complete
      if (workflow.bmadWorkflowData.currentStep >= workflow.bmadWorkflowData.sequence.length) {
        await this.completeWorkflow(workflowId);
        return;
      }

      // Get current step
      const step = workflow.bmadWorkflowData.sequence[workflow.bmadWorkflowData.currentStep];
      if (!step) {
        throw new Error(`Step ${workflow.currentStep} not found in workflow sequence`);
      }

      logger.info(`📋 Executing step ${workflow.bmadWorkflowData.currentStep + 1}/${workflow.bmadWorkflowData.sequence.length}: ${step.step || step.action || 'unnamed'}`);

      try {
        // DEBUG: Check workflow state before passing to executeStep

        // Execute the step (simplified logic)
        const result = await this.executeStep(workflowId, step, workflow);
        
        if (result === 'paused') {
          logger.info(`⏸️ Workflow ${workflowId} paused for user input`);
          break;
        }

        // Move to next step
        workflow.bmadWorkflowData.currentStep++;
        await this.saveWorkflowToDatabase(workflow);

      } catch (error) {
        logger.error(`❌ Step ${workflow.bmadWorkflowData.currentStep} failed: ${error.message}`);
        workflow.status = WorkflowStatus.ERROR;
        workflow.errors.push({
          error: error.message,
          timestamp: new Date(),
          step: workflow.bmadWorkflowData.currentStep
        });
        await this.saveWorkflowToDatabase(workflow);
        throw error;
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(workflowId, step, workflow) {

    // The `step` object is the item from the YAML sequence.
    // It can be { step: 'name', agent: '...', ... } or just { agent: '...', ... }

    if (step.condition && !this.evaluateCondition(step.condition, workflow)) {
      logger.info(`⏭️ Skipping step ${workflow.bmadWorkflowData.currentStep + 1} - condition not met`);
      return 'continue';
    }


    try {
      // Handle different step types with proper priority: agent > routing > action > condition > container
      if (step.agent) {
        const agentName = step.agent;
        logger.info(`🤖 [CLASSIFICATION] Executing as AGENT step: ${agentName}`);
        return await this.executeAgentStep(workflowId, step, workflow);
      } else if (step.routes) {
        // Routing decision steps - check before condition since routing steps often have conditions too
        logger.info(`🔀 [CLASSIFICATION] Executing as ROUTING step`);
        return await this.executeRoutingStep(workflowId, step, workflow);
      } else if (step.action && !step.agent) {
        // Action steps without agents (workflow control actions)
        logger.info(`⚡ [CLASSIFICATION] Executing as ACTION step: ${step.action}`);
        return await this.executeActionStep(workflowId, step, workflow);
      } else if (step.condition && !step.agent && !step.action) {
        // Pure routing/decision logic steps
        logger.info(`🤔 [CLASSIFICATION] Executing as CONDITION step: ${step.condition}`);
        return await this.executeDecisionStep(workflowId, step, workflow);
      } else if (step.step && !step.agent && !step.action && !step.condition) {
        // Named step containers without specific actions - treat as informational
        logger.info(`📋 [CLASSIFICATION] Named step container '${step.step}' - no action required`);
        return 'success';
      } else {
        // Unknown step format
        logger.warn(`⚠️ [CLASSIFICATION] Unknown step type or format for step ${workflow.bmadWorkflowData.currentStep + 1}. Keys: ${Object.keys(step)}. Moving to next step.`);
        return 'success';
      }
    } catch (error) {
      logger.error(`❌ Step execution failed: ${error.message}`);
      throw error;
    }
  }''

  /**
   * Execute an agent-based step with interactive user correspondence
   */
  async executeAgentStep(workflowId, step, workflow) {
    const agentName = step.agent;
    
    
    logger.info(`🤖 Executing agent: ${agentName} on user repository`);

    // Check if agent exists
    const agent = await this.agentLoader.loadAgent(agentName);
    if (!agent) {
      logger.error(`❌ [DEBUG] Step object causing error:`, step);
      throw new Error(`Agent ${agentName} not found`);
    }

    // Check if AI service is available
    if (!this.aiService) {
      throw new Error('AI Service not available - cannot execute agent steps');
    }

    // Agent activation message removed - users don't need to see system activation messages

    // Extract userId from Mongoose document - convert ObjectId to string
    const finalUserId = workflow.userId ? workflow.userId.toString() : 'system';
    

    // Build comprehensive context for AI agent execution
    const context = {
      // Workflow context
      workflowId: workflowId,
      step: workflow.bmadWorkflowData.currentStep,
      totalSteps: workflow.bmadWorkflowData.sequence.length,
      userPrompt: workflow.userPrompt,
      userId: finalUserId,
      
      // User repository context (NOT our project!)
      repositoryAnalysis: workflow.repositoryAnalysis,
      githubContext: workflow.context?.githubContext,
      
      // Artifact dependencies
      previousOutputs: this.getPreviousStepOutputs(workflow, step.requires),
      
      // Step configuration from BMAD workflow
      stepConfig: {
        creates: step.creates,
        requires: step.requires,
        notes: step.notes,
        optional_steps: step.optional_steps
      },
      
      // Agent-specific context
      agentRole: agent.role || agentName,
      agentPersona: agent.persona || 'professional assistant'
    };

    // Start interactive agent execution
    return await this.executeAgentInteractively(workflowId, agent, step, context, workflow);
  }

  /**
   * Execute agent with interactive user correspondence
   */
  async executeAgentInteractively(workflowId, agent, step, context, workflow) {
    const agentName = agent.name || agent.role || step.agent;
    
    // CRITICAL: Ensure workflow.context is ALWAYS initialized at method entry
    if (!workflow.context) {
      workflow.context = {
        routingDecisions: {},
        artifacts: new Map(),
        elicitationHistory: []
      };
    }
    
    try {
      // Task intro message removed - users don't need to see system task intro messages

      // Phase 1: Agent analyzes context and asks questions if needed
      const analysisQuestions = await this.generateAnalysisQuestions(agent, step, context, workflow);
      
      if (analysisQuestions && analysisQuestions.length > 0) {
        // Ask user questions and wait for responses
        const userResponses = await this.askUserQuestions(workflowId, agentName, analysisQuestions);
        
            // Add user responses to context
        context.userResponses = userResponses;
      }

      // CRITICAL: Reload workflow from database after any async user interaction
      // The workflow object may have become stale during the wait period
      workflow = await this.loadWorkflowFromDatabase(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found after user interaction`);
      }
      

      // Check if this step creates artifacts - determines execution path
      const createsArtifacts = step.creates && step.creates.trim().length > 0;
      
      if (createsArtifacts) {
        // ARTIFACT CREATION PATH: Steps that produce deliverables
        logger.info(`🎯 [AGENT FLOW] Artifact creation step: ${step.creates}`);
        
        // Phase 2: Agent shows work progress
        await this.sendAgentMessage(workflowId, EVENTS.AGENT_WORKING, {
          agent: agentName,
          message: `✦ I'm now working on ${step.creates}. This may take a moment...`,
          requiresResponse: false
        });

        // Phase 3: Execute actual AI work
        const aiResponse = await this.executeAIWork(agent, step, context, workflow);

        // Phase 4: Agent presents work and asks for confirmation
        const userApproval = await this.sendAgentMessage(workflowId, EVENTS.AGENT_WORK_COMPLETE, {
          agent: agentName,
          message: `✦ I've completed the ${step.creates}. Please review the results.`,
          content: aiResponse.content,
          requiresResponse: true,
          responseType: 'approval', // yes/no/modify
          choices: ['yes', 'no', 'modify']
        });
        
        // CRITICAL: Reload workflow from database after async user interaction
        workflow = await this.loadWorkflowFromDatabase(workflowId);
        if (!workflow) {
          throw new Error(`Workflow ${workflowId} not found after user approval interaction`);
        }
        
        if (userApproval.action === 'modify') {
          // User wants modifications - iterate
          return await this.handleModificationRequest(workflowId, agent, step, context, workflow, userApproval.feedback, aiResponse);
        }

        // Phase 5: Save artifact and complete
        if (userApproval.action === 'yes') {
          await this.saveApprovedArtifact(step.creates, aiResponse, workflow, agent);
          
          await this.sendAgentMessage(workflowId, EVENTS.AGENT_COMPLETE, {
            agent: agentName,
            message: `✅ ${step.creates} has been completed and saved to your repository.`,
            requiresResponse: false
          });
        }

        return {
          status: 'success',
          agent: agentName,
          provider: aiResponse.provider,
          outputLength: aiResponse.content.length,
          artifactCreated: step.creates,
          userInteraction: true
        };
        
      } else {
        // INFORMATION GATHERING PATH: Steps that collect input/decisions
        logger.info(`📋 [AGENT FLOW] Information gathering step: ${step.action || step.step}`);
        
        // CRITICAL: Reload workflow before any context access to ensure fresh data
        workflow = await this.loadWorkflowFromDatabase(workflowId);
        if (!workflow) {
          throw new Error(`Workflow ${workflowId} not found during information gathering`);
        }
        
        // Store the user responses in workflow context for next steps
        if (context.userResponses && context.userResponses.length > 0) {
          // Store step decision in workflow context
          const stepDecision = {
            step: step.step || step.action,
            agent: agentName,
            responses: context.userResponses,
            timestamp: new Date().toISOString()
          };
          
          // Add to workflow routing decisions for next steps
          // CRITICAL FIX: Always ensure context exists before accessing
          if (!workflow.context) {
            workflow.context = {};
          }
          
          if (!workflow.context.routingDecisions) {
            workflow.context.routingDecisions = {};
          }
          workflow.context.routingDecisions[step.step || step.action || agentName] = stepDecision;
          
          // CRITICAL FIX: Save the workflow after storing routing decision
          await this.saveWorkflowToDatabase(workflow);
        }

        // Send completion message for information gathering
        await this.sendAgentMessage(workflowId, EVENTS.AGENT_COMPLETE, {
          agent: agentName,
          message: `✅ Information collected. Moving to next step.`,
          requiresResponse: false
        });

        return {
          status: 'success',
          agent: agentName,
          provider: 'information_gathering',
          outputLength: 0,
          artifactCreated: null,
          userInteraction: true,
          decisionStored: true
        };
      }

    } catch (error) {
      await this.sendAgentMessage(workflowId, 'agent-error', {
        agent: agentName,
        message: `❌ I encountered an error: ${error.message}`,
        timestamp: new Date().toISOString(),
        requiresResponse: false
      });
      throw error;
    }
  }

  /**
   * Send message to user via interactive messaging system
   */
  async sendAgentMessage(workflowId, eventType, data) {
    try {
      // Use interactive messaging system for messages that require responses
      if (data.requiresResponse) {
        return await this.interactiveMessaging.sendMessageAndWait(workflowId, eventType, data);
      } else {
        // Send non-interactive messages directly
        await this.interactiveMessaging.sendMessageAndWait(workflowId, eventType, data);
        return null;
      }
    } catch (error) {
      logger.warn(`Failed to send agent message: ${error.message}`);
      throw error;
    }
  }

  // Task intro message method removed - no hardcoded messages allowed

  /**
   * Generate analysis questions for user
   */
  async generateAnalysisQuestions(agent, step, context, workflow) {
    const agentName = step.agent;
    logger.info(`🤖 [AI QUESTIONS] Generating AI-powered questions using agent config for: ${agentName}`);
    
    if (!this.aiService) {
      throw new Error('AI Service is required to generate agent questions - no hardcoded questions allowed');
    }
    
    try {
      // Use ONLY the agent's existing configuration and step context
      // The AI service will use the agent's persona and step details to generate questions
      const stepContext = {
        step: step.stepName || step.action,
        description: step.description || step.action,
        creates: step.creates,
        currentStep: context.step + 1,
        totalSteps: context.totalSteps
      };

      // Let the AI use ONLY the agent configuration from .bmad-core to generate questions
      const aiResponse = await this.aiService.generateAgentResponse(
        agent, // Full agent config from .bmad-core is passed here
        JSON.stringify(stepContext), // Just provide the step context, let the agent handle the rest
        [], // No chat history for question generation
        context.userId || 'system'
      );
      
      // Return the AI-generated question in the expected format
      const questions = [{
        question: aiResponse.content.trim(),
        type: 'open', // Let the AI determine the appropriate response type
        choices: null
      }];
      
      logger.info(`✅ [AI QUESTIONS] Generated AI question using agent config for ${agentName}: ${questions[0].question}`);
      
      return questions;
      
    } catch (error) {
      logger.error(`❌ [AI QUESTIONS] Failed to generate AI questions for ${agentName}:`, error);
      throw new Error(`Failed to generate questions for ${agentName}: ${error.message}`);
    }
  }

  /**
   * Ask user questions and wait for responses
   */
  async askUserQuestions(workflowId, agentName, questions) {
    const responses = [];
    
    for (const question of questions) {
      const response = await this.sendAgentMessage(workflowId, EVENTS.AGENT_QUESTION, {
        agent: agentName,
        message: `${question.question}`,
        requiresResponse: true,
        responseType: question.type,
        choices: question.choices
      });
      
      responses.push(response);
    }
    
    return responses;
  }

  /**
   * Execute the actual AI work
   */
  async executeAIWork(agent, step, context, workflow) {
    const agentPrompt = this.buildAgentPrompt(agent, step, context, workflow);
    
    logger.info(`🤖 Calling AI service for agent ${agent.name || step.agent}...`);
    const aiResponse = await this.aiService.call(
      agentPrompt,
      agent,
      'complex',
      context,
      workflow.userId
    );

    if (!aiResponse || !aiResponse.content) {
      throw new Error(`AI service returned empty response`);
    }

    return aiResponse;
  }

  /**
   * Wait for user approval of agent's work
   */
  async waitForUserApproval(workflowId, agentName) {
    // This is now handled by the sendAgentMessage method
    // when requiresResponse is true
    return { action: 'yes' };
  }

  /**
   * Handle user modification requests
   */
  async handleModificationRequest(workflowId, agent, step, context, workflow, feedback, originalResponse) {
    // Add user feedback to context and re-execute
    context.userFeedback = feedback;
    
    await this.sendAgentMessage(workflowId, 'agent-modifying', {
      agent: agent.name || step.agent,
      message: `✦ I understand your feedback. Let me revise the ${step.creates || 'work'}.`,
      timestamp: new Date().toISOString(),
      requiresResponse: false
    });
    
    // Re-execute with feedback
    const revisedResponse = await this.executeAIWork(agent, step, context, workflow);
    
    // Present revised work
    await this.sendAgentMessage(workflowId, 'agent-work-revised', {
      agent: agent.name || step.agent,
      message: `✦ Here's the revised version. How does this look?`,
      timestamp: new Date().toISOString(),
      content: revisedResponse.content,
      requiresResponse: true,
      responseType: 'approval'
    });
    
    const approval = await this.waitForUserApproval(workflowId, agent.name || step.agent);
    
    if (approval.action === 'yes') {
      await this.saveApprovedArtifact(step.creates, revisedResponse, workflow, agent);
      return {
        status: 'success',
        agent: agent.name || step.agent,
        provider: revisedResponse.provider,
        outputLength: revisedResponse.content.length,
        artifactCreated: step.creates,
        userInteraction: true,
        revised: true
      };
    }
    
    return { status: 'needs_revision', userFeedback: approval.feedback };
  }

  /**
   * Save approved artifact
   */
  async saveApprovedArtifact(artifactName, aiResponse, workflow, agent) {
    const artifactData = {
      name: artifactName,
      content: aiResponse.content,
      metadata: {
        agent: agent.name || agent.role,
        provider: aiResponse.provider,
        model: aiResponse.model,
        createdAt: new Date(),
        step: workflow.bmadWorkflowData.currentStep,
        stepType: 'agent',
        aiMetrics: aiResponse.usage,
        userApproved: true
      }
    };
    
    // Store in workflow context
    workflow.context.artifacts.set(artifactName, artifactData);
    
    // Save to user's repository if available
    if (workflow.context?.githubContext?.gitService) {
      try {
        await this.saveArtifactToRepository(workflow.context.githubContext, artifactName, aiResponse.content, workflow);
        logger.info(`📄 Artifact ${artifactName} saved to user repository (${aiResponse.content.length} chars)`);
      } catch (repoError) {
        logger.warn(`⚠️ Could not save ${artifactName} to repository: ${repoError.message}`);
      }
    } else {
      logger.info(`📄 Created artifact: ${artifactName} (${aiResponse.content.length} chars) - stored in workflow only`);
    }
  }

  /**
   * Build AI prompt for specific agent and task
   */
  buildAgentPrompt(agent, step, context, workflow) {
    // Start with agent persona and role
    let prompt = `You are ${agent.name || agent.role || 'a professional assistant'}.`;
    
    if (agent.persona) {
      prompt += `\n\nYour persona: ${agent.persona}`;
    }

    // Add current task context
    prompt += `\n\nYou are working on step ${context.step + 1} of ${context.totalSteps} in a ${workflow.template} workflow.`;
    prompt += `\n\nUser's Request: "${context.userPrompt}"`;

    // Add step-specific instructions
    if (step.notes) {
      prompt += `\n\nStep Instructions: ${step.notes}`;
    }

    // Add repository context if available
    if (context.repositoryAnalysis) {
      prompt += `\n\nTarget Repository Context:`;
      prompt += `\n- Repository: ${context.repositoryAnalysis.repository?.fullName || 'User Repository'}`;
      prompt += `\n- Framework: ${context.repositoryAnalysis.development?.framework || 'Unknown'}`;
      prompt += `\n- Languages: ${JSON.stringify(context.repositoryAnalysis.development?.languages || {})}`;
      prompt += `\n- File Count: ${context.repositoryAnalysis.metrics?.fileCount || 0}`;
    }

    // Add required inputs from previous steps
    if (step.requires && Object.keys(context.previousOutputs).length > 0) {
      prompt += `\n\nRequired Inputs from Previous Steps:`;
      for (const [artifactName, artifact] of Object.entries(context.previousOutputs)) {
        prompt += `\n\n${artifactName}:\n${artifact.content}`;
      }
    }

    // Add output requirements
    if (step.creates) {
      prompt += `\n\nYou must create: ${step.creates}`;
      prompt += `\nProvide the complete content for this deliverable.`;
    }

    // Add final instructions
    prompt += `\n\nIMPORTANT: You are working on the USER'S repository, not our system. Generate content that applies to their project based on the repository analysis and user request.`;

    return prompt;
  }

  /**
   * Execute an action-based step
   */
  async executeActionStep(workflowId, step, workflow) {
    logger.info(`⚡ Executing action: ${step.action}`);
    
    // Handle different action types
    switch (step.action) {
      case 'pause_for_input':
        workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
        await this.saveWorkflowToDatabase(workflow);
        return 'paused';
      
      case 'send_notification':
        if (this.pusherService) {
          // Send notification via Pusher
          await this.pusherService.sendWorkflowEvent(workflowId, 'notification', {
            message: step.message || 'Workflow notification',
            step: workflow.bmadWorkflowData.currentStep
          });
        }
        return 'success';
      
      default:
        logger.info(`✅ Action ${step.action} completed`);
        return 'success';
    }
  }

  /**
   * Execute a decision/condition step
   */
  async executeDecisionStep(workflowId, step, workflow) {
    logger.info(`🤔 Evaluating decision step: ${step.condition}`);
    
    const result = this.evaluateCondition(step.condition, workflow);
    logger.info(`📊 Decision result: ${result}`);
    
    return 'success';
  }

  /**
   * Execute routing step with multiple routes
   */
  async executeRoutingStep(workflowId, step, workflow) {
    logger.info(`🔀 Executing routing step: ${step.step || 'routing_decision'}`);
    
    if (!step.routes) {
      logger.warn(`⚠️ Routing step has no routes defined`);
      return 'success';
    }
    
    // For now, we'll need to evaluate which route to take based on workflow state
    // This would typically involve user interaction or condition evaluation
    // For the brownfield workflow, this handles classification routing
    
    // Use stored classification decision for routing
    if (step.step === 'routing_decision' && step.condition === 'based_on_classification') {
      // Look for stored classification decision
      const classificationDecision = workflow.context.routingDecisions?.['enhancement_classification'];
      
      if (!classificationDecision) {
        logger.warn(`⚠️ No classification decision found in routingDecisions`);
        return 'error';
      }
      
      // Extract user response to determine route
      const userResponse = classificationDecision.responses?.[0]?.response || classificationDecision.responses?.[0] || '';
      logger.info(`🔍 Analyzing classification response: "${userResponse}"`);
      
      // Determine route based on user response
      let selectedRoute = 'major_enhancement'; // default
      
      if (userResponse.toLowerCase().includes('small') || userResponse.toLowerCase().includes('fix') || userResponse.toLowerCase().includes('single')) {
        selectedRoute = 'single_story';
      } else if (userResponse.toLowerCase().includes('feature') && !userResponse.toLowerCase().includes('major')) {
        selectedRoute = 'small_feature';  
      } else if (userResponse.toLowerCase().includes('major') || userResponse.toLowerCase().includes('architectural') || userResponse.toLowerCase().includes('enhancement')) {
        selectedRoute = 'major_enhancement';
      }
      
      logger.info(`📍 Auto-selected route based on classification: ${selectedRoute}`);
      
      // Send informational message about the routing decision
      await this.sendAgentMessage(workflowId, EVENTS.AGENT_MESSAGE, {
        agent: 'system',
        message: `🔀 Based on your enhancement classification "${userResponse}", proceeding with: ${selectedRoute}`,
        requiresResponse: false
      });
      
      // Store routing decision in workflow context
      if (!workflow.context.selectedRoute) {
        workflow.context.selectedRoute = selectedRoute;
        await this.saveWorkflowToDatabase(workflow);
      }
      
      return 'success';
    }
    
    return 'success';
  }

  /**
   * Get outputs from previous steps that this step requires
   */
  getPreviousStepOutputs(workflow, requires) {
    if (!requires) return {};
    
    const requiredArtifacts = Array.isArray(requires) ? requires : [requires];
    const outputs = {};
    
    for (const artifactName of requiredArtifacts) {
      if (workflow.context.artifacts.has(artifactName)) {
        outputs[artifactName] = workflow.context.artifacts.get(artifactName);
      }
    }
    
    return outputs;
  }

  /**
   * Evaluate step condition
   */
  evaluateCondition(condition, workflow) {
    // Simple condition evaluation - can be expanded later
    return true;
  }

  /**
   * Save artifact to user's repository
   */
  async saveArtifactToRepository(githubContext, artifactName, content, workflow) {
    const { gitService, repository, targetBranch } = githubContext;
    
    if (!gitService || !repository) {
      throw new Error('GitHub context not properly configured');
    }
    
    // Determine file path based on artifact type
    let filePath;
    if (artifactName.endsWith('.md')) {
      // Documentation files go to docs folder
      filePath = `docs/${artifactName}`;
    } else if (artifactName.includes('architecture')) {
      filePath = `docs/architecture/${artifactName}`;
    } else if (artifactName.includes('story') || artifactName.includes('epic')) {
      filePath = `docs/stories/${artifactName}`;
    } else {
      // Default to docs folder
      filePath = `docs/${artifactName}`;
    }
    
    // Create commit message
    const commitMessage = `feat: Add ${artifactName} (generated by BMAD ${workflow.template} workflow)

Generated by: ${workflow.context.artifacts.get(artifactName)?.metadata?.agent || 'agent'}
Step: ${workflow.bmadWorkflowData.currentStep + 1}/${workflow.bmadWorkflowData.sequence.length}
Workflow: ${workflow.workflowId}

🤖 Generated with BMAD AI workflow system`;
    
    // Save file to repository using uploadFile method from GitIntegrationService
    await gitService.githubPlugin.uploadFile({
      owner: repository.owner,
      repo: repository.name,
      path: filePath,
      message: commitMessage,
      content: content,
      branch: targetBranch || 'main'
    });
    
    logger.info(`📁 Saved ${artifactName} to ${repository.owner}/${repository.name}:${filePath}`);
  }

  // Database operations
  async loadWorkflowFromDatabase(workflowId) {
    try {
      const workflow = await Workflow.findOne({ workflowId: workflowId });
      
      
      if (workflow) {
        // Initialize bmadWorkflowData if not present
        if (!workflow.bmadWorkflowData) {
          workflow.bmadWorkflowData = {};
        }
        
        // Always ensure workflow.context is initialized first
        workflow.context = {};
        
        // Load context from bmadWorkflowData.context (persistent) to workflow.context (runtime)
        if (workflow.bmadWorkflowData.context) {
          workflow.context = { ...workflow.bmadWorkflowData.context };
          
          // Convert plain objects back to Maps if needed
          if (workflow.context.artifacts && !(workflow.context.artifacts instanceof Map)) {
            workflow.context.artifacts = new Map(Object.entries(workflow.context.artifacts));
          }
        }
        
        // Ensure context subfields are always properly initialized
        if (!workflow.context.routingDecisions) {
          workflow.context.routingDecisions = {};
        }
        if (!workflow.context.artifacts) {
          workflow.context.artifacts = new Map();
        }
        if (!workflow.context.elicitationHistory) {
          workflow.context.elicitationHistory = [];
        }

      }
      
      return workflow;
    } catch (error) {
      logger.error(`❌ Failed to load workflow ${workflowId}:`, error.message);
      return null;
    }
  }

  async saveWorkflowToDatabase(workflowData) {
    try {
      // Initialize bmadWorkflowData if not present
      if (!workflowData.bmadWorkflowData) {
        workflowData.bmadWorkflowData = {};
      }
      
      // Save context from runtime (workflow.context) to persistent storage (bmadWorkflowData.context)
      if (workflowData.context) {
        // Convert Map objects to plain objects for persistence
        const contextToSave = { ...workflowData.context };
        if (contextToSave.artifacts instanceof Map) {
          contextToSave.artifacts = Object.fromEntries(contextToSave.artifacts);
        }
        workflowData.bmadWorkflowData.context = contextToSave;
      }
      
      await Workflow.findOneAndUpdate(
        { workflowId: workflowData.workflowId },
        workflowData,
        { upsert: true, new: true }
      );
    } catch (error) {
      logger.error(`❌ Failed to save workflow ${workflowData.workflowId}:`, error.message);
      throw error;
    }
  }

  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Methods expected by BmadOrchestrator
  getActiveWorkflows() {
    // For now return empty array - can be expanded later
    return [];
  }

  getExecutionHistory(limit = 50) {
    // For now return empty array - can be expanded later
    return [];
  }

  async getWorkflowArtifacts(workflowId) {
    // For now return empty array - can be expanded later
    return [];
  }

  async getWorkflowCheckpoints(workflowId) {
    // For now return empty array - can be expanded later
    return [];
  }

  async resumeFromRollback(workflowId) {
    // For now just resume the workflow
    return this.resumeWorkflow(workflowId);
  }

  async resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentName, userId = null) {
    // For now just resume the workflow
    return this.resumeWorkflow(workflowId);
  }

  cleanup() {
    // Cleanup method - for now just log
    logger.info('WorkflowManager cleanup completed');
  }
}

export default WorkflowManager;