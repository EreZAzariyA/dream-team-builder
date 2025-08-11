class FallbackProvider {
  constructor(agent, prompt) {
    this.agent = agent;
    this.prompt = prompt;
  }

  generate() {
    const projectMatch = this.prompt.match(/Project Name: ([^\n]+)/);
    const projectName = projectMatch ? projectMatch[1] : 'Project';
    
    const requirementsMatch = this.prompt.match(/User Requirements: ([^\n]+)/);
    const userRequirements = requirementsMatch ? requirementsMatch[1] : 'Project requirements';
    
    const agentRole = this.agent.persona?.role || this.agent.agent?.title || 'AI Agent';
    
    if (this.agent.id === 'pm') {
      return this.generateFallbackPRD(projectName, userRequirements);
    } else if (this.agent.id === 'architect') {
      return this.generateFallbackArchitecture(projectName, userRequirements);
    } else if (this.agent.id === 'ux-expert') {
      return this.generateFallbackUXSpec(projectName, userRequirements);
    } else if (this.agent.id === 'dev') {
      return this.generateFallbackImplementation(projectName, userRequirements);
    } else if (this.agent.id === 'qa') {
      return this.generateFallbackTestPlan(projectName, userRequirements);
    }
    
    return `# ${agentRole} Analysis for ${projectName}\n\n## Overview\nThis document provides ${agentRole} analysis for ${projectName} based on: ${userRequirements}\n\n## Analysis\nAs a ${agentRole}, I have reviewed the requirements and provide the following insights:\n\n1. **Primary Considerations**: The project requires careful attention to ${agentRole} best practices\n2. **Key Requirements**: Implementation should focus on meeting user needs as specified\n3. **Recommendations**: Follow industry standards and ensure quality deliverables\n\n## Next Steps\n- Review with stakeholders\n- Proceed to implementation phase\n- Ensure quality validation\n\n*Note: This is a fallback response. For detailed analysis, please ensure AI services are properly configured.*`;
  }

  generateFallbackPRD(projectName, userRequirements) {
    return `# ${projectName} Product Requirements Document (PRD)\n\n## Goals and Background Context\n\n### Goals\n- Deliver a functional ${projectName} that meets user requirements\n- Ensure high-quality implementation following best practices\n- Create comprehensive documentation for development team\n\n### Background Context\nThis ${projectName} addresses the specific requirements: \"${userRequirements}\". The solution will implement requested features while following modern development practices.\n\n## Requirements\n\n### Functional Requirements\n- FR1: Core functionality as specified in user requirements\n- FR2: User interface provides intuitive interaction patterns\n- FR3: System handles data storage and retrieval efficiently\n- FR4: Application supports user workflows as described\n\n### Non-Functional Requirements\n- NFR1: Application loads within 3 seconds on standard connections\n- NFR2: System maintains 99% uptime during normal operations\n- NFR3: Interface is responsive and works on mobile devices\n- NFR4: Code follows security best practices\n\n## Epic List\n**Epic 1: Foundation & Setup** - Establish project infrastructure and core functionality\n**Epic 2: Core Features** - Implement primary user-facing features and workflows\n**Epic 3: Quality & Polish** - Add testing, documentation, and final enhancements\n\n## Next Steps\n- Review PRD with stakeholders\n- Begin architectural planning\n- Proceed to UX design phase`;
  }

  generateFallbackArchitecture(projectName, userRequirements) {
    return `# ${projectName} System Architecture\n\n## Architecture Overview\nThis document outlines the technical architecture for ${projectName} based on: \"${userRequirements}\"\n\n## System Components\n\n### Frontend Architecture\n- Modern JavaScript framework (React/Vue/Angular)\n- Responsive design for mobile and desktop\n- Component-based architecture for maintainability\n\n### Backend Architecture\n- RESTful API design\n- Database layer for data persistence\n- Authentication and authorization system\n### Data Architecture\n- Relational database for structured data\n- API endpoints for CRUD operations\n- Data validation and sanitization\n\n## Technical Stack\n- **Frontend**: Modern JavaScript framework\n- **Backend**: Node.js/Express or similar\n- **Database**: PostgreSQL/MongoDB\n- **Authentication**: JWT-based authentication\n- **Deployment**: Cloud platform (AWS/Azure/GCP)\n\n## Security Considerations\n- Secure authentication implementation\n- Data encryption in transit and at rest\n- Input validation and sanitization\n- Regular security updates and monitoring`;
  }

  generateFallbackUXSpec(projectName, userRequirements) {
    return `# ${projectName} UX/UI Specification\n\n## Introduction\nThis document outlines the user experience and interface design for ${projectName}.\n\n## User Requirements\nBased on: \"${userRequirements}\"\n\n## Information Architecture (IA)\n- Main navigation structure\n- Content organization\n- User flow paths\n\n## User Flows\n- Primary user journey\n- Secondary workflows\n- Error handling paths\n\n## Wireframes & Mockups\n- Key screen layouts\n- Component specifications\n- Interaction patterns\n\n## Component Library / Design System\n- UI component specifications\n- Style guidelines\n- Design tokens\n\n## Branding & Style Guide\n- Color palette\n- Typography system\n- Visual identity elements\n\n## Accessibility Requirements\n- WCAG compliance guidelines\n- Keyboard navigation support\n- Screen reader compatibility\n\n## Responsiveness Strategy\n- Mobile-first design approach\n- Breakpoint specifications\n- Device compatibility\n\n## Animation & Micro-interactions\n- Loading states\n- Transition effects\n- User feedback mechanisms\n\n## Performance Considerations\n- Optimized asset loading\n- Minimal rendering overhead\n- Fast user interactions`;
  }

  generateFallbackImplementation(projectName, userRequirements) {
    return `// ${projectName} Implementation\n// Generated based on: ${userRequirements}\n\nexport class ${projectName?.replace(/[^a-zA-Z0-9]/g, '')}Implementation {
  constructor() {
    this.initialized = false;
    this.config = {};
  }

  async initialize() {
    logger.info('Initializing ${projectName}...');
    this.initialized = true;
    return true;
  }

  async execute() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Main implementation logic
    logger.info('Executing ${projectName} functionality...');
    return { success: true, message: 'Implementation complete' };
  }

  // Core business logic methods
  async processUserRequest(request) {
    // Process user requests based on requirements
    return { status: 'processed', data: request };
  }

  async validateInput(input) {
    // Input validation logic
    return input && typeof input === 'object';
  }

  async saveData(data) {
    // Data persistence logic
    logger.info('Saving data:', data);
    return { saved: true, id: Date.now() };
  }
}

export default ${projectName?.replace(/[^a-zA-Z0-9]/g, '')}Implementation;`;
  }

  generateFallbackTestPlan(projectName, userRequirements) {
    return `# ${projectName} Test Plan\n\n## Test Strategy\nComprehensive testing approach for ${projectName} based on: \"${userRequirements}\"\n\n## Test Scope\n- Functional testing of core features\n- Integration testing for system components\n- User acceptance testing for business requirements\n- Performance testing for scalability\n\n## Test Cases\n\n### TC001: Core Functionality\n- **Objective**: Verify main features work as expected\n- **Prerequisites**: System setup completed\n- **Steps**: \n  1. Initialize application\n  2. Execute primary user workflows\n  3. Validate results\n- **Expected**: All core features function correctly\n\n### TC002: User Interface\n- **Objective**: Verify UI components and interactions\n- **Prerequisites**: Application loaded\n- **Steps**:\n  1. Navigate through all main screens\n  2. Test form inputs and validation\n  3. Verify responsive behavior\n- **Expected**: UI is intuitive and responsive\n\n### TC003: Data Management\n- **Objective**: Verify data storage and retrieval\n- **Prerequisites**: Database configured\n- **Steps**:\n  1. Create test data\n  2. Perform CRUD operations\n  3. Verify data integrity\n- **Expected**: Data operations work correctly\n\n### TC004: Error Handling\n- **Objective**: Verify system handles errors gracefully\n- **Prerequisites**: System initialized\n- **Steps**:\n  1. Trigger error conditions\n  2. Verify error handling\n  3. Confirm system recovery\n- **Expected**: Proper error messages and recovery\n\n## Acceptance Criteria\n- All critical path tests pass\n- Performance within acceptable limits\n- Security requirements validated\n- User experience meets expectations`;
  }
}

module.exports = { FallbackProvider };
