 ○ Compiling /api/bmad/workflow ...
 ✓ Compiled /api/bmad/workflow in 1497ms (3243 modules)
[next-auth][warn][DEBUG_ENABLED] 
https://next-auth.js.org/warnings#debug_enabled
{
  body: {
    userPrompt: 'Add create/delete to To Do list app',
    name: 'test',
    sequence: 'brownfield-fullstack',
    priority: 'normal',
    tags: [ 'bmad', 'brownfield' ]
  }
}
2025-08-10 13:37:37 info:       ✅ AIService loaded successfully for orchestrator
2025-08-10 13:37:37 info:       Initializing BMAD Orchestrator...
2025-08-10 13:37:38 info:       🔧 [CONFIG] Loading configuration from: C:\Users\Erez\Desktop\dream-team\.bmad-core\core-config.yaml
2025-08-10 13:37:38 info:       ✅ [CONFIG] Configuration loaded successfully
2025-08-10 13:37:38 info:       🔧 [CONFIG] PRD Location: docs/prd.md
2025-08-10 13:37:38 info:       🔧 [CONFIG] Architecture Location: docs/architecture.md
2025-08-10 13:37:38 info:       🔧 [CONFIG] Story Location: docs/stories
2025-08-10 13:37:38 info:       🔧 [CONFIG] Markdown Exploder: true
 GET /workflows 200 in 93ms
