// Mock AI Service for testing
const { faker } = require('@faker-js/faker')

class MockAIService {
  constructor() {
    this.isInitialized = true
    this.responseDelay = 100 // Configurable delay for testing
    this.shouldFail = false
    this.failureRate = 0
    this.responses = new Map()
  }
  
  // Configure mock behavior
  configure(options = {}) {
    this.responseDelay = options.delay || 100
    this.shouldFail = options.shouldFail || false
    this.failureRate = options.failureRate || 0
  }
  
  // Set predefined response for specific agent
  setResponse(agentId, response) {
    this.responses.set(agentId, response)
  }
  
  // Clear all predefined responses
  clearResponses() {
    this.responses.clear()
  }
  
  async initialize() {
    this.isInitialized = true
    return true
  }
  
  async generateAgentResponse(agentDefinition, userMessage, conversationHistory = []) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.responseDelay))
    
    // Simulate random failures
    if (this.shouldFail || Math.random() < this.failureRate) {
      throw new Error('Mock AI service failure')
    }
    
    // Return predefined response if available
    if (this.responses.has(agentDefinition.agent_id)) {
      return this.responses.get(agentDefinition.agent_id)
    }
    
    // Generate contextual mock response based on agent role
    return this.generateMockResponse(agentDefinition, userMessage)
  }
  
  generateMockResponse(agentDefinition, userMessage) {
    const agentRole = agentDefinition.role || 'General'
    const agentId = agentDefinition.agent_id || 'unknown'
    
    const responses = {
      'Project Management': this.generatePMResponse(userMessage),
      'System Architecture': this.generateArchitectResponse(userMessage),
      'Software Development': this.generateDeveloperResponse(userMessage),
      'Quality Assurance': this.generateQAResponse(userMessage),
      'User Experience': this.generateUXResponse(userMessage),
      'Data Architecture': this.generateDataArchitectResponse(userMessage),
    }
    
    return responses[agentRole] || this.generateGenericResponse(agentId, userMessage)
  }
  
  generatePMResponse(userMessage) {
    return {
      content: `As a Project Manager, I've analyzed your request: "${userMessage}". Here's my project breakdown:

## Project Overview
- **Scope**: ${faker.lorem.sentence()}
- **Timeline**: ${faker.number.int({ min: 2, max: 12 })} weeks
- **Resources**: ${faker.number.int({ min: 2, max: 8 })} team members

## Key Milestones
1. Requirements gathering and analysis
2. Technical architecture design
3. Development phase
4. Testing and quality assurance
5. Deployment and launch

## Next Steps
Proceeding to hand off to the System Architect for technical design.`,
      
      artifacts: [{
        type: 'DOCUMENT',
        name: 'project-requirements.md',
        content: `# Project Requirements Document\n\n${faker.lorem.paragraphs(3)}`,
        agentId: 'pm',
        timestamp: new Date().toISOString(),
      }],
      
      metadata: {
        agentId: 'pm',
        role: 'Project Management',
        executionTime: faker.number.int({ min: 2000, max: 5000 }),
        confidence: 0.95,
      }
    }
  }
  
  generateArchitectResponse(userMessage) {
    return {
      content: `As a System Architect, I've designed the technical solution for: "${userMessage}".

## System Architecture
- **Architecture Pattern**: ${faker.helpers.arrayElement(['Microservices', 'Monolithic', 'Serverless', 'Event-Driven'])}
- **Technology Stack**: React, Node.js, MongoDB
- **Deployment**: ${faker.helpers.arrayElement(['AWS', 'Azure', 'GCP', 'Docker'])}

## Technical Components
1. Frontend application
2. API gateway
3. Business logic services
4. Database layer
5. Caching layer

## Next Steps
Handing off to the Developer for implementation.`,
      
      artifacts: [{
        type: 'DOCUMENT',
        name: 'system-architecture.md',
        content: `# System Architecture Document\n\n${faker.lorem.paragraphs(4)}`,
        agentId: 'architect',
        timestamp: new Date().toISOString(),
      }],
      
      metadata: {
        agentId: 'architect',
        role: 'System Architecture',
        executionTime: faker.number.int({ min: 3000, max: 7000 }),
        confidence: 0.92,
      }
    }
  }
  
  generateDeveloperResponse(userMessage) {
    return {
      content: `As a Developer, I'm implementing the solution for: "${userMessage}".

## Implementation Plan
- **Framework**: Next.js with React
- **Database**: MongoDB with Mongoose
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS

## Code Structure
\`\`\`
src/
├── components/
├── pages/
├── lib/
└── styles/
\`\`\`

## Next Steps
Code implementation complete. Handing off to QA for testing.`,
      
      artifacts: [{
        type: 'CODE',
        name: 'main-component.jsx',
        content: `import React from 'react';\n\nexport default function MainComponent() {\n  return <div>Hello World</div>;\n}`,
        agentId: 'developer',
        timestamp: new Date().toISOString(),
      }],
      
      metadata: {
        agentId: 'developer',
        role: 'Software Development',
        executionTime: faker.number.int({ min: 5000, max: 10000 }),
        confidence: 0.88,
      }
    }
  }
  
  generateQAResponse(userMessage) {
    return {
      content: `As a QA Engineer, I've tested the implementation for: "${userMessage}".

## Test Results
- **Unit Tests**: ${faker.number.int({ min: 85, max: 100 })}% coverage
- **Integration Tests**: ${faker.number.int({ min: 10, max: 25 })} test cases
- **Performance**: Response time < ${faker.number.int({ min: 100, max: 500 })}ms

## Quality Metrics
- Code quality score: A
- Security scan: Passed
- Accessibility: WCAG 2.1 AA compliant

## Recommendations
All tests passing. Ready for deployment.`,
      
      artifacts: [{
        type: 'TEST',
        name: 'test-plan.md',
        content: `# Test Plan\n\n${faker.lorem.paragraphs(3)}`,
        agentId: 'qa',
        timestamp: new Date().toISOString(),
      }],
      
      metadata: {
        agentId: 'qa',
        role: 'Quality Assurance',
        executionTime: faker.number.int({ min: 2000, max: 6000 }),
        confidence: 0.94,
      }
    }
  }
  
  generateUXResponse(userMessage) {
    return {
      content: `As a UX Expert, I've designed the user experience for: "${userMessage}".

## UX Design
- **Design System**: Modern, accessible, mobile-first
- **User Flow**: ${faker.number.int({ min: 3, max: 8 })} step user journey
- **Accessibility**: WCAG 2.1 AA compliant

## Key Features
1. Intuitive navigation
2. Responsive design
3. Clear visual hierarchy
4. Consistent interactions

## Next Steps
Design approved. Ready for development handoff.`,
      
      artifacts: [{
        type: 'DOCUMENT',
        name: 'ux-design-spec.md',
        content: `# UX Design Specification\n\n${faker.lorem.paragraphs(3)}`,
        agentId: 'ux-expert',
        timestamp: new Date().toISOString(),
      }],
      
      metadata: {
        agentId: 'ux-expert',
        role: 'User Experience',
        executionTime: faker.number.int({ min: 3000, max: 8000 }),
        confidence: 0.91,
      }
    }
  }
  
  generateDataArchitectResponse(userMessage) {
    return {
      content: `As a Data Architect, I've designed the data model for: "${userMessage}".

## Data Architecture
- **Database**: MongoDB with Mongoose ODM
- **Schema Design**: ${faker.number.int({ min: 3, max: 12 })} collections
- **Relationships**: One-to-many and many-to-many patterns

## Key Collections
1. Users
2. Projects
3. Workflows
4. Analytics

## Next Steps
Data model approved. Ready for implementation.`,
      
      artifacts: [{
        type: 'DOCUMENT',
        name: 'data-model.md',
        content: `# Data Model Specification\n\n${faker.lorem.paragraphs(3)}`,
        agentId: 'data-architect',
        timestamp: new Date().toISOString(),
      }],
      
      metadata: {
        agentId: 'data-architect',
        role: 'Data Architecture',
        executionTime: faker.number.int({ min: 2500, max: 6500 }),
        confidence: 0.89,
      }
    }
  }
  
  generateGenericResponse(agentId, userMessage) {
    return {
      content: `As ${agentId}, I've processed your request: "${userMessage}". ${faker.lorem.paragraph()}`,
      
      artifacts: [{
        type: 'DOCUMENT',
        name: `${agentId}-output.md`,
        content: faker.lorem.paragraphs(2),
        agentId,
        timestamp: new Date().toISOString(),
      }],
      
      metadata: {
        agentId,
        executionTime: faker.number.int({ min: 1000, max: 5000 }),
        confidence: faker.number.float({ min: 0.7, max: 0.95 }),
      }
    }
  }
  
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'mock-ai-service',
      timestamp: new Date().toISOString(),
      version: '1.0.0-test',
    }
  }
}

module.exports = MockAIService