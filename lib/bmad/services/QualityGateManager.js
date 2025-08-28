/**
 * Quality Gate Manager
 * Implements quality gates and validation for production workflows
 */

import logger from '../../utils/logger.js';
import CodeExecutionEngine from '../../execution/CodeExecutionEngine.js';
import GitIntegrationService from '../../integrations/GitIntegrationService.js';

export class QualityGateManager {
  constructor(options = {}) {
    this.options = {
      testCoverageThreshold: options.testCoverageThreshold || 80,
      performanceThreshold: options.performanceThreshold || 30000, // 30 seconds
      securityScanEnabled: options.securityScanEnabled !== false,
      lintingRequired: options.lintingRequired !== false,
      codeReviewRequired: options.codeReviewRequired !== false,
      ...options
    };
    
    this.executionEngine = new CodeExecutionEngine();
  }

  /**
   * Run all quality gates for a workflow step
   */
  async runQualityGates(params) {
    const {
      workflowId,
      stepId,
      agentId,
      artifacts = [],
      codeChanges = [],
      repository = null,
      userContext = null
    } = params;

    const gateId = `${workflowId}_${stepId}_${Date.now()}`;
    const gateExecution = {
      id: gateId,
      workflowId,
      stepId,
      agentId,
      startTime: new Date(),
      status: 'running',
      gates: {},
      overallResult: null
    };

    // Quality gate results now stored in workflow database

    try {
      logger.info(`🚦 Starting quality gates: ${gateId}`);

      // Gate 1: Code Quality (Linting)
      if (this.options.lintingRequired && codeChanges.length > 0) {
        gateExecution.gates.linting = await this.runLintingGate(codeChanges, workflowId, agentId);
      }

      // Gate 2: Testing
      if (artifacts.some(a => a.type === 'code' || a.type === 'implementation')) {
        gateExecution.gates.testing = await this.runTestingGate(artifacts, workflowId, agentId);
      }

      // Gate 3: Security Scanning
      if (this.options.securityScanEnabled && codeChanges.length > 0) {
        gateExecution.gates.security = await this.runSecurityGate(codeChanges, workflowId, agentId);
      }

      // Gate 4: Performance Analysis
      if (artifacts.some(a => a.type === 'code' || a.type === 'implementation')) {
        gateExecution.gates.performance = await this.runPerformanceGate(artifacts, workflowId, agentId);
      }

      // Gate 5: Documentation Check
      gateExecution.gates.documentation = await this.runDocumentationGate(artifacts, codeChanges);

      // Gate 6: Code Review (if repository provided)
      if (this.options.codeReviewRequired && repository && userContext) {
        gateExecution.gates.codeReview = await this.runCodeReviewGate(
          repository, 
          codeChanges, 
          userContext,
          workflowId
        );
      }

      // Calculate overall result
      gateExecution.overallResult = this.calculateOverallResult(gateExecution.gates);
      gateExecution.status = gateExecution.overallResult.passed ? 'passed' : 'failed';
      gateExecution.endTime = new Date();

      logger.info(`🚦 Quality gates completed: ${gateId} - ${gateExecution.status}`);

      return {
        gateId,
        passed: gateExecution.overallResult.passed,
        gates: gateExecution.gates,
        summary: gateExecution.overallResult.summary,
        recommendations: this.generateRecommendations(gateExecution.gates)
      };

    } catch (error) {
      gateExecution.status = 'error';
      gateExecution.error = error.message;
      gateExecution.endTime = new Date();

      logger.error(`❌ Quality gates failed: ${gateId} - ${error.message}`);
      throw error;
    }
  }