2025-08-10 13:37:38 info:       ArtifactManager initialized
2025-08-10 13:37:38 info:       BMAD Orchestrator initialized successfully
2025-08-10 13:37:38 info:       Initializing AIService for workflow launch with user:
2025-08-10 13:37:38 info:       📚 Loaded user API keys from database
2025-08-10 13:37:38 info:       ✅ Gemini AI initialized (user key)
2025-08-10 13:37:38 info:       🔧 AI Service initialized - health checks will be performed on-demand
2025-08-10 13:37:38 info:       ✅ AIService initialized successfully for workflow launch
2025-08-10 13:37:38 info:       🔍 [BmadOrchestrator] Checking for dynamic workflow: brownfield-fullstack - Found
2025-08-10 13:37:38 info:       🚀 [BmadOrchestrator] Starting dynamic workflow: brownfield-fullstack
2025-08-10 13:37:38 info:       📋 [WorkflowParser] Loading workflow: brownfield-fullstack
2025-08-10 13:37:38 info:       ✅ [WorkflowParser] YAML file loaded: C:\Users\Erez\Desktop\dream-team\.bmad-core\workflows\brownfield-fullstack.yaml
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       WorkflowParser - Parsed step:
2025-08-10 13:37:38 info:       🧪 [WorkflowParser] Validating workflow: brownfield-fullstack
2025-08-10 13:37:38 warn:       ⚠️ [WorkflowParser] Step 5 requires 'existing_documentation_or_analysis' but it's not created by any previous step
2025-08-10 13:37:38 warn:       ⚠️ [WorkflowParser] Step 10 requires 'all_artifacts_in_project' but it's not created by any previous step
2025-08-10 13:37:38 warn:       ⚠️ [WorkflowParser] Step 11 requires 'sharded_docs_or_brownfield_docs' but it's not created by any previous step
2025-08-10 13:37:38 info:       ✅ [WorkflowParser] Workflow validation complete: 19 steps, 8 artifacts
2025-08-10 13:37:38 info:       🎯 [WorkflowParser] Workflow parsed successfully. Steps: 19
2025-08-10 13:37:38 info:       🔗 [WorkflowParser] Resolving references for workflow: brownfield-fullstack
2025-08-10 13:37:38 info:       ✅ [WorkflowParser] Resolved 'document-project.md' for step 2
2025-08-10 13:37:38 info:       ✅ [WorkflowParser] Resolved 'brownfield-prd-tmpl' for step 5
2025-08-10 13:37:38 info:       ✅ [WorkflowParser] Resolved 'brownfield-architecture-tmpl' for step 7
2025-08-10 13:37:38 warn:       ⚠️ Task (MD) not found: C:\Users\Erez\Desktop\dream-team\.bmad-core\tasks\po-master-checklist.md - ENOENT: no such file or directoryy, open 'C:\Users\Erez\Desktop\dream-team\.bmad-core\tasks\po-master-checklist.md'
2025-08-10 13:37:38 warn:       ⚠️ Task (YAML) not found: C:\Users\Erez\Desktop\dream-team\.bmad-core\tasks\po-master-checklist - ENOENT: no such file or directory,, open 'C:\Users\Erez\Desktop\dream-team\.bmad-core\tasks\po-master-checklist'
2025-08-10 13:37:38 info:       ✅ [WorkflowParser] Resolved 'po-master-checklist' for step 8
2025-08-10 13:37:38 info:       [DatabaseService] saveWorkflow START - workflowId: workflow_1754822257953_7na578m
2025-08-10 13:37:38 info:       [DatabaseService] Parameters validated successfully
2025-08-10 13:37:38 info:       🔍 [HANDLE REGULAR STEP] Starting step 0 for agent analyst, status: initializing
2025-08-10 13:37:38 info:       🔍 [HANDLE REGULAR STEP] Step details: {"stepName":"enhancement_classification","action":"classify enhancement scope","agentId":"analyst"}
2025-08-10 13:37:38 info:       🔍 [AGENT CONTEXT] Prepared context: {"action":"classify enhancement scope","hasClassificationContext":false}
2025-08-10 13:37:38 info:       🔍 [AGENT EXECUTION] About to execute agent analyst with context
2025-08-10 13:37:38 info:       🔍 [AGENT EXECUTOR DEBUG] Full context received: {"action":"classify enhancement scope","stepNotes":"Determine enhancement complexity to route to appropriate path:\n- Single story (< 4 hours) → Use brownfield-create-story task\n- Small feature (1-3 stories) → Use brownfield-create-epic task  \n- Major enhancement (multiple epics) → Continue with full workflow\n\nAsk user: \"Can you describe the enhancement scope? Is this a small fix, a feature addition, or a major enhancement requiring architectural changes?\"\n","agentId":"analyst","workflowId":"workflow_1754822257953_7na578m","contextKeys":["workflowId","step","totalSteps","userPrompt","previousArtifacts","workflowContext","agentRole","agentDescription","metadata","action","command","creates","stepNotes","classificationContext","userId"],"agentKeys":["id","config","activationInstructions","agent","persona","commands","dependencies","rawContent","status","lastExecuted","executionHistory"]}
2025-08-10 13:37:38 info:       🔍 [AGENT EXECUTOR DEBUG] About to call determineTemplate
2025-08-10 13:37:38 info:       🔍 [AGENT EXECUTOR DEBUG] Context details: {"action":"classify enhancement scope","agentId":"analyst","stepNotes":"Determine enhancement complexity to route to appropriate path:\n- Single story (< 4 hours) → Use brownfield-create-story task\n- Small feature (1-3 stories) → Use brownfield-create-epic task  \n- Major enhancement (multiple epics) → Continue with full workflow\n\nAsk user: \"Can you describe the enhancement scope? Is this a small fix, a feature addition, or a major enhancement requiring architectural changes?\"\n"}
2025-08-10 13:37:38 info:       [AGENT EXECUTOR] determineTemplate - Agent: analyst, Context Action: classify enhancement scope, Context Uses: undefined
2025-08-10 13:37:38 info:       🔄 [INTERACTIVE DETECTION] Known interactive action: 'classify enhancement scope'
2025-08-10 13:37:38 info:       [AGENT EXECUTOR] determineTemplate - Interactive step detected: classify enhancement scope - no template needed
2025-08-10 13:37:38 info:       🔍 [AGENT EXECUTOR DEBUG] determineTemplate completed: {"templateFound":false}
2025-08-10 13:37:38 warn:       No suitable template found for agent
2025-08-10 13:37:38 info:       🤖 No template found for classify enhancement scope, using generic AI processing
2025-08-10 13:37:38 info:       🤖 [GENERIC AI] Creating template for: classify enhancement scope
2025-08-10 13:37:38 info:       ✅ [GENERIC AI] Template created for classify enhancement scope (elicitation: true)
2025-08-10 13:37:50 info:       📊 Gemini Usage Details: {"totalTokens":2646,"promptTokens":440,"candidatesTokens":1357,"estimatedCost":"$0.002646","textLength":6417,"hasMetadata":true}
2025-08-10 13:38:05 info:       📊 Gemini Usage Details: {"totalTokens":3219,"promptTokens":440,"candidatesTokens":1201,"estimatedCost":"$0.003219","textLength":6063,"hasMetadata":true}
2025-08-10 13:38:05 info:       🔍 [AGENT EXECUTION] Agent execution completed: {"success":false,"hasOutput":true,"error":"Validation failed after 2 attempts: Missing required section: Context, Missing required section: Instructions, Missing required section: Task"}
2025-08-10 13:38:05 info:       Elicitation request from analyst in workflow workflow_1754822257953_7na578m
2025-08-10 13:38:05 info:       [BMAD] elicitation_request: analyst → user
2025-08-10 13:38:05 info:       [DatabaseService] saveWorkflow START - workflowId: workflow_1754822257953_7na578m
2025-08-10 13:38:05 info:       [DatabaseService] Parameters validated successfully
2025-08-10 13:38:05 info:       📝 [DATABASE] Elicitation details saved:
2025-08-10 13:38:05 info:       [Pusher Service] Triggering event on channel: workflow-workflow_1754822257953_7na578m, event: workflow-update
2025-08-10 13:38:05 info:       [DatabaseService] saveWorkflow START - workflowId: workflow_1754822257953_7na578m
2025-08-10 13:38:05 info:       [DatabaseService] Parameters validated successfully
 POST /api/bmad/workflow 200 in 29014ms
 GET /workflows/live/workflow_1754822257953_7na578m 200 in 96ms
 ○ Compiling /api/workflows/live/[workflowInstanceId] ...
