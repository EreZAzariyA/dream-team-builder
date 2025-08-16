/**
 * Test Script: Template-based Document Generation with BMAD
 * 
 * This demonstrates how the TemplateEngine works with existing BMAD templates
 * without changing the core BMAD system.
 */

const { DocumentGenerator } = require('./lib/bmad/DocumentGenerator.js');

async function testTemplateGeneration() {
  console.log('🧪 Testing BMAD Template Engine Integration...\n');
  
  const docGenerator = new DocumentGenerator();
  
  // Sample data that an agent might collect through normal BMAD workflow
  const projectData = {
    project_name: 'My Awesome Project',
    project_description: 'A cutting-edge web application for managing tasks',
    generated_date: new Date().toISOString(),
    technical_summary: 'Modern full-stack application using React, Node.js, and PostgreSQL',
    high_level_overview: 'Microservices architecture with event-driven communication',
    cloud_infrastructure: {
      provider: 'AWS',
      core_services: 'EC2, RDS, S3, Lambda',
      regions: 'us-east-1, us-west-2'
    },
    technology_stack: [
      {
        category: 'Frontend',
        technology: 'React',
        version: '18.2.0',
        purpose: 'User interface',
        rationale: 'Modern, well-supported library with strong ecosystem'
      },
      {
        category: 'Backend',
        technology: 'Node.js',
        version: '20.0.0',
        purpose: 'Server runtime',
        rationale: 'JavaScript ecosystem consistency and performance'
      },
      {
        category: 'Database',
        technology: 'PostgreSQL',
        version: '15.0',
        purpose: 'Primary data store',
        rationale: 'ACID compliance and rich feature set'
      }
    ],
    components: [
      {
        component_name: 'API Gateway',
        component_description: 'Routes requests to appropriate microservices',
        interfaces: ['REST API', 'GraphQL endpoint'],
        dependencies: 'Authentication Service, Rate Limiter',
        component_tech_details: 'Express.js with middleware pipeline'
      },
      {
        component_name: 'User Service',
        component_description: 'Manages user accounts and authentication',
        interfaces: ['User API', 'Auth tokens'],
        dependencies: 'Database, Email service',
        component_tech_details: 'JWT-based authentication with bcrypt'
      }
    ]
  };

  try {
    // Test 1: Generate using existing BMAD architecture template structure
    console.log('📝 Test 1: Generating document using template data...\n');
    
    // Create a simple template string that follows BMAD patterns
    const simpleTemplate = `# {{project_name}} Architecture Document

Generated on: {{date_format generated_date 'full'}}

## Project Overview
{{project_description}}

## Technical Summary
{{technical_summary}}

## Technology Stack
{{#each technology_stack}}
| {{category}} | {{technology}} | {{version}} | {{purpose}} | {{rationale}} |
{{/each}}

## Components
{{#each components}}
### {{component_name}}
**Responsibility:** {{component_description}}

**Key Interfaces:**
{{#each interfaces}}
- {{.}}
{{/each}}

**Dependencies:** {{dependencies}}
**Technology Stack:** {{component_tech_details}}
{{/each}}

---
*Generated using BMAD Template Engine*`;

    const result = await docGenerator.generateFromString(simpleTemplate, projectData);
    
    console.log('✅ Generated Document:');
    console.log('==========================================');
    console.log(result.content);
    console.log('==========================================\n');
    
    // Test 2: Validate template syntax
    console.log('🔍 Test 2: Validating template syntax...\n');
    
    const validation = docGenerator.validateTemplate(simpleTemplate);
    console.log('Validation result:', validation.valid ? '✅ Valid' : '❌ Invalid');
    if (!validation.valid) {
      console.log('Error:', validation.error);
    }
    console.log();
    
    // Test 3: Show available helpers
    console.log('🛠️  Test 3: Available template helpers...\n');
    const helpers = docGenerator.getAvailableHelpers();
    console.log('Available helpers:', helpers.join(', '));
    console.log();
    
    console.log('🎉 All tests completed successfully!');
    console.log('\n💡 Usage in BMAD:');
    console.log('   - Agents collect data through normal BMAD workflow');
    console.log('   - When document generation needed, agents can use DocumentGenerator');
    console.log('   - Works with existing BMAD templates and data structures');
    console.log('   - No changes needed to core BMAD system');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testTemplateGeneration();
}

module.exports = { testTemplateGeneration };