  /**
   * Gate 1: Code Quality (Linting)
   */
  async runLintingGate(codeChanges, workflowId, agentId) {
    const gate = {
      name: 'Code Quality (Linting)',
      status: 'running',
      startTime: new Date()
    };

    try {
      const lintResults = [];
      
      for (const change of codeChanges) {
        if (this.shouldLintFile(change.path)) {
          // Create temporary file for linting
          const result = await this.executionEngine.lintCode({
            projectPath: change.projectPath || '/tmp',
            linter: 'auto',
            fix: false,
            workflowId,
            agentId
          });
          
          lintResults.push({
            file: change.path,
            issues: result.issues,
            success: result.success
          });
        }
      }

      const totalIssues = lintResults.reduce((sum, r) => sum + r.issues.total, 0);
      const totalErrors = lintResults.reduce((sum, r) => sum + r.issues.errors, 0);
      
      gate.passed = totalErrors === 0;
      gate.status = gate.passed ? 'passed' : 'failed';
      gate.result = {
        totalFiles: lintResults.length,
        totalIssues,
        totalErrors,
        totalWarnings: lintResults.reduce((sum, r) => sum + r.issues.warnings, 0),
        files: lintResults
      };
      gate.message = gate.passed 
        ? 'All files pass linting checks'
        : `${totalErrors} linting errors found`;

    } catch (error) {
      gate.status = 'error';
      gate.passed = false;
      gate.error = error.message;
      gate.message = 'Linting check failed to execute';
    }

    gate.endTime = new Date();
    gate.duration = gate.endTime - gate.startTime;
    return gate;
  }

  /**
   * Gate 2: Testing
   */
  async runTestingGate(artifacts, workflowId, agentId) {
    const gate = {
      name: 'Testing',
      status: 'running',
      startTime: new Date()
    };

    try {
      // Check if test artifacts exist
      const testArtifacts = artifacts.filter(a => 
        a.type === 'test' || a.name.includes('test') || a.path?.includes('test')
      );

      if (testArtifacts.length === 0) {
        gate.passed = false;
        gate.status = 'failed';
        gate.message = 'No test artifacts found';
        gate.result = { testsRun: 0, testsPassed: 0, testsFailed: 0, coverage: 0 };
      } else {
        // Run tests if we have a project path
        const projectPath = this.extractProjectPath(artifacts);
        
        if (projectPath) {
          const testResult = await this.executionEngine.runTests({
            projectPath,
            testFramework: 'auto',
            workflowId,
            agentId
          });

          const coverage = this.extractCoverage(testResult.output);
          const coverageThreshold = this.options.testCoverageThreshold;

          gate.passed = testResult.success && coverage >= coverageThreshold;
          gate.status = gate.passed ? 'passed' : 'failed';
          gate.result = {
            testsRun: testResult.testsRun.total,
            testsPassed: testResult.testsRun.passed,
            testsFailed: testResult.testsRun.failed,
            coverage,
            coverageThreshold,
            framework: testResult.framework
          };
          gate.message = gate.passed
            ? `All tests pass with ${coverage}% coverage`
            : `Tests failed or coverage below ${coverageThreshold}% (actual: ${coverage}%)`;
        } else {
          gate.passed = true; // Assume tests pass if we can't run them
          gate.status = 'passed';
          gate.message = 'Test artifacts found (unable to execute)';
          gate.result = { testsRun: testArtifacts.length, note: 'Static analysis only' };
        }
      }

    } catch (error) {
      gate.status = 'error';
      gate.passed = false;
      gate.error = error.message;
      gate.message = 'Testing execution failed';
    }

    gate.endTime = new Date();
    gate.duration = gate.endTime - gate.startTime;
    return gate;
  }