2025-08-10 13:38:06 info:       🔔 Pusher event sent: workflow-workflow_1754822257953_7na578m -> workflow-update
 ✓ Compiled /api/workflows/live/[workflowInstanceId] in 947ms (3245 modules)
 ✓ Compiled in 0ms (3245 modules)
[next-auth][warn][DEBUG_ENABLED] 
https://next-auth.js.org/warnings#debug_enabled
2025-08-10 13:38:07 info:       ✅ AIService loaded successfully for orchestrator
2025-08-10 13:38:07 info:       Initializing BMAD Orchestrator...
2025-08-10 13:38:07 info:       🔧 [CONFIG] Loading configuration from: C:\Users\Erez\Desktop\dream-team\.bmad-core\core-config.yaml
2025-08-10 13:38:07 info:       ✅ [CONFIG] Configuration loaded successfully
2025-08-10 13:38:07 info:       🔧 [CONFIG] PRD Location: docs/prd.md
2025-08-10 13:38:07 info:       🔧 [CONFIG] Architecture Location: docs/architecture.md
2025-08-10 13:38:07 info:       🔧 [CONFIG] Story Location: docs/stories
2025-08-10 13:38:07 info:       🔧 [CONFIG] Markdown Exploder: true
2025-08-10 13:38:07 info:       ArtifactManager initialized
2025-08-10 13:38:07 info:       BMAD Orchestrator initialized successfully
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 2024ms
 ✓ Compiled in 0ms (3245 modules)
2025-08-10 13:38:08 info:       ✅ MongoDB native client connected successfully
 ✓ Compiled in 0ms (3245 modules)
[next-auth][warn][DEBUG_ENABLED] 
https://next-auth.js.org/warnings#debug_enabled
2025-08-10 13:38:08 info:       ✅ AIService loaded successfully for orchestrator
2025-08-10 13:38:08 info:       Initializing BMAD Orchestrator...
2025-08-10 13:38:08 info:       🔧 [CONFIG] Loading configuration from: C:\Users\Erez\Desktop\dream-team\.bmad-core\core-config.yaml
2025-08-10 13:38:08 info:       ✅ [CONFIG] Configuration loaded successfully
2025-08-10 13:38:08 info:       🔧 [CONFIG] PRD Location: docs/prd.md
2025-08-10 13:38:08 info:       🔧 [CONFIG] Architecture Location: docs/architecture.md
2025-08-10 13:38:08 info:       🔧 [CONFIG] Story Location: docs/stories
2025-08-10 13:38:08 info:       🔧 [CONFIG] Markdown Exploder: true
2025-08-10 13:38:09 info:       ArtifactManager initialized
2025-08-10 13:38:09 info:       BMAD Orchestrator initialized successfully
2025-08-10 13:38:09 info:       📥 [MessageService] Loaded 0 existing messages for workflow workflow_1754822257953_7na578m
2025-08-10 13:38:09 info:       📨 [MessageService] Initialized for workflow workflow_1754822257953_7na578m with config:
2025-08-10 13:38:09 info:       📥 [MessageService] Loaded 0 existing messages for workflow workflow_1754822257953_7na578m
2025-08-10 13:38:09 info:       📨 [MessageService] Initialized for workflow workflow_1754822257953_7na578m with config:
 GET /api/workflows/live/workflow_1754822257953_7na578m 200 in 3557ms
 ✓ Compiled in 0ms (3245 modules)
 GET /workflows/live/workflow_1754822257953_7na578m 200 in 3038ms
2025-08-10 13:38:09 info:       ✅ MongoDB native client connected successfully
 ✓ Compiled /api/bmad/commands/metadata in 0ms (3245 modules)
[next-auth][warn][DEBUG_ENABLED] 
https://next-auth.js.org/warnings#debug_enabled
2025-08-10 13:38:10 info:       ✅ AIService loaded successfully for orchestrator
2025-08-10 13:38:10 info:       Initializing BMAD Orchestrator...
2025-08-10 13:38:10 info:       🔧 [CONFIG] Loading configuration from: C:\Users\Erez\Desktop\dream-team\.bmad-core\core-config.yaml
2025-08-10 13:38:10 info:       ✅ [CONFIG] Configuration loaded successfully
2025-08-10 13:38:10 info:       🔧 [CONFIG] PRD Location: docs/prd.md
2025-08-10 13:38:10 info:       🔧 [CONFIG] Architecture Location: docs/architecture.md
2025-08-10 13:38:10 info:       🔧 [CONFIG] Story Location: docs/stories
2025-08-10 13:38:10 info:       🔧 [CONFIG] Markdown Exploder: true
2025-08-10 13:38:10 info:       ArtifactManager initialized
2025-08-10 13:38:10 info:       BMAD Orchestrator initialized successfully
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 2966ms
 ✓ Compiled in 0ms (3247 modules)
