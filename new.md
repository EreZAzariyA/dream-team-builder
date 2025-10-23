 GET /repo-explorer?repo=EreZAzariyA%2Frecruiter-ai&id=1021314451 200 in 326ms
 ○ Compiling /api/repo/regenerate-summary ...
 ✓ Compiled /api/repo/regenerate-summary in 1507ms (4199 modules)
2025-10-22 11:58:23 info:       Regenerating AI summary for analysis: 68f893f91608f27a916ee941
2025-10-22 11:58:23 info:       🤖 Loaded 10 agents total
2025-10-22 11:58:24 info:       📚 Loaded user API keys from database
2025-10-22 11:58:24 info:       ✅ Gemini AI initialized (user key)
2025-10-22 11:58:24 info:       🔑 Initializing Gemini provider with API key: AIzaSyAHFo...
2025-10-22 11:58:24 info:       ✅ AI SDK Gemini provider initialized
2025-10-22 11:58:24 info:       ✅ AI SDK Service initialized
2025-10-22 11:58:24 info:       🔧 AI Service initialized - health checks will be performed on-demand
2025-10-22 11:58:24 info:       🤖 Generating AI summary with Analyst agent (with file access tools): {"agent":"Mary","agentTitle":"Business Analyst","promptLength":3424,"repository":"EreZAzariyA/recruiter-ai","fileCount":133,"topLanguages":"Markdown (60.4%), YAML (27.9%), TypeScript (10.7%), JSON (0.8%), CSS (0.2%)","userId":"68e7771cf3c767a1c31ee846"}
2025-10-22 11:58:24 info:       🔧 Set tool execution context for user: 68e7771cf3c767a1c31ee846
2025-10-22 11:58:24 info:       🗂️ Set repository context: EreZAzariyA/recruiter-ai
2025-10-22 11:58:24 info:       ✅ Connected to Redis successfully via ioredis.
2025-10-22 11:58:24 info:       🛠️ Starting tool-enabled AI call for user: 68e7771cf3c767a1c31ee846
2025-10-22 11:58:24 info:       🔧 Set tool execution context for user: 68e7771cf3c767a1c31ee846
2025-10-22 11:58:24 info:       🗂️ Set repository context: EreZAzariyA/recruiter-ai
2025-10-22 11:58:24 info:       🗂️ Set repository context: EreZAzariyA/recruiter-ai
2025-10-22 11:58:24 info:       🔑 Updating AISdkService with keys: gemini=true, openai=false
2025-10-22 11:58:24 info:       🔑 AISdkService.updateApiKeys called with: gemini=true, openai=false
2025-10-22 11:58:24 info:       🔑 Current keys after update: gemini=true, openai=false
2025-10-22 11:58:24 info:       🔑 Initializing Gemini provider with API key: AIzaSyAHFo...
2025-10-22 11:58:24 info:       ✅ AI SDK Gemini provider initialized
2025-10-22 11:58:24 info:       🔄 AI SDK providers updated with new API keys
2025-10-22 11:58:24 info:       🔑 Getting Gemini model with provider function
2025-10-22 11:58:24 info:       🛠️ Generating with tools using auto provider
 GET /repo-explorer?repo=EreZAzariyA%2Frecruiter-ai&id=1021314451 200 in 666ms
2025-10-22 11:58:28 info:       🔒 Validating security for tool: readFile, user: 68e7771cf3c767a1c31ee846
2025-10-22 11:58:28 error:      ❌ File path validation failed for readFile:
2025-10-22 11:58:28 error: Error: Invalid file path for readFile. Expected string, received: undefined
    at validateToolSecurity (webpack-internal:///(rsc)/./lib/ai/tools/toolExecutor.js:119:19)
    at Object.execute (webpack-internal:///(rsc)/./lib/ai/tools/toolExecutor.js:213:13)
    at Object.execute (webpack-internal:///(rsc)/./lib/ai/tools/index.js:24:93)
    at executeTool (webpack-internal:///(rsc)/./node_modules/@ai-sdk/provider-utils/dist/index.mjs:1098:18)
    at executeTool.next (<anonymous>)