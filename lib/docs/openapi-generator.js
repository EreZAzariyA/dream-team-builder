/**
 * OpenAPI Documentation Generator
 * Automatically generates OpenAPI specifications from BMAD workflows and API routes
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export class OpenAPIGenerator {
  constructor() {
    this.baseSpec = {
      openapi: '3.0.3',
      info: {
        title: 'BMAD Workflow API',
        description: 'AI-powered documentation assistant with BMAD agent workflow system',
        version: '1.0.0',
        contact: {
          name: 'Dream Team API Support',
          email: 'support@dreamteam.ai'
        }
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        },
        {
          url: 'https://api.dreamteam.ai',
          description: 'Production server'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          sessionAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'next-auth.session-token'
          }
        }
      }
    };
  }

  /**
   * Generate complete OpenAPI specification
   */
  async generateSpec() {
    try {
      const spec = { ...this.baseSpec };
      
      // Scan API routes and generate paths
      await this.generatePaths(spec);
      
      // Generate schemas from models
      await this.generateSchemas(spec);
      
      // Add workflow-specific documentation
      await this.addWorkflowDocumentation(spec);
      
      return spec;
    } catch (error) {
      logger.error('Error generating OpenAPI spec:', error);
      throw error;
    }
  }

  /**
   * Scan API routes and generate path documentation
   */
  async generatePaths(spec) {
    const apiDir = path.join(process.cwd(), 'app', 'api');
    const routeFiles = await glob('**/route.js', { cwd: apiDir });
    
    for (const routeFile of routeFiles) {
      const routePath = routeFile.replace('/route.js', '');
      const fullPath = path.join(apiDir, routeFile);
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const pathDoc = this.parseRouteFile(content, routePath);
        
        if (pathDoc) {
          const apiPath = this.convertToOpenAPIPath(routePath);
          spec.paths[apiPath] = pathDoc;
        }
      } catch (error) {
        logger.warn(`Error parsing route file ${routeFile}:`, error.message);
      }
    }
  }

  /**
   * Parse route file content and extract API documentation
   */
  parseRouteFile(content, routePath) {
    const methods = {};
    
    // Extract HTTP methods
    const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    
    for (const method of httpMethods) {
      const methodRegex = new RegExp(`export\\s+async\\s+function\\s+${method}`, 'i');
      if (methodRegex.test(content)) {
        methods[method.toLowerCase()] = this.generateMethodDoc(method, routePath, content);
      }
    }
    
    return Object.keys(methods).length > 0 ? methods : null;
  }

  /**
   * Generate documentation for specific HTTP method
   */
  generateMethodDoc(method, routePath) {
    const pathSegments = routePath.split('/');
    const isWorkflowRoute = pathSegments.includes('bmad') || pathSegments.includes('workflow');
    const isAuthRoute = pathSegments.includes('auth');
    const isAnalyticsRoute = pathSegments.includes('analytics');
    
    let summary = '';
    let description = '';
    let tags = [];
    
    // Determine endpoint category and documentation
    if (isWorkflowRoute) {
      tags.push('BMAD Workflows');
      if (routePath.includes('agents')) {
        summary = `${method} BMAD agents information`;
        description = 'Retrieve or manage BMAD agent definitions and status';
      } else if (routePath.includes('workflow')) {
        summary = `${method} workflow execution`;
        description = 'Manage BMAD workflow execution lifecycle';
      }
    } else if (isAuthRoute) {
      tags.push('Authentication');
      summary = `${method} authentication`;
      description = 'Handle user authentication and session management';
    } else if (isAnalyticsRoute) {
      tags.push('Analytics');
      summary = `${method} analytics data`;
      description = 'Retrieve workflow and user analytics information';
    } else {
      tags.push('General');
      summary = `${method} ${routePath}`;
      description = `${method} operation for ${routePath}`;
    }

    const methodDoc = {
      summary,
      description,
      tags,
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        '400': {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    };

    // Add authentication requirement for protected routes
    if (!isAuthRoute && !routePath.includes('health')) {
      methodDoc.security = [{ sessionAuth: [] }];
    }

    // Add request body for POST/PUT methods
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      methodDoc.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      };
    }

    // Add parameters for dynamic routes
    const parameters = this.extractParameters(routePath);
    if (parameters.length > 0) {
      methodDoc.parameters = parameters;
    }

    return methodDoc;
  }

  /**
   * Extract path parameters from route path
   */
  extractParameters(routePath) {
    const parameters = [];
    const segments = routePath.split('/');
    
    for (const segment of segments) {
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const paramName = segment.slice(1, -1);
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${paramName} identifier`
        });
      }
    }
    
    return parameters;
  }

  /**
   * Convert file path to OpenAPI path format
   */
  convertToOpenAPIPath(routePath) {
    return '/' + routePath
      .split('/')
      .map(segment => {
        if (segment.startsWith('[') && segment.endsWith(']')) {
          return `{${segment.slice(1, -1)}}`;
        }
        return segment;
      })
      .join('/');
  }

  /**
   * Generate schemas from database models
   */
  async generateSchemas(spec) {
    const modelsDir = path.join(process.cwd(), 'lib', 'database', 'models');
    
    try {
      const modelFiles = await fs.readdir(modelsDir);
      
      for (const modelFile of modelFiles) {
        if (modelFile.endsWith('.js')) {
          const modelName = modelFile.replace('.js', '');
          const modelPath = path.join(modelsDir, modelFile);
          
          try {
            const content = await fs.readFile(modelPath, 'utf-8');
            const schema = this.parseMongooseSchema(content, modelName);
            
            if (schema) {
              spec.components.schemas[modelName] = schema;
            }
          } catch (error) {
            logger.warn(`Error parsing model ${modelFile}:`, error.message);
          }
        }
      }
    } catch (error) {
      logger.warn('Error reading models directory:', error.message);
    }

    // Add common error schema
    spec.components.schemas.Error = {
      type: 'object',
      properties: {
        error: { type: 'string' },
        details: { type: 'string' },
        code: { type: 'string' }
      },
      required: ['error']
    };
  }

  /**
   * Parse Mongoose schema and convert to OpenAPI schema
   */
  parseMongooseSchema(content, modelName) {
    try {
      // Extract schema definition
      const schemaMatch = content.match(/const\s+\w+Schema\s*=\s*new\s+mongoose\.Schema\s*\(\s*{([^}]+)}/s);
      if (!schemaMatch) return null;

      const schemaContent = schemaMatch[1];
      const properties = {};
      const required = [];

      // Parse schema fields
      const fieldMatches = schemaContent.matchAll(/(\w+):\s*{([^}]+)}/g);
      
      for (const match of fieldMatches) {
        const fieldName = match[1];
        const fieldDef = match[2];
        
        const property = this.parseSchemaField(fieldDef);
        if (property) {
          properties[fieldName] = property;
          
          if (fieldDef.includes('required: true')) {
            required.push(fieldName);
          }
        }
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 && { required })
      };
    } catch (error) {
      logger.warn(`Error parsing schema for ${modelName}:`, error.message);
      return null;
    }
  }

  /**
   * Parse individual schema field
   */
  parseSchemaField(fieldDef) {
    if (fieldDef.includes('type: String')) {
      return { type: 'string' };
    } else if (fieldDef.includes('type: Number')) {
      return { type: 'number' };
    } else if (fieldDef.includes('type: Boolean')) {
      return { type: 'boolean' };
    } else if (fieldDef.includes('type: Date')) {
      return { type: 'string', format: 'date-time' };
    } else if (fieldDef.includes('type: mongoose.Schema.Types.ObjectId')) {
      return { type: 'string', format: 'objectid' };
    } else if (fieldDef.includes('type: Array') || fieldDef.includes('[')) {
      return { type: 'array', items: { type: 'object' } };
    }
    
    return { type: 'object' };
  }

  /**
   * Add workflow-specific documentation
   */
  async addWorkflowDocumentation(spec) {
    // Add workflow sequence schema
    spec.components.schemas.WorkflowSequence = {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'BMAD agent identifier' },
        role: { type: 'string', description: 'Agent role in workflow' },
        description: { type: 'string', description: 'Step description' }
      },
      required: ['agentId', 'role']
    };

    // Add workflow status enum
    spec.components.schemas.WorkflowStatus = {
      type: 'string',
      enum: ['INITIALIZING', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ERROR'],
      description: 'Current workflow execution status'
    };

    // Add agent status enum
    spec.components.schemas.AgentStatus = {
      type: 'string',
      enum: ['IDLE', 'ACTIVE', 'COMPLETED', 'PAUSED', 'ERROR'],
      description: 'Current agent execution status'
    };
  }

  /**
   * Save OpenAPI specification to file
   */
  async saveSpec(spec, outputPath = 'docs/openapi.json') {
    const fullPath = path.join(process.cwd(), outputPath);
    const dir = path.dirname(fullPath);
    
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, JSON.stringify(spec, null, 2));
      logger.info(`OpenAPI specification saved to ${fullPath}`);
      return fullPath;
    } catch (error) {
      logger.error('Error saving OpenAPI spec:', error);
      throw error;
    }
  }

  /**
   * Generate and save OpenAPI specification
   */
  async generate(outputPath) {
    const spec = await this.generateSpec();
    return await this.saveSpec(spec, outputPath);
  }
}

export default OpenAPIGenerator;