2025-08-10 13:38:11 info:       ✅ MongoDB native client connected successfully
[next-auth][warn][DEBUG_ENABLED] 
https://next-auth.js.org/warnings#debug_enabled
2025-08-10 13:38:11 info:       ✅ AIService loaded successfully for orchestrator
2025-08-10 13:38:11 info:       Initializing BMAD Orchestrator...
Successfully loaded agent: @analyst (Mary)
Successfully loaded agent: @architect (Winston)
Successfully loaded agent: @bmad-master (BMad Master)
Successfully loaded agent: @bmad-orchestrator (BMad Orchestrator)
Successfully loaded agent: @dev (James)
Successfully loaded agent: @pm (John)
Successfully loaded agent: @po (Sarah)
Successfully loaded agent: @qa (Quinn)
Successfully loaded agent: @sm (Bob)
2025-08-10 13:38:11 info:       🔧 [CONFIG] Loading configuration from: C:\Users\Erez\Desktop\dream-team\.bmad-core\core-config.yaml
Successfully loaded agent: @ux-expert (Sally)
 GET /api/bmad/commands/metadata 200 in 2232ms
2025-08-10 13:38:11 info:       ✅ [CONFIG] Configuration loaded successfully
2025-08-10 13:38:11 info:       🔧 [CONFIG] PRD Location: docs/prd.md
2025-08-10 13:38:11 info:       🔧 [CONFIG] Architecture Location: docs/architecture.md
2025-08-10 13:38:11 info:       🔧 [CONFIG] Story Location: docs/stories
2025-08-10 13:38:11 info:       🔧 [CONFIG] Markdown Exploder: true
2025-08-10 13:38:11 info:       ArtifactManager initialized
2025-08-10 13:38:11 info:       BMAD Orchestrator initialized successfully
2025-08-10 13:38:11 info:       📥 [MessageService] Loaded 0 existing messages for workflow workflow_1754822257953_7na578m
2025-08-10 13:38:11 info:       📨 [MessageService] Initialized for workflow workflow_1754822257953_7na578m with config:
2025-08-10 13:38:11 info:       📥 [MessageService] Loaded 0 existing messages for workflow workflow_1754822257953_7na578m
2025-08-10 13:38:11 info:       📨 [MessageService] Initialized for workflow workflow_1754822257953_7na578m with config:
 GET /api/workflows/live/workflow_1754822257953_7na578m 200 in 2734ms
Successfully loaded agent: @analyst (Mary)
Successfully loaded agent: @architect (Winston)
Successfully loaded agent: @bmad-master (BMad Master)
Successfully loaded agent: @bmad-orchestrator (BMad Orchestrator)
Successfully loaded agent: @dev (James)
Successfully loaded agent: @pm (John)
Successfully loaded agent: @po (Sarah)
Successfully loaded agent: @qa (Quinn)
Successfully loaded agent: @sm (Bob)
Successfully loaded agent: @ux-expert (Sally)
 GET /api/bmad/commands/metadata 200 in 65ms
2025-08-10 13:38:12 info:       ✅ MongoDB native client connected successfully
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 66ms
2025-08-10 13:38:16 info:       ✅ MongoDB native client connected successfully
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 36ms
2025-08-10 13:38:26 info:       ✅ MongoDB native client connected successfully
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 32ms
2025-08-10 13:38:36 info:       ✅ MongoDB native client connected successfully
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 31ms
2025-08-10 13:38:46 info:       ✅ MongoDB native client connected successfully
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 38ms
2025-08-10 13:38:56 info:       ✅ MongoDB native client connected successfully
 ○ Compiling /api/workflows/[workflowId]/resume-elicitation ...
 ✓ Compiled /api/workflows/[workflowId]/resume-elicitation in 1026ms (3241 modules)
[next-auth][warn][DEBUG_ENABLED] 
https://next-auth.js.org/warnings#debug_enabled
2025-08-10 13:38:59 info:       Resume elicitation request
2025-08-10 13:38:59 info:       ✅ AIService loaded successfully for orchestrator
2025-08-10 13:38:59 info:       Initializing BMAD Orchestrator...
2025-08-10 13:38:59 info:       🔧 [CONFIG] Loading configuration from: C:\Users\Erez\Desktop\dream-team\.bmad-core\core-config.yaml
2025-08-10 13:38:59 info:       ✅ [CONFIG] Configuration loaded successfully
2025-08-10 13:38:59 info:       🔧 [CONFIG] PRD Location: docs/prd.md
2025-08-10 13:38:59 info:       🔧 [CONFIG] Architecture Location: docs/architecture.md
2025-08-10 13:38:59 info:       🔧 [CONFIG] Story Location: docs/stories
2025-08-10 13:38:59 info:       🔧 [CONFIG] Markdown Exploder: true
 GET /workflows/live/workflow_1754822257953_7na578m 200 in 200ms
