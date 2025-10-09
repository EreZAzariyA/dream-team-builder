/**
 * Code Execution Engine
 * Provides secure, isolated code execution for workflow-driven development
 * Supports multiple runtime environments and execution contexts
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import logger from '../utils/logger.js';
import { redisService } from '../utils/redis.js';

const execAsync = promisify(exec);

export class CodeExecutionEngine {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 300000, // 5 minutes default
      maxMemory: options.maxMemory || '1g',
      allowedCommands: options.allowedCommands || this.getDefaultAllowedCommands(),
      workspaceRoot: options.workspaceRoot || path.join(os.tmpdir(), 'bmad-execution'),
      enableDocker: options.enableDocker || false,
      ...options
    };

    // Redis keys:
    // execution:active:{executionId} - Active execution state (5min TTL)
    // execution:history:{workflowId} - Execution history per workflow (24h TTL)

    if (!redisService.isAvailable()) {
      logger.warn('⚠️  CodeExecutionEngine: Redis not configured - execution tracking will be limited');
    }
  }

  /**
   * Execute code in a specific runtime environment
   */
  async executeCode(params) {
    const {
      code,
      language,
      runtime = 'node',
      workflowId,
      agentId,
      context = {},
      files = [],
      dependencies = []
    } = params;

    const executionId = this.generateExecutionId();
    const execution = {
      id: executionId,
      workflowId,
      agentId,
      language,
      runtime,
      startTime: new Date(),
      status: 'running'
    };

    // Store active execution in Redis with TTL
    if (redisService.isAvailable()) {
      await redisService.set(`execution:active:${executionId}`, execution, 300); // 5 min TTL
    }

    try {
      logger.info(`🚀 Starting code execution: ${executionId}`);
      
      // Create isolated workspace
      const workspace = await this.createWorkspace(executionId, files);
      
      // Install dependencies if needed
      if (dependencies.length > 0) {
        await this.installDependencies(workspace, dependencies, runtime);
      }
      
      // Execute code based on runtime
      const result = await this.executeInRuntime(code, language, runtime, workspace, context);
      
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.result = result;

      logger.info(`✅ Code execution completed: ${executionId}`);

      // Cleanup workspace
      await this.cleanupWorkspace(workspace);

      return {
        executionId,
        success: true,
        ...result
      };

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error.message;

      logger.error(`❌ Code execution failed: ${executionId} - ${error.message}`);

      throw {
        executionId,
        success: false,
        error: error.message,
        code: error.code || 'EXECUTION_ERROR'
      };
    } finally {
      // Update execution in Redis and move to history
      if (redisService.isAvailable()) {
        // Remove from active
        await redisService.del(`execution:active:${executionId}`);

        // Add to history (keep last 100 per workflow)
        if (workflowId) {
          const historyKey = `execution:history:${workflowId}`;
          const history = (await redisService.get(historyKey)) || [];
          history.push(execution);

          // Keep only last 100 executions
          if (history.length > 100) {
            history.splice(0, history.length - 100);
          }

          await redisService.set(historyKey, history, 86400); // 24h TTL
        }
      }
    }
  }

  /**
   * Run tests for a project
   */
  async runTests(params) {
    const {
      projectPath,
      testFramework = 'auto',
      testPattern = '**/*.test.js',
      workflowId,
      agentId
    } = params;

    try {
      // Detect test framework if auto
      const detectedFramework = testFramework === 'auto' 
        ? await this.detectTestFramework(projectPath)
        : testFramework;

      const testCommand = this.getTestCommand(detectedFramework, testPattern);
      
      const result = await this.executeCommand({
        command: testCommand,
        workingDirectory: projectPath,
        workflowId,
        agentId,
        timeout: this.options.timeout
      });

      return {
        success: result.exitCode === 0,
        framework: detectedFramework,
        output: result.stdout,
        errors: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
        testsRun: this.parseTestResults(result.stdout, detectedFramework)
      };
      
    } catch (error) {
      logger.error(`❌ Test execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build a project
   */
  async buildProject(params) {
    const {
      projectPath,
      buildTool = 'auto',
      buildTarget = 'default',
      workflowId,
      agentId
    } = params;

    try {
      // Detect build tool if auto
      const detectedTool = buildTool === 'auto'
        ? await this.detectBuildTool(projectPath)
        : buildTool;

      const buildCommand = this.getBuildCommand(detectedTool, buildTarget);
      
      const result = await this.executeCommand({
        command: buildCommand,
        workingDirectory: projectPath,
        workflowId,
        agentId,
        timeout: this.options.timeout * 2 // Builds can take longer
      });

      return {
        success: result.exitCode === 0,
        tool: detectedTool,
        target: buildTarget,
        output: result.stdout,
        errors: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
        artifacts: await this.findBuildArtifacts(projectPath, detectedTool)
      };
      
    } catch (error) {
      logger.error(`❌ Build failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lint code
   */
  async lintCode(params) {
    const {
      projectPath,
      linter = 'auto',
      fix = false,
      workflowId,
      agentId
    } = params;

    try {
      const detectedLinter = linter === 'auto'
        ? await this.detectLinter(projectPath)
        : linter;

      const lintCommand = this.getLintCommand(detectedLinter, fix);
      
      const result = await this.executeCommand({
        command: lintCommand,
        workingDirectory: projectPath,
        workflowId,
        agentId,
        timeout: 60000 // 1 minute for linting
      });

      return {
        success: result.exitCode === 0,
        linter: detectedLinter,
        fixed: fix,
        output: result.stdout,
        errors: result.stderr,
        exitCode: result.exitCode,
        issues: this.parseLintResults(result.stdout, detectedLinter)
      };
      
    } catch (error) {
      logger.error(`❌ Linting failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a command with security restrictions
   */
  async executeCommand(params) {
    const {
      command,
      workingDirectory = process.cwd(),
      environment = {},
      timeout = this.options.timeout,
      workflowId,
      agentId
    } = params;

    // Security check
    if (!this.isCommandAllowed(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    const startTime = Date.now();
    
    try {
      const result = await execAsync(command, {
        cwd: workingDirectory,
        env: { ...process.env, ...environment },
        timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      const duration = Date.now() - startTime;
      
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        duration,
        command,
        workingDirectory
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        duration,
        command,
        workingDirectory,
        error: error.message
      };
    }
  }

  /**
   * Get active execution by ID
   */
  async getActiveExecution(executionId) {
    if (!redisService.isAvailable()) {
      return null;
    }
    return await redisService.get(`execution:active:${executionId}`);
  }

  /**
   * Get all active executions
   */
  async getActiveExecutions() {
    if (!redisService.isAvailable()) {
      return [];
    }

    const keys = await redisService.keys('execution:active:*');
    const executions = [];

    for (const key of keys) {
      const execution = await redisService.get(key);
      if (execution) {
        executions.push(execution);
      }
    }

    return executions;
  }

  /**
   * Get execution history for a workflow
   */
  async getExecutionHistory(workflowId) {
    if (!redisService.isAvailable()) {
      return [];
    }
    return (await redisService.get(`execution:history:${workflowId}`)) || [];
  }

  // ========== PRIVATE HELPER METHODS ==========

  generateExecutionId() {
    return `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  async createWorkspace(executionId, files = []) {
    const workspacePath = path.join(this.options.workspaceRoot, executionId);
    await fs.mkdir(workspacePath, { recursive: true });
    
    // Create files in workspace
    for (const file of files) {
      const filePath = path.join(workspacePath, file.path);
      const fileDir = path.dirname(filePath);
      
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf8');
    }
    
    return workspacePath;
  }

  async cleanupWorkspace(workspacePath) {
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
    } catch (error) {
      logger.warn(`⚠️ Failed to cleanup workspace: ${workspacePath}`);
    }
  }

  async installDependencies(workspace, dependencies, runtime) {
    const installCommands = {
      node: `cd ${workspace} && npm install ${dependencies.join(' ')}`,
      python: `cd ${workspace} && pip install ${dependencies.join(' ')}`,
      go: `cd ${workspace} && go mod tidy`,
      java: `cd ${workspace} && mvn dependency:resolve`
    };

    const command = installCommands[runtime];
    if (!command) {
      throw new Error(`Dependency installation not supported for runtime: ${runtime}`);
    }

    await execAsync(command, { timeout: 120000 }); // 2 minutes for dependencies
  }

  async executeInRuntime(code, language, runtime, workspace, context) {
    const runtimeHandlers = {
      node: () => this.executeNodeJS(code, workspace, context),
      python: () => this.executePython(code, workspace, context),
      shell: () => this.executeShell(code, workspace, context),
      docker: () => this.executeDocker(code, language, workspace, context)
    };

    const handler = runtimeHandlers[runtime];
    if (!handler) {
      throw new Error(`Runtime not supported: ${runtime}`);
    }

    return await handler();
  }

  async executeNodeJS(code, workspace, context) {
    const scriptPath = path.join(workspace, 'script.js');
    
    // Wrap code with context injection
    const wrappedCode = `
const context = ${JSON.stringify(context)};
const console = {
  log: (...args) => process.stdout.write(args.join(' ') + '\\n'),
  error: (...args) => process.stderr.write(args.join(' ') + '\\n')
};

${code}
`;

    await fs.writeFile(scriptPath, wrappedCode);
    
    return await execAsync(`node ${scriptPath}`, {
      cwd: workspace,
      timeout: this.options.timeout
    });
  }

  async executePython(code, workspace, context) {
    const scriptPath = path.join(workspace, 'script.py');
    
    const wrappedCode = `
import json
import sys

context = ${JSON.stringify(context)}

${code}
`;

    await fs.writeFile(scriptPath, wrappedCode);
    
    return await execAsync(`python3 ${scriptPath}`, {
      cwd: workspace,
      timeout: this.options.timeout
    });
  }

  async executeShell(code, workspace, context) {
    const scriptPath = path.join(workspace, 'script.sh');
    
    await fs.writeFile(scriptPath, code);
    await fs.chmod(scriptPath, '755');
    
    return await execAsync(`bash ${scriptPath}`, {
      cwd: workspace,
      timeout: this.options.timeout
    });
  }

  async executeDocker(code, language, workspace, context) {
    if (!this.options.enableDocker) {
      throw new Error('Docker execution not enabled');
    }

    const containerName = `bmad-exec-${Date.now()}`;
    const dockerImage = this.getDockerImage(language);
    
    // Implementation for Docker execution would go here
    throw new Error('Docker execution not yet implemented');
  }

  async detectTestFramework(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.jest) return 'jest';
      if (deps.mocha) return 'mocha';
      if (deps.vitest) return 'vitest';
      if (deps.cypress) return 'cypress';
      
      return 'node'; // Default to basic node execution
    } catch {
      return 'node';
    }
  }

  async detectBuildTool(projectPath) {
    const files = await fs.readdir(projectPath);
    
    if (files.includes('package.json')) return 'npm';
    if (files.includes('Makefile')) return 'make';
    if (files.includes('Dockerfile')) return 'docker';
    if (files.includes('pom.xml')) return 'maven';
    if (files.includes('build.gradle')) return 'gradle';
    
    return 'custom';
  }

  async detectLinter(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.eslint) return 'eslint';
      if (deps.prettier) return 'prettier';
      if (deps.tslint) return 'tslint';
      
      return 'none';
    } catch {
      return 'none';
    }
  }

  getTestCommand(framework, pattern) {
    const commands = {
      jest: `jest ${pattern}`,
      mocha: `mocha ${pattern}`,
      vitest: `vitest run`,
      cypress: `cypress run`,
      node: `node -e "console.log('No tests configured')"`
    };
    
    return commands[framework] || commands.node;
  }

  getBuildCommand(tool, target) {
    const commands = {
      npm: 'npm run build',
      make: `make ${target}`,
      maven: 'mvn compile',
      gradle: './gradlew build',
      docker: 'docker build .',
      custom: 'echo "No build tool detected"'
    };
    
    return commands[tool] || commands.custom;
  }

  getLintCommand(linter, fix) {
    const commands = {
      eslint: `eslint . ${fix ? '--fix' : ''}`,
      prettier: `prettier --check . ${fix ? '--write' : ''}`,
      tslint: `tslint -p . ${fix ? '--fix' : ''}`,
      none: 'echo "No linter configured"'
    };
    
    return commands[linter] || commands.none;
  }

  async findBuildArtifacts(projectPath, tool) {
    const artifactPaths = {
      npm: ['dist', 'build', 'out'],
      maven: ['target'],
      gradle: ['build/libs'],
      docker: ['.'] // Docker creates images, not files
    };
    
    const paths = artifactPaths[tool] || [];
    const artifacts = [];
    
    for (const artifactPath of paths) {
      const fullPath = path.join(projectPath, artifactPath);
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          const files = await fs.readdir(fullPath);
          artifacts.push(...files.map(f => path.join(artifactPath, f)));
        }
      } catch {
        // Path doesn't exist, skip
      }
    }
    
    return artifacts;
  }

  parseTestResults(output, framework) {
    // Basic parsing - could be enhanced for each framework
    const passMatch = output.match(/(\d+) passing/);
    const failMatch = output.match(/(\d+) failing/);
    
    return {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
      total: (passMatch ? parseInt(passMatch[1]) : 0) + (failMatch ? parseInt(failMatch[1]) : 0)
    };
  }

  parseLintResults(output, linter) {
    // Basic parsing - could be enhanced for each linter
    const lines = output.split('\n');
    const issues = lines.filter(line => 
      line.includes('error') || line.includes('warning')
    ).length;
    
    return {
      errors: lines.filter(l => l.includes('error')).length,
      warnings: lines.filter(l => l.includes('warning')).length,
      total: issues
    };
  }

  isCommandAllowed(command) {
    const commandBase = command.split(' ')[0];
    return this.options.allowedCommands.includes(commandBase) || 
           this.options.allowedCommands.includes('*');
  }

  getDefaultAllowedCommands() {
    return [
      'node', 'npm', 'npx', 'yarn', 'pnpm',
      'python', 'python3', 'pip', 'pip3',
      'java', 'javac', 'mvn', 'gradle',
      'go', 'cargo', 'rustc',
      'git', 'docker',
      'make', 'cmake',
      'jest', 'mocha', 'vitest', 'cypress',
      'eslint', 'prettier', 'tslint',
      'echo', 'cat', 'ls', 'pwd', 'cd'
    ];
  }

  getDockerImage(language) {
    const images = {
      javascript: 'node:18-alpine',
      typescript: 'node:18-alpine',
      python: 'python:3.9-alpine',
      java: 'openjdk:11-alpine',
      go: 'golang:1.19-alpine',
      rust: 'rust:1.65-alpine'
    };
    
    return images[language] || 'alpine:latest';
  }
}

export default CodeExecutionEngine;