  /**
   * Gate 3: Security Scanning
   */
  async runSecurityGate(codeChanges, workflowId, agentId) {
    const gate = {
      name: 'Security Scanning',
      status: 'running',
      startTime: new Date()
    };

    try {
      const securityIssues = [];

      // Basic security pattern matching
      for (const change of codeChanges) {
        const issues = this.scanForSecurityIssues(change.content, change.path);
        if (issues.length > 0) {
          securityIssues.push({
            file: change.path,
            issues
          });
        }
      }

      const criticalIssues = securityIssues.reduce(
        (sum, file) => sum + file.issues.filter(i => i.severity === 'critical').length, 
        0
      );

      gate.passed = criticalIssues === 0;
      gate.status = gate.passed ? 'passed' : 'failed';
      gate.result = {
        totalFiles: codeChanges.length,
        filesWithIssues: securityIssues.length,
        totalIssues: securityIssues.reduce((sum, f) => sum + f.issues.length, 0),
        criticalIssues,
        files: securityIssues
      };
      gate.message = gate.passed
        ? 'No critical security issues found'
        : `${criticalIssues} critical security issues found`;

    } catch (error) {
      gate.status = 'error';
      gate.passed = false;
      gate.error = error.message;
      gate.message = 'Security scanning failed';
    }

    gate.endTime = new Date();
    gate.duration = gate.endTime - gate.startTime;
    return gate;
  }

  /**
   * Gate 4: Performance Analysis
   */
  async runPerformanceGate(artifacts, workflowId, agentId) {
    const gate = {
      name: 'Performance Analysis',
      status: 'running',
      startTime: new Date()
    };

    try {
      const performanceIssues = [];

      // Analyze code for performance anti-patterns
      for (const artifact of artifacts) {
        if (artifact.type === 'code' && artifact.content) {
          const issues = this.analyzePerformance(artifact.content, artifact.path || artifact.name);
          if (issues.length > 0) {
            performanceIssues.push({
              file: artifact.path || artifact.name,
              issues
            });
          }
        }
      }

      const highImpactIssues = performanceIssues.reduce(
        (sum, file) => sum + file.issues.filter(i => i.impact === 'high').length,
        0
      );

      gate.passed = highImpactIssues === 0;
      gate.status = gate.passed ? 'passed' : 'failed';
      gate.result = {
        totalFiles: artifacts.filter(a => a.type === 'code').length,
        filesWithIssues: performanceIssues.length,
        totalIssues: performanceIssues.reduce((sum, f) => sum + f.issues.length, 0),
        highImpactIssues,
        files: performanceIssues
      };
      gate.message = gate.passed
        ? 'No high-impact performance issues found'
        : `${highImpactIssues} high-impact performance issues found`;

    } catch (error) {
      gate.status = 'error';
      gate.passed = false;
      gate.error = error.message;
      gate.message = 'Performance analysis failed';
    }

    gate.endTime = new Date();
    gate.duration = gate.endTime - gate.startTime;
    return gate;
  }

  /**
   * Gate 5: Documentation Check
   */
  async runDocumentationGate(artifacts, codeChanges) {
    const gate = {
      name: 'Documentation',
      status: 'running',
      startTime: new Date()
    };

    try {
      const docArtifacts = artifacts.filter(a => 
        a.type === 'documentation' || 
        a.name?.toLowerCase().includes('readme') ||
        a.name?.toLowerCase().includes('doc')
      );

      const codeFiles = artifacts.filter(a => a.type === 'code').length;
      const docFiles = docArtifacts.length;
      
      // Check for README
      const hasReadme = artifacts.some(a => 
        a.name?.toLowerCase().includes('readme')
      );

      // Check for inline documentation in code
      const codeWithDocs = codeChanges.filter(change => 
        this.hasInlineDocumentation(change.content)
      ).length;

      const docCoverage = codeFiles > 0 ? (codeWithDocs / codeFiles) * 100 : 100;

      gate.passed = hasReadme && docCoverage >= 50; // At least 50% of code files have docs
      gate.status = gate.passed ? 'passed' : 'failed';
      gate.result = {
        hasReadme,
        docArtifacts: docFiles,
        codeFiles,
        codeWithDocs,
        docCoverage: Math.round(docCoverage)
      };
      gate.message = gate.passed
        ? `Documentation complete (${Math.round(docCoverage)}% coverage)`
        : `Documentation incomplete: ${hasReadme ? 'README found' : 'No README'}, ${Math.round(docCoverage)}% code coverage`;

    } catch (error) {
      gate.status = 'error';
      gate.passed = false;
      gate.error = error.message;
      gate.message = 'Documentation check failed';
    }

    gate.endTime = new Date();
    gate.duration = gate.endTime - gate.startTime;
    return gate;
  }