2025-08-10 13:39:00 info:       ArtifactManager initialized
2025-08-10 13:39:00 info:       BMAD Orchestrator initialized successfully
2025-08-10 13:39:00 info:       Initializing AIService for user:
2025-08-10 13:39:00 info:       📚 Loaded user API keys from database
2025-08-10 13:39:00 info:       ✅ Gemini AI initialized (user key)
2025-08-10 13:39:00 info:       🔧 AI Service initialized - health checks will be performed on-demand
2025-08-10 13:39:00 info:       ✅ AIService initialized successfully for workflow execution
2025-08-10 13:39:00 info:       🔄 Resuming workflow workflow_1754822257953_7na578m with elicitation response
2025-08-10 13:39:00 info:       🔧 [CONFIG] Loading configuration from: C:\Users\Erez\Desktop\dream-team\.bmad-core\core-config.yaml
2025-08-10 13:39:00 info:       ✅ [CONFIG] Configuration loaded successfully
2025-08-10 13:39:00 info:       🔧 [CONFIG] PRD Location: docs/prd.md
2025-08-10 13:39:00 info:       🔧 [CONFIG] Architecture Location: docs/architecture.md
2025-08-10 13:39:00 info:       🔧 [CONFIG] Story Location: docs/stories
2025-08-10 13:39:00 info:       🔧 [CONFIG] Markdown Exploder: true
2025-08-10 13:39:00 info:       🗣️ [ELICIT] Loading elicitation methods from: C:\Users\Erez\Desktop\dream-team\.bmad-core\data\elicitation-methods.md
2025-08-10 13:39:00 info:       ✅ [ELICIT] Successfully loaded 20 elicitation methods.
2025-08-10 13:39:00 info:       🔄 [DYNAMIC] Processing free_text response: "Add create/delete to To Do list app"
2025-08-10 13:39:00 info:       🔍 [RESUME ELICITATION] Starting resumeWorkflowWithElicitation for workflow workflow_1754822257953_7na578m
2025-08-10 13:39:00 info:       🔍 [RESUME ELICITATION] Params: elicitationResponse="[object Object]", agentId="analyst", userId="689732ed68c24f6ce8e83019"
2025-08-10 13:39:00 info:       🔍 [RESUME ELICITATION] Database workflow status: PAUSED_FOR_ELICITATION
2025-08-10 13:39:00 info:       🔍 [RESUME ELICITATION] Workflow from activeWorkflows: {"hasWorkflow":false,"hasSequence":false}
2025-08-10 13:39:00 info:       🔍 [RESUME ELICITATION] Workflow not in activeWorkflows, rehydrating from database
2025-08-10 13:39:00 info:       🔍 [REHYDRATE] Starting rehydration for workflow workflow_1754822257953_7na578m, template: brownfield-fullstack
2025-08-10 13:39:00 info:       🔍 [REHYDRATE] Workflow type detection: isDynamic=true, template=brownfield-fullstack
2025-08-10 13:39:00 info:       🔍 [REHYDRATE DYNAMIC] Attempting to rehydrate dynamic workflow: brownfield-fullstack
2025-08-10 13:39:00 info:       🔍 [REHYDRATE DYNAMIC] Cached workflow details: {"hasCachedWorkflow":false,"hasSteps":false,"stepsType":"undefined","isStepsArray":false}
2025-08-10 13:39:00 info:       📋 [WorkflowParser] Loading workflow: brownfield-fullstack
2025-08-10 13:39:00 info:       ✅ [WorkflowParser] YAML file loaded: C:\Users\Erez\Desktop\dream-team\.bmad-core\workflows\brownfield-fullstack.yaml
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       WorkflowParser - Parsed step:
2025-08-10 13:39:00 info:       🧪 [WorkflowParser] Validating workflow: brownfield-fullstack
2025-08-10 13:39:00 warn:       ⚠️ [WorkflowParser] Step 5 requires 'existing_documentation_or_analysis' but it's not created by any previous step
2025-08-10 13:39:00 warn:       ⚠️ [WorkflowParser] Step 10 requires 'all_artifacts_in_project' but it's not created by any previous step
2025-08-10 13:39:00 warn:       ⚠️ [WorkflowParser] Step 11 requires 'sharded_docs_or_brownfield_docs' but it's not created by any previous step
2025-08-10 13:39:00 info:       ✅ [WorkflowParser] Workflow validation complete: 19 steps, 8 artifacts
2025-08-10 13:39:00 info:       🎯 [WorkflowParser] Workflow parsed successfully. Steps: 19
2025-08-10 13:39:00 info:       🔗 [WorkflowParser] Resolving references for workflow: brownfield-fullstack
2025-08-10 13:39:00 info:       ✅ [WorkflowParser] Resolved 'document-project.md' for step 2
2025-08-10 13:39:00 info:       ✅ [WorkflowParser] Resolved 'brownfield-prd-tmpl' for step 5
2025-08-10 13:39:00 info:       ✅ [WorkflowParser] Resolved 'brownfield-architecture-tmpl' for step 7
2025-08-10 13:39:00 warn:       ⚠️ Task (MD) not found: C:\Users\Erez\Desktop\dream-team\.bmad-core\tasks\po-master-checklist.md - ENOENT: no such file or directoryy, open 'C:\Users\Erez\Desktop\dream-team\.bmad-core\tasks\po-master-checklist.md'
2025-08-10 13:39:00 warn:       ⚠️ Task (YAML) not found: C:\Users\Erez\Desktop\dream-team\.bmad-core\tasks\po-master-checklist - ENOENT: no such file or directory,, open 'C:\Users\Erez\Desktop\dream-team\.bmad-core\tasks\po-master-checklist'
2025-08-10 13:39:00 info:       ✅ [WorkflowParser] Resolved 'po-master-checklist' for step 8
2025-08-10 13:39:00 info:       🔍 [RESUME ELICITATION] After rehydration: {"hasWorkflow":true,"hasSequence":true,"sequenceLength":19,"firstStepName":"enhancement_classification","firstStepAgent":"analyst"}
2025-08-10 13:39:00 info:       📝 [MessageService] Persisted message msg_1754822340245_ztwxxpm0q to workflow document
2025-08-10 13:39:00 info:       🔍 [RESUME ELICITATION] About to process elicitation response for routing
2025-08-10 13:39:00 info:       🔍 [RESUME ELICITATION] Completed processing elicitation response for routing
2025-08-10 13:39:00 info:       [DatabaseService] saveWorkflow START - workflowId: workflow_1754822257953_7na578m
2025-08-10 13:39:00 info:       [DatabaseService] Parameters validated successfully
2025-08-10 13:39:00 info:       🔍 [WORKFLOW STATE MGR] About to continue current step 0
2025-08-10 13:39:00 info:       🔍 [WORKFLOW STATE MGR] Workflow sequence details: {"hasSequence":true,"sequenceLength":19,"sequenceType":"object","isArray":true}  
2025-08-10 13:39:00 info:       🔍 [WORKFLOW STATE MGR] Current step details: {"stepName":"enhancement_classification","agentId":"analyst","action":"classify enhancement scope","hasStep":true}
2025-08-10 13:39:00 info:       🔍 [WORKFLOW STATE MGR] Workflow type check: isDynamic=true
2025-08-10 13:39:00 info:       🔍 [WORKFLOW STATE MGR] About to call handleRegularStep for dynamic workflow
2025-08-10 13:39:00 info:       🔍 [HANDLE REGULAR STEP] Starting step 0 for agent analyst, status: running
2025-08-10 13:39:00 info:       🔍 [HANDLE REGULAR STEP] Step details: {"stepName":"enhancement_classification","action":"classify enhancement scope","agentId":"analyst"}
2025-08-10 13:39:00 info:       🧠 [AI CLASSIFICATION] Prepared intelligent classification command for analyst
2025-08-10 13:39:00 info:       🔍 [AGENT CONTEXT] Prepared context: {"action":"Analyze the user's response \"Add create/delete to To Do list app\" and classify this enhancement as one of: single_story, small_feature, major_enhancement. Use your AI intelligence to understand the user's intent and requirements, then store the classification decision in the workflow context as 'enhancement_classification'.","command":"analyze_and_classify_enhancement","needsClassification":true,"userResponse":"Add create/delete to To Do list app","hasClassificationContext":true}
2025-08-10 13:39:00 info:       🔍 [AGENT EXECUTION] About to execute agent analyst with context
2025-08-10 13:39:00 info:       🔍 [AGENT EXECUTOR DEBUG] Full context received: {"action":"Analyze the user's response \"Add create/delete to To Do list app\" and classify this enhancement as one of: single_story, small_feature, major_enhancement. Use your AI intelligence to understand the user's intent and requirements, then store the classification decision in the workflow context as 'enhancement_classification'.","command":"analyze_and_classify_enhancement","stepNotes":"Determine enhancement complexity to route to appropriate path:\n- Single story (< 4 hours) → Use brownfield-create-story task\n- Small feature (1-3 stories) → Use brownfield-create-epic task  \n- Major enhancement (multiple epics) → Continue with full workflow\n\nAsk user: \"Can you describe the enhancement scope? Is this a small fix, a feature addition, or a major enhancement requiring architectural changes?\"\n","agentId":"analyst","workflowId":"workflow_1754822257953_7na578m","contextKeys":["workflowId","step","totalSteps","userPrompt","previousArtifacts","workflowContext","agentRole","agentDescription","metadata","action","command","creates","stepNotes","classificationContext","userId"],"agentKeys":["id","config","activationInstructions","agent","persona","commands","dependencies","rawContent","status","lastExecuted","executionHistory"]}
2025-08-10 13:39:00 info:       🔍 [AGENT EXECUTOR DEBUG] About to call determineTemplate
2025-08-10 13:39:00 info:       🔍 [AGENT EXECUTOR DEBUG] Context details: {"action":"Analyze the user's response \"Add create/delete to To Do list app\" and classify this enhancement as one of: single_story, small_feature, major_enhancement. Use your AI intelligence to understand the user's intent and requirements, then store the classification decision in the workflow context as 'enhancement_classification'.","uses":"analyze_and_classify_enhancement","agentId":"analyst","stepNotes":"Determine enhancement complexity to route to appropriate path:\n- Single story (< 4 hours) → Use brownfield-create-story task\n- Small feature (1-3 stories) → Use brownfield-create-epic task  \n- Major enhancement (multiple epics) → Continue with full workflow\n\nAsk user: \"Can you describe the enhancement scope? Is this a small fix, a feature addition, or a major enhancement requiring architectural changes?\"\n"}
2025-08-10 13:39:00 info:       [AGENT EXECUTOR] determineTemplate - Agent: analyst, Context Action: Analyze the user's response "Add create/delete to To Do list app" and classify this enhancement as one of: single_story, small_feature, major_enhancement. Use your AI intelligence to understand the user's intent and requirements, then store the classification decision in the workflow context as 'enhancement_classification'., Context Uses: undefined
2025-08-10 13:39:00 info:       🎯 [PATTERN MATCH] Found pattern for template: enhancement-classification-tmpl.yaml
2025-08-10 13:39:00 info:       🎯 [DETECTION SUCCESS] Template found: enhancement-classification-tmpl.yaml
2025-08-10 13:39:00 info:       ✅ [ENHANCED DETECTION] Found template via pattern matching: enhancement-classification-tmpl.yaml
2025-08-10 13:39:00 info:       🔍 [TEMPLATE LOADING] Resolving template: 'enhancement-classification-tmpl.yaml' -> 'C:\Users\Erez\Desktop\dream-team\.bmad-core\templates\enhancement-classification-tmpl.yaml'
2025-08-10 13:39:00 info:       ✅ [TEMPLATE LOADING] Successfully loaded template: 'enhancement-classification-tmpl.yaml'
2025-08-10 13:39:00 info:       🔍 [AGENT EXECUTOR DEBUG] determineTemplate completed: {"templateFound":true,"templateId":"enhancement-classification-tmpl"}        
2025-08-10 13:39:01 info:       ✅ MongoDB native client connected successfully
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 50ms
2025-08-10 13:39:06 info:       ✅ MongoDB native client connected successfully
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 42ms
2025-08-10 13:39:17 info:       ✅ MongoDB native client connected successfully
 ✓ Compiled in 1050ms (2939 modules)
 GET /workflows/live/workflow_1754822257953_7na578m 200 in 110ms
 GET /api/workflows/workflow_1754822257953_7na578m/artifacts 200 in 34ms
