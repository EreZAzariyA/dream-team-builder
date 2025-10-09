/**
 * Enhanced Response Validator
 * Provides robust validation, parsing, and error recovery for AI responses
 * 
 * Responsibilities:
 * - Validate response structure and content
 * - Parse different response formats (JSON, Markdown, Plain text)
 * - Sanitize potentially harmful content
 * - Provide fallback handling for malformed responses
 * - Extract structured data from unstructured responses
 */

import logger from '../../utils/logger.js';

class ResponseValidator {
  constructor(options = {}) {
    this.maxContentLength = options.maxContentLength || 50000;
    this.allowedFileExtensions = options.allowedFileExtensions || [
      '.md', '.txt', '.json', '.yaml', '.yml', '.js', '.ts', '.jsx', '.tsx', 
      '.py', '.java', '.cpp', '.h', '.css', '.scss', '.html', '.xml'
    ];
    this.sanitizeContent = options.sanitizeContent !== false;
    this.strictValidation = options.strictValidation || false;
  }

  /**
   * Comprehensive response validation
   */
  async validateResponse(response, expectedFormat = 'auto', context = {}) {
    logger.info(`🔍 [VALIDATION] Validating response, expected format: ${expectedFormat}`);
    
    const validationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      sanitized: false,
      parsedContent: null,
      extractedData: {},
      confidence: 1.0,
      fallbackUsed: false
    };