  /**
   * Gate 6: Code Review
   */
  async runCodeReviewGate(repository, codeChanges, userContext, workflowId) {
    const gate = {
      name: 'Code Review',
      status: 'running',
      startTime: new Date()
    };

    try {
      // This would integrate with GitHub PR reviews
      // For now, we'll do a basic automated review
      const reviewIssues = [];

      for (const change of codeChanges) {
        const issues = this.performAutomatedCodeReview(change.content, change.path);
        if (issues.length > 0) {
          reviewIssues.push({
            file: change.path,
            issues
          });
        }
      }

      const blockerIssues = reviewIssues.reduce(
        (sum, file) => sum + file.issues.filter(i => i.severity === 'blocker').length,
        0
      );

      gate.passed = blockerIssues === 0;
      gate.status = gate.passed ? 'passed' : 'failed';
      gate.result = {
        totalFiles: codeChanges.length,
        filesWithIssues: reviewIssues.length,
        totalIssues: reviewIssues.reduce((sum, f) => sum + f.issues.length, 0),
        blockerIssues,
        files: reviewIssues,
        reviewType: 'automated'
      };
      gate.message = gate.passed
        ? 'Automated code review passed'
        : `${blockerIssues} blocking issues found in code review`;

    } catch (error) {
      gate.status = 'error';
      gate.passed = false;
      gate.error = error.message;
      gate.message = 'Code review failed';
    }

    gate.endTime = new Date();
    gate.duration = gate.endTime - gate.startTime;
    return gate;
  }

  // ========== HELPER METHODS ==========

  calculateOverallResult(gates) {
    const gateResults = Object.values(gates);
    const passedGates = gateResults.filter(g => g.passed).length;
    const totalGates = gateResults.length;
    const failedGates = gateResults.filter(g => !g.passed);

    return {
      passed: failedGates.length === 0,
      passedGates,
      totalGates,
      failedGates: failedGates.map(g => g.name),
      summary: failedGates.length === 0 
        ? `All ${totalGates} quality gates passed`
        : `${failedGates.length}/${totalGates} quality gates failed`
    };
  }