2025-08-10 13:39:47 info:       ✅ MongoDB native client connected successfully
2025-08-10 13:39:49 info:       📊 Gemini Usage Details: {"totalTokens":3002,"promptTokens":440,"candidatesTokens":1169,"estimatedCost":"$0.003002","textLength":5730,"hasMetadata":true}
2025-08-10 13:39:49 info:       🔍 [AGENT EXECUTION] Agent execution completed: {"success":false,"hasOutput":true,"error":"Validation failed after 2 attempts: Missing required section: Context, Missing required section: Instructions, Missing required section: Task"}
2025-08-10 13:39:49 error: CastError: Cast to string failed for value "{
  timestamp: 2025-08-10T10:39:49.016Z,
  error: 'Cast to string failed for value "{\n' +
    '  timestamp: 2025-08-10T10:39:49.015Z,\n' +
    "  error: 'Agent analyst execution failed: Validation failed after 2 attempts: Missing required section: Context, Missing required section: Instructions, Missing required section: Task',\n" +
    '  step: 2,\n' +
    "  type: 'dynamic_step_error'\n" +
    '}" (type Object) at path "bmadWorkflowData.errors"',
  step: 2,
  type: 'dynamic_step_error'
}" (type Object) at path "bmadWorkflowData.errors"
    at SchemaString.cast (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\schema\string.js:607:11)
    at SchemaType.applySetters (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\schemaType.js:1258:12)
    at Proxy._cast (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\types\array\methods\index.js:250:43)
    at Proxy._mapCast (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\types\array\methods\index.js:263:17)
    at Arguments.map (<anonymous>)
    at Proxy.push (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\types\array\methods\index.js:697:21)
    at DynamicWorkflowHandler.executeNextStep (webpack-internal:///(rsc)/./lib/bmad/engine/DynamicWorkflowHandler.js:166:29)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async DynamicWorkflowHandler.handleRegularStep (webpack-internal:///(rsc)/./lib/bmad/engine/DynamicWorkflowHandler.js:251:24)
    at async WorkflowStateManager.resumeWorkflowWithElicitation (webpack-internal:///(rsc)/./lib/bmad/services/WorkflowStateManager.js:237:21)
    at async BmadOrchestrator.resumeWorkflowWithElicitation (webpack-internal:///(rsc)/./lib/bmad/BmadOrchestrator.js:288:28)
    at async POST (webpack-internal:///(rsc)/./app/api/workflows/[workflowId]/resume-elicitation/route.js:65:24)
    at async AppRouteRouteModule.do (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\compiled\next-server\app-route.runtime.dev.js:5:38782)
    at async AppRouteRouteModule.handle (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\compiled\next-server\app-route.runtime.dev.js:5:45984)
    at async responseGenerator (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&page=%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute.js&appDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D&isGlobalNotFoundEnabled=!:203:38)
    at async AppRouteRouteModule.handleResponse (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\compiled\next-server\app-route.runtime.dev.js:1:183692)    
    at async handleResponse (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&page=%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute.js&appDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D&isGlobalNotFoundEnabled=!:265:32)
    at async handler (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&page=%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute.js&appDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D&isGlobalNotFoundEnabled=!:317:13)
    at async doRender (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:1587:34)
    at async DevServer.renderToResponseWithComponentsImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:1929:13)
    at async DevServer.renderPageComponent (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:2395:24)
    at async DevServer.renderToResponseImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:2435:32)
    at async DevServer.pipeImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:1035:25)
    at async NextNodeServer.handleCatchallRenderRequest (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\next-server.js:393:17)
    at async DevServer.handleRequestImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:925:17)
    at async C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\dev\next-dev-server.js:398:20
    at async Span.traceAsyncFn (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\trace\trace.js:157:20)
    at async DevServer.handleRequest (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\dev\next-dev-server.js:394:24)
    at async invokeRender (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\lib\router-server.js:239:21)
    at async handleRequest (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\lib\router-server.js:436:24)
    at async requestHandlerImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\lib\router-server.js:464:13)
    at async Server.requestListener (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\lib\start-server.js:218:13)