    try {
      // Step 1: Basic structure validation
      this.validateBasicStructure(response, validationResult);
      
      // Step 2: Content validation
      this.validateContent(response.content, validationResult);
      
      // Step 3: Format-specific validation
      if (expectedFormat !== 'auto') {
        this.validateFormat(response.content, expectedFormat, validationResult);
      }
      
      // Step 4: Security validation
      this.validateSecurity(response.content, validationResult);
      
      // Step 5: Extract structured data
      this.extractStructuredData(response.content, validationResult, context);
      
      // Step 6: Apply fixes and sanitization
      if (validationResult.warnings.length > 0 || validationResult.errors.length > 0) {
        this.attemptAutoFix(response, validationResult);
      }
      
      // Calculate final confidence score
      this.calculateConfidenceScore(validationResult);
      
      logger.info(`✅ [VALIDATION] Response validated - Valid: ${validationResult.isValid}, Confidence: ${validationResult.confidence.toFixed(2)}, Warnings: ${validationResult.warnings.length}, Errors: ${validationResult.errors.length}`);
      
      return validationResult;
      
    } catch (error) {
      logger.error(`❌ [VALIDATION] Validation failed: ${error.message}`);
      
      validationResult.isValid = false;
      validationResult.errors.push(`Validation exception: ${error.message}`);
      validationResult.confidence = 0.1;
      validationResult.fallbackUsed = true;
      validationResult.parsedContent = this.createFallbackContent(response.content, context);
      
      return validationResult;
    }
  }

  /**
   * Validate basic response structure
   */
  validateBasicStructure(response, result) {
    if (!response) {
      result.errors.push('Response is null or undefined');
      result.isValid = false;
      return;
    }

    if (!response.content) {
      result.errors.push('Response missing content field');
      result.isValid = false;
      return;
    }

    if (typeof response.content !== 'string') {
      result.warnings.push('Response content is not a string, attempting conversion');
      response.content = String(response.content);
    }

    if (response.content.length === 0) {
      result.errors.push('Response content is empty');
      result.isValid = false;
      return;
    }

    if (response.content.length > this.maxContentLength) {
      result.warnings.push(`Response content exceeds max length (${this.maxContentLength} chars), will be truncated`);
      response.content = response.content.substring(0, this.maxContentLength) + '...[truncated]';
      result.sanitized = true;
    }
  }

  /**
   * Validate content quality and completeness
   */
  validateContent(content, result) {
    // Check for placeholder text that indicates incomplete generation
    const placeholders = [
      '[YOUR_', '[INSERT_', '[REPLACE_', '[TODO:', '[PLACEHOLDER',
      'Lorem ipsum', 'placeholder', 'FIXME:', 'HACK:', 'XXX:'
    ];
    
    placeholders.forEach(placeholder => {
      if (content.includes(placeholder)) {
        result.warnings.push(`Content contains placeholder: ${placeholder}`);
      }
    });

    // Check for common AI generation artifacts
    const artifacts = [
      'As an AI', 'I cannot', 'I\'m sorry', 'I apologize',
      'As a large language model', 'I don\'t have access'
    ];
    
    artifacts.forEach(artifact => {
      if (content.includes(artifact)) {
        result.warnings.push(`Content contains AI artifact: ${artifact}`);
      }
    });

    // Check content completeness
    if (content.length < 50) {
      result.warnings.push('Content appears very short, may be incomplete');
    }

    // Check for abrupt endings
    const abruptEndings = ['...', '(continued)', '[continues]', 'and so on'];
    abruptEndings.forEach(ending => {
      if (content.trim().endsWith(ending)) {
        result.warnings.push(`Content has abrupt ending: ${ending}`);
      }
    });
  }

  /**
   * Format-specific validation
   */
  validateFormat(content, expectedFormat, result) {
    switch (expectedFormat.toLowerCase()) {
      case 'json':
        this.validateJSON(content, result);
        break;
      case 'markdown':
        this.validateMarkdown(content, result);
        break;
      case 'yaml':
        this.validateYAML(content, result);
        break;
      case 'code':
        this.validateCode(content, result);
        break;
      case 'artifact':
        this.validateArtifact(content, result);
        break;
      default:
        // Generic text validation
        this.validateText(content, result);
    }
  }

  /**
   * JSON validation
   */
  validateJSON(content, result) {
    try {
      const parsed = JSON.parse(content);
      result.parsedContent = parsed;
      result.extractedData.format = 'json';
      result.extractedData.structure = this.analyzeJSONStructure(parsed);
    } catch (error) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          result.parsedContent = parsed;
          result.extractedData.format = 'json_in_markdown';
          result.warnings.push('JSON found in markdown code block');
        } catch {
          result.errors.push(`Invalid JSON format: ${error.message}`);
        }
      } else {
        result.errors.push(`Invalid JSON format: ${error.message}`);
      }
    }
  }

  /**
   * Markdown validation
   */
  validateMarkdown(content, result) {
    result.extractedData.format = 'markdown';
    
    // Extract structure
    const headers = content.match(/^#{1,6}\s+(.+)$/gm) || [];
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    
    result.extractedData.structure = {
      headers: headers.map(h => h.trim()),
      codeBlocks: codeBlocks.length,
      links: links.length,
      wordCount: content.split(/\s+/).length
    };

    // Validate markdown structure
    if (headers.length === 0 && content.length > 500) {
      result.warnings.push('Long markdown content without headers');
    }

    // Check for unclosed code blocks
    const backtickCount = (content.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) {
      result.errors.push('Unclosed markdown code block detected');
    }
  }

  /**
   * YAML validation
   */
  validateYAML(content, result) {
    try {
      // Basic YAML validation (would need yaml parser for full validation)
      const lines = content.split('\n');
      let indentationConsistent = true;
      let currentIndent = 0;
      
      lines.forEach((line, index) => {
        if (line.trim() && !line.startsWith('#')) {
          const indent = line.match(/^ */)[0].length;
          if (indent % 2 !== 0) {
            indentationConsistent = false;
          }
        }
      });
      
      if (!indentationConsistent) {
        result.warnings.push('YAML indentation may be inconsistent');
      }
      
      result.extractedData.format = 'yaml';
      
    } catch (error) {
      result.errors.push(`YAML validation error: ${error.message}`);
    }
  }

  /**
   * Code validation
   */
  validateCode(content, result) {
    result.extractedData.format = 'code';
    
    // Basic syntax checking
    const brackets = { '(': ')', '[': ']', '{': '}' };
    const stack = [];
    let inString = false;
    let stringChar = null;
    
    for (let char of content) {
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = null;
      } else if (!inString && Object.keys(brackets).includes(char)) {
        stack.push(char);
      } else if (!inString && Object.values(brackets).includes(char)) {
        const lastOpen = stack.pop();
        if (brackets[lastOpen] !== char) {
          result.warnings.push(`Mismatched brackets: expected ${brackets[lastOpen]}, found ${char}`);
        }
      }
    }
    
    if (stack.length > 0) {
      result.warnings.push(`Unclosed brackets: ${stack.join(', ')}`);
    }
  }

  /**
   * Artifact validation (documents, files)
   */
  validateArtifact(content, result) {
    result.extractedData.format = 'artifact';
    
    // Check if content looks like a complete document
    const hasTitle = /^#\s+.+$/m.test(content) || /^.+\n[=\-]+$/m.test(content);
    const hasStructure = content.includes('\n\n') && content.split('\n\n').length > 2;
    const hasConclusion = /conclusion|summary|final/i.test(content.slice(-500));
    
    result.extractedData.completeness = {
      hasTitle,
      hasStructure, 
      hasConclusion,
      score: (hasTitle ? 0.4 : 0) + (hasStructure ? 0.4 : 0) + (hasConclusion ? 0.2 : 0)
    };
    
    if (result.extractedData.completeness.score < 0.6) {
      result.warnings.push('Artifact appears incomplete');
    }
  }

  /**
   * Generic text validation
   */
  validateText(content, result) {
    result.extractedData.format = 'text';
    result.extractedData.wordCount = content.split(/\s+/).length;
    result.extractedData.lineCount = content.split('\n').length;
    
    // Check readability
    const avgWordsPerSentence = content.split(/[.!?]+/).filter(s => s.trim()).length > 0 
      ? result.extractedData.wordCount / content.split(/[.!?]+/).filter(s => s.trim()).length 
      : 0;
      
    if (avgWordsPerSentence > 30) {
      result.warnings.push('Text may be difficult to read (long sentences)');
    }
  }

  /**
   * Security validation
   */
  validateSecurity(content, result) {
    if (!this.sanitizeContent) return;
    
    // Check for potential security issues
    const securityPatterns = [
      /javascript:/i,
      /<script/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /process\.env/i,
      /require\s*\(/i,
      /import\s+.*from\s+['"](fs|child_process|os)['"]/i
    ];
    
    securityPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        result.warnings.push(`Potential security risk detected (pattern ${index + 1})`);
      }
    });
  }

  /**
   * Extract structured data from content
   */
  extractStructuredData(content, result, context) {
    // Extract file names and extensions
    const fileMatches = content.match(/\w+\.\w{2,4}/g) || [];
    const extractedFiles = fileMatches.filter(match => 
      this.allowedFileExtensions.some(ext => match.endsWith(ext.substring(1)))
    );
    
    if (extractedFiles.length > 0) {
      result.extractedData.files = extractedFiles;
    }
    
    // Extract code snippets
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    if (codeBlocks.length > 0) {
      result.extractedData.codeBlocks = codeBlocks.length;
      result.extractedData.languages = this.extractLanguagesFromCodeBlocks(codeBlocks);
    }
    
    // Extract URLs
    const urls = content.match(/https?:\/\/[^\s]+/g) || [];
    if (urls.length > 0) {
      result.extractedData.urls = urls;
    }
    
    // Extract task lists
    const taskLists = content.match(/^[\s]*[-*+]\s+\[[ x]\]/gm) || [];
    if (taskLists.length > 0) {
      result.extractedData.taskLists = taskLists.length;
    }
  }

  /**
   * Attempt automatic fixes for common issues
   */
  attemptAutoFix(response, result) {
    let content = response.content;
    let fixed = false;
    
    // Fix unclosed markdown code blocks
    const backtickCount = (content.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) {
      content += '\n```';
      fixed = true;
      result.warnings.push('Auto-fixed unclosed markdown code block');
    }
    
    // Fix common markdown formatting issues
    content = content.replace(/^#{7,}/gm, '######'); // Max 6 heading levels
    content = content.replace(/\n{4,}/g, '\n\n\n'); // Max 3 consecutive newlines
    
    if (fixed) {
      response.content = content;
      result.sanitized = true;
    }
  }

  /**
   * Calculate confidence score based on validation results
   */
  calculateConfidenceScore(result) {
    let score = 1.0;
    
    // Reduce score for errors and warnings
    score -= result.errors.length * 0.2;
    score -= result.warnings.length * 0.05;
    
    // Bonus for structured content
    if (result.extractedData.structure) {
      score += 0.1;
    }
    
    if (result.extractedData.codeBlocks > 0) {
      score += 0.05;
    }
    
    // Ensure score stays within bounds
    result.confidence = Math.max(0.1, Math.min(1.0, score));
  }

  /**
   * Create fallback content when validation fails
   */
  createFallbackContent(originalContent, context) {
    if (!originalContent || originalContent.length === 0) {
      return {
        type: 'error',
        title: 'Content Generation Failed',
        content: 'The AI was unable to generate proper content. Please try again with a different prompt or approach.'
      };
    }
    
    // Return sanitized version of original content
    return {
      type: 'fallback',
      title: 'Content Validation Issues',
      content: originalContent.substring(0, this.maxContentLength),
      warning: 'This content had validation issues but has been cleaned for display.'
    };
  }

  // Helper methods
  analyzeJSONStructure(obj) {
    const structure = {
      type: Array.isArray(obj) ? 'array' : typeof obj,
      keys: Array.isArray(obj) ? obj.length : Object.keys(obj || {}).length,
      depth: this.calculateObjectDepth(obj)
    };
    return structure;
  }

  calculateObjectDepth(obj) {
    if (typeof obj !== 'object' || obj === null) return 0;
    
    let maxDepth = 0;
    for (let key in obj) {
      const depth = this.calculateObjectDepth(obj[key]);
      maxDepth = Math.max(maxDepth, depth);
    }
    return maxDepth + 1;
  }

  extractLanguagesFromCodeBlocks(codeBlocks) {
    const languages = new Set();
    codeBlocks.forEach(block => {
      const match = block.match(/```(\w+)/);
      if (match) {
        languages.add(match[1]);
      }
    });
    return Array.from(languages);
  }
}

export default ResponseValidator;