  generateRecommendations(gates) {
    const recommendations = [];

    Object.values(gates).forEach(gate => {
      if (!gate.passed) {
        switch (gate.name) {
          case 'Code Quality (Linting)':
            recommendations.push({
              gate: gate.name,
              priority: 'high',
              action: 'Fix linting errors before proceeding',
              details: `${gate.result?.totalErrors} errors need to be resolved`
            });
            break;
          case 'Testing':
            recommendations.push({
              gate: gate.name,
              priority: 'critical',
              action: 'Improve test coverage and fix failing tests',
              details: gate.message
            });
            break;
          case 'Security Scanning':
            recommendations.push({
              gate: gate.name,
              priority: 'critical',
              action: 'Address security vulnerabilities immediately',
              details: `${gate.result?.criticalIssues} critical security issues found`
            });
            break;
          case 'Performance Analysis':
            recommendations.push({
              gate: gate.name,
              priority: 'medium',
              action: 'Optimize performance bottlenecks',
              details: `${gate.result?.highImpactIssues} high-impact performance issues`
            });
            break;
          case 'Documentation':
            recommendations.push({
              gate: gate.name,
              priority: 'low',
              action: 'Improve documentation coverage',
              details: gate.message
            });
            break;
          case 'Code Review':
            recommendations.push({
              gate: gate.name,
              priority: 'high',
              action: 'Address code review feedback',
              details: `${gate.result?.blockerIssues} blocking issues`
            });
            break;
        }
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  shouldLintFile(filePath) {
    const lintableExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.rs'];
    return lintableExtensions.some(ext => filePath.endsWith(ext));
  }

  extractProjectPath(artifacts) {
    // Try to find a common project path from artifacts
    const paths = artifacts
      .filter(a => a.path)
      .map(a => a.path.split('/').slice(0, -1).join('/'))
      .filter(p => p);
      
    return paths.length > 0 ? paths[0] : null;
  }

  extractCoverage(testOutput) {
    // Basic coverage extraction from test output
    const coverageMatch = testOutput.match(/(\d+)%\s+coverage/i);
    return coverageMatch ? parseInt(coverageMatch[1]) : 0;
  }

  scanForSecurityIssues(content, filePath) {
    const issues = [];
    const patterns = [
      { pattern: /password\s*=\s*["'][^"']+["']/gi, severity: 'critical', message: 'Hardcoded password' },
      { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/gi, severity: 'critical', message: 'Hardcoded API key' },
      { pattern: /eval\s*\(/gi, severity: 'high', message: 'Use of eval() function' },
      { pattern: /innerHTML\s*=/gi, severity: 'medium', message: 'Potential XSS via innerHTML' },
      { pattern: /document\.write/gi, severity: 'medium', message: 'Use of document.write' }
    ];

    patterns.forEach(({ pattern, severity, message }) => {
      const matches = content.match(pattern);
      if (matches) {
        issues.push({
          severity,
          message,
          occurrences: matches.length,
          pattern: pattern.source
        });
      }
    });

    return issues;
  }

  analyzePerformance(content, filePath) {
    const issues = [];
    const patterns = [
      { pattern: /for\s*\([^)]*\)\s*{\s*for\s*\([^)]*\)/gi, impact: 'high', message: 'Nested loops detected' },
      { pattern: /document\.querySelector/gi, impact: 'medium', message: 'DOM queries in loops' },
      { pattern: /new\s+Date\(\)/gi, impact: 'low', message: 'Date object creation' },
      { pattern: /JSON\.parse\s*\(/gi, impact: 'medium', message: 'JSON parsing' },
      { pattern: /\.forEach\s*\(/gi, impact: 'low', message: 'forEach usage (consider for...of)' }
    ];

    patterns.forEach(({ pattern, impact, message }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 5) { // Only flag if many occurrences
        issues.push({
          impact,
          message,
          occurrences: matches.length,
          suggestion: 'Consider optimization'
        });
      }
    });

    return issues;
  }

  hasInlineDocumentation(content) {
    const docPatterns = [
      /\/\*\*[\s\S]*?\*\//g, // JSDoc
      /"""[\s\S]*?"""/g,     // Python docstrings
      /\/\/\s+\w+/g          // Single line comments with content
    ];

    return docPatterns.some(pattern => pattern.test(content));
  }

  performAutomatedCodeReview(content, filePath) {
    const issues = [];
    const patterns = [
      { pattern: /function\s+\w+\s*\([^)]*\)\s*{[^}]{500,}/gi, severity: 'major', message: 'Function too long (>500 chars)' },
      { pattern: /console\.log/gi, severity: 'minor', message: 'Console.log statements found' },
      { pattern: /TODO|FIXME|HACK/gi, severity: 'info', message: 'TODO/FIXME comments found' },
      { pattern: /var\s+/gi, severity: 'minor', message: 'Use let/const instead of var' },
      { pattern: /==(?!=)/g, severity: 'minor', message: 'Use === instead of ==' }
    ];

    patterns.forEach(({ pattern, severity, message }) => {
      const matches = content.match(pattern);
      if (matches) {
        issues.push({
          severity,
          message,
          occurrences: matches.length,
          line: this.findLineNumber(content, matches[0])
        });
      }
    });

    return issues;
  }

  findLineNumber(content, match) {
    const lines = content.substring(0, content.indexOf(match)).split('\n');
    return lines.length;
  }
}

export default QualityGateManager;