2025-08-10 13:39:49 error: CastError: Cast to string failed for value "{
  timestamp: 2025-08-10T10:39:49.016Z,
  error: 'Cast to string failed for value "{\n' +
    '  timestamp: 2025-08-10T10:39:49.015Z,\n' +
    "  error: 'Agent analyst execution failed: Validation failed after 2 attempts: Missing required section: Context, Missing required section: Instructions, Missing required section: Task',\n" +
    '  step: 2,\n' +
    "  type: 'dynamic_step_error'\n" +
    '}" (type Object) at path "bmadWorkflowData.errors"',
  step: 2,
  type: 'dynamic_step_error'
}" (type Object) at path "bmadWorkflowData.errors"
    at SchemaString.cast (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\schema\string.js:607:11)
    at SchemaType.applySetters (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\schemaType.js:1258:12)
    at Proxy._cast (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\types\array\methods\index.js:250:43)
    at Proxy._mapCast (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\types\array\methods\index.js:263:17)
    at Arguments.map (<anonymous>)
    at Proxy.push (C:\Users\Erez\Desktop\dream-team\node_modules\mongoose\lib\types\array\methods\index.js:697:21)
    at DynamicWorkflowHandler.executeNextStep (webpack-internal:///(rsc)/./lib/bmad/engine/DynamicWorkflowHandler.js:166:29)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async DynamicWorkflowHandler.handleRegularStep (webpack-internal:///(rsc)/./lib/bmad/engine/DynamicWorkflowHandler.js:251:24)
    at async WorkflowStateManager.resumeWorkflowWithElicitation (webpack-internal:///(rsc)/./lib/bmad/services/WorkflowStateManager.js:237:21)
    at async BmadOrchestrator.resumeWorkflowWithElicitation (webpack-internal:///(rsc)/./lib/bmad/BmadOrchestrator.js:288:28)
    at async POST (webpack-internal:///(rsc)/./app/api/workflows/[workflowId]/resume-elicitation/route.js:65:24)
    at async AppRouteRouteModule.do (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\compiled\next-server\app-route.runtime.dev.js:5:38782)
    at async AppRouteRouteModule.handle (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\compiled\next-server\app-route.runtime.dev.js:5:45984)
    at async responseGenerator (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&page=%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute.js&appDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D&isGlobalNotFoundEnabled=!:203:38)
    at async AppRouteRouteModule.handleResponse (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\compiled\next-server\app-route.runtime.dev.js:1:183692)    
    at async handleResponse (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&page=%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute.js&appDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D&isGlobalNotFoundEnabled=!:265:32)
    at async handler (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&page=%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fworkflows%2F%5BworkflowId%5D%2Fresume-elicitation%2Froute.js&appDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CErez%5CDesktop%5Cdream-team&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D&isGlobalNotFoundEnabled=!:317:13)
    at async doRender (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:1587:34)
    at async DevServer.renderToResponseWithComponentsImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:1929:13)
    at async DevServer.renderPageComponent (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:2395:24)
    at async DevServer.renderToResponseImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:2435:32)
    at async DevServer.pipeImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:1035:25)
    at async NextNodeServer.handleCatchallRenderRequest (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\next-server.js:393:17)
    at async DevServer.handleRequestImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\base-server.js:925:17)
    at async C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\dev\next-dev-server.js:398:20
    at async Span.traceAsyncFn (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\trace\trace.js:157:20)
    at async DevServer.handleRequest (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\dev\next-dev-server.js:394:24)
    at async invokeRender (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\lib\router-server.js:239:21)
    at async handleRequest (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\lib\router-server.js:436:24)
    at async requestHandlerImpl (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\lib\router-server.js:464:13)
    at async Server.requestListener (C:\Users\Erez\Desktop\dream-team\node_modules\next\dist\server\lib\start-server.js:218:13)
 POST /api/workflows/workflow_1754822257953_7na578m/resume-elicitation 500 in 50473ms