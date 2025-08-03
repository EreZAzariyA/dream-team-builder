/**
 * BMAD Mock Agent Executor - Demo Version with Realistic Content
 * Provides sequential agent execution with delays and mock deliverables
 * Same functionality as AgentExecutor but with mock data for demonstration
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const isServer = typeof window === 'undefined';

class MockAgentExecutor {
  constructor(agentLoader) {
    this.agentLoader = agentLoader;
    this.taskCache = new Map();
    this.templateCache = new Map();
    this.checklistCache = new Map();
    this.promptCache = new Map();
    this.stateManager = new Map(); // Cross-agent state persistence
    this.retryAttempts = new Map(); // Track retry attempts per agent
    
    // Mock configuration
    this.mockDelayMs = 10000; // 10 seconds delay per agent
    this.mockFailureRate = 0; // 0% failure rate for demo
  }

  /**
   * Execute agent using mock data with realistic delays
   */
  async executeAgent(agent, context) {
    if (!isServer) {
      console.warn('MockAgentExecutor can only run on server side');
      return this.createMockExecution(agent, context);
    }

    const startTime = Date.now();

    try {
      console.log(`🤖 [MOCK] Starting ${agent.id} agent execution...`);
      
      // Simulate realistic processing time
      await new Promise(resolve => setTimeout(resolve, this.mockDelayMs));
      
      // Simulate occasional failures for realism
      if (Math.random() < this.mockFailureRate) {
        throw new Error(`Mock failure for ${agent.id} (for demonstration)`);
      }

      // Generate agent-specific mock content
      const mockContent = this.generateAgentSpecificContent(agent, context);
      
      console.log(`✅ [MOCK] ${agent.id} completed successfully`);
      
      return {
        agentId: agent.id,
        agentName: agent.agent.name || agent.id,
        executionTime: Date.now() - startTime,
        artifacts: [{
          type: 'document',
          name: mockContent.title,
          filename: mockContent.filename,
          description: `${agent.agent.name} generated ${mockContent.type}`,
          content: mockContent.content,
          metadata: {
            agent: agent.id,
            mock: true,
            generatedAt: new Date().toISOString(),
            wordCount: mockContent.content.split(' ').length
          }
        }],
        messages: [
          `${agent.agent.name || agent.id} completed successfully`,
          `Generated ${mockContent.type} with ${mockContent.content.split(' ').length} words`,
          `Mock execution completed in ${Date.now() - startTime}ms`
        ],
        success: true,
        metadata: {
          persona: agent.persona?.role,
          mock: true,
          processingTime: Date.now() - startTime
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ [MOCK] Error executing agent ${agent.id}:`, error);
      
      return {
        agentId: agent.id,
        agentName: agent.agent.name || agent.id,
        executionTime,
        artifacts: [],
        messages: [`Mock error executing ${agent.id}: ${error.message}`],
        success: false,
        error: error.message,
        mock: true
      };
    }
  }

  /**
   * Generate realistic content based on agent role
   */
  generateAgentSpecificContent(agent, context) {
    const projectName = this.parseUserPrompt(context.userPrompt || '').projectName;
    
    switch (agent.id) {
      case 'analyst':
        return this.generateAnalystContent(projectName, context);
      case 'pm':
        return this.generatePMContent(projectName, context);
      case 'architect':
        return this.generateArchitectContent(projectName, context);
      case 'ux-expert':
        return this.generateUXContent(projectName, context);
      case 'dev':
        return this.generateDevContent(projectName, context);
      case 'qa':
        return this.generateQAContent(projectName, context);
      default:
        return this.generateGenericContent(agent, projectName, context);
    }
  }

  generateAnalystContent(projectName, context) {
    return {
      title: 'Market & Requirements Analysis',
      type: 'Market Analysis Report',
      filename: 'market-analysis.md',
      content: `# ${projectName} - Market & Requirements Analysis

## Executive Summary
Our analysis of the ${projectName} project reveals a strong market opportunity in the task management space. The combination of JWT authentication, user registration, and modern UI positions this application competitively.

## Market Analysis
- **Target Market**: Individual users and small teams seeking efficient task management
- **Market Size**: $4.3B global task management software market
- **Growth Rate**: 13.7% CAGR (2021-2028)
- **Key Competitors**: Todoist, Any.do, Microsoft To Do

## User Requirements Analysis
Based on the specified requirements:
- **Authentication**: JWT-based secure authentication system
- **User Management**: Registration and profile management
- **Task Management**: Core CRUD operations for tasks
- **Modern UI**: Clean, responsive, and intuitive interface

## Technical Feasibility
- **Complexity**: Medium
- **Timeline**: 6-8 weeks for MVP
- **Risk Level**: Low
- **Technology Stack**: React/Vue + Node.js + JWT + MongoDB/PostgreSQL

## Recommendations
1. Focus on core task management features for MVP
2. Implement progressive web app capabilities
3. Plan for mobile responsiveness from day one
4. Consider offline functionality for future iterations

## Next Steps
- Proceed to Product Requirements Document creation
- Conduct competitive analysis deep-dive
- Define user personas and use cases
`
    };
  }

  generatePMContent(projectName, context) {
    return {
      title: 'Product Requirements Document',
      type: 'PRD',
      filename: 'prd.md',
      content: `# ${projectName} - Product Requirements Document

## 1. Product Overview

### 1.1 Goals and Background Context
**Goals:**
- Deliver a functional ${projectName} that meets modern user expectations
- Implement secure authentication and user management
- Create an intuitive task management experience
- Ensure responsive design across all devices

**Background Context:**
This ${projectName} addresses the need for a simple, secure, and modern task management solution. The application will implement industry-standard JWT authentication with comprehensive user management and a clean modern interface.

## 2. Requirements

### 2.1 Functional Requirements
- **FR1**: User registration and authentication with JWT tokens
- **FR2**: Secure login/logout functionality
- **FR3**: Create, read, update, and delete tasks
- **FR4**: Task categorization and prioritization
- **FR5**: User profile management
- **FR6**: Responsive UI that works on desktop and mobile

### 2.2 Non-Functional Requirements
- **NFR1**: Application loads within 3 seconds on standard connections
- **NFR2**: 99.9% uptime during normal operations
- **NFR3**: Support for 1000+ concurrent users
- **NFR4**: WCAG 2.1 accessibility compliance
- **NFR5**: Mobile-first responsive design

## 3. User Stories

### 3.1 Authentication Stories
- As a new user, I want to register an account so I can start managing my tasks
- As a returning user, I want to log in securely so I can access my tasks
- As a user, I want to log out safely so my account remains secure

### 3.2 Task Management Stories
- As a user, I want to create new tasks so I can track my work
- As a user, I want to mark tasks as complete so I can track progress
- As a user, I want to edit task details so I can keep information current
- As a user, I want to delete tasks so I can remove unnecessary items

## 4. Epic List
**Epic 1: Authentication System** - Implement JWT-based user authentication and registration
**Epic 2: Task Management Core** - Build the core task CRUD functionality
**Epic 3: Modern UI Implementation** - Create responsive, modern user interface
**Epic 4: User Experience Polish** - Add animations, feedback, and polish

## 5. Success Metrics
- User registration completion rate > 85%
- Daily active user retention > 70%
- Task creation rate > 5 tasks per user per week
- Page load times < 3 seconds

## 6. Next Steps
- Review PRD with stakeholders
- Begin system architecture design
- Create detailed UI/UX specifications
- Plan development sprints
`
    };
  }

  generateArchitectContent(projectName, context) {
    return {
      title: 'System Architecture Document',
      type: 'Technical Architecture',
      filename: 'architecture.md',
      content: `# ${projectName} - System Architecture

## 1. Architecture Overview
This document outlines the technical architecture for ${projectName}, designed as a modern, scalable web application with secure authentication and efficient task management capabilities.

## 2. System Components

### 2.1 Frontend Architecture
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit with RTK Query
- **Styling**: Tailwind CSS with CSS Modules
- **Build Tool**: Vite for fast development and optimized builds
- **Component Library**: Custom components with Headless UI

### 2.2 Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens with refresh token rotation
- **API Design**: RESTful API with OpenAPI documentation
- **Validation**: Joi for request validation

### 2.3 Data Architecture
\`\`\`sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 0,
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## 3. Security Architecture
- **Authentication**: JWT access tokens (15 min) + refresh tokens (7 days)
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: bcrypt password hashing + input sanitization
- **CORS**: Configured for specific frontend domains
- **Rate Limiting**: Redis-based rate limiting for API endpoints

## 4. API Design

### 4.1 Authentication Endpoints
\`\`\`
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
\`\`\`

### 4.2 Task Endpoints
\`\`\`
GET    /api/tasks
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
PATCH  /api/tasks/:id/complete
\`\`\`

## 5. Technology Stack Summary
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL
- **Authentication**: JWT with refresh token strategy
- **Deployment**: Docker containers on AWS/Railway
- **Monitoring**: Application logs + health check endpoints

## 6. Performance Considerations
- Database indexing on user_id and created_at fields
- API response caching with Redis
- Image optimization and lazy loading
- Code splitting and bundle optimization
- CDN for static asset delivery

## 7. Scalability Plan
- Horizontal scaling with load balancers
- Database read replicas for query optimization
- Redis cluster for session management
- Microservices transition path for future growth

## 8. Next Steps
- Set up development environment
- Implement authentication flow
- Create database schema and migrations
- Build core API endpoints
`
    };
  }

  generateUXContent(projectName, context) {
    return {
      title: 'UI/UX Specification',
      type: 'Design Specification',
      filename: 'ux-spec.md',
      content: `# ${projectName} - UI/UX Specification

## 1. Introduction
This document defines the user experience and interface design specifications for ${projectName}. Our goal is to create a clean, modern, and intuitive task management application that prioritizes user efficiency and satisfaction.

## 2. Information Architecture (IA)

### 2.1 Site Map
\`\`\`
${projectName}
├── Authentication
│   ├── Login
│   ├── Register
│   └── Password Reset
├── Dashboard
│   ├── Task Overview
│   ├── Recent Activity
│   └── Quick Actions
├── Tasks
│   ├── All Tasks
│   ├── Completed Tasks
│   ├── Task Details
│   └── Task Creation/Edit
└── Settings
    ├── Profile
    ├── Preferences
    └── Account Security
\`\`\`

### 2.2 Navigation Structure
- **Primary Navigation**: Dashboard, Tasks, Settings
- **Secondary Navigation**: Task filters, user menu
- **Breadcrumbs**: For deep navigation in task details

## 3. User Flows

### 3.1 User Registration Flow
1. User lands on registration page
2. Enters email, password, and name
3. Submits form with validation
4. Receives confirmation email
5. Redirected to dashboard upon verification

### 3.2 Task Creation Flow
1. User clicks "Add Task" button
2. Task creation modal opens
3. User enters title, description, priority
4. Sets optional due date
5. Saves task and sees it in task list

### 3.3 Task Completion Flow
1. User views task in list
2. Clicks checkbox to mark complete
3. Task animates to completed state
4. Success feedback provided
5. Task moves to completed section

## 4. Wireframes & Design System

### 4.1 Component Library
- **Buttons**: Primary, Secondary, Danger, Ghost variants
- **Forms**: Input fields, textareas, checkboxes, dropdowns
- **Cards**: Task cards, summary cards, stat cards
- **Modals**: Task creation, confirmation dialogs
- **Navigation**: Header, sidebar, breadcrumbs

### 4.2 Color Palette
- **Primary**: #3B82F6 (Blue)
- **Secondary**: #6B7280 (Gray)
- **Success**: #10B981 (Green)
- **Warning**: #F59E0B (Amber)
- **Danger**: #EF4444 (Red)
- **Background**: #F9FAFB (Light Gray)

### 4.3 Typography
- **Headings**: Inter, 600-700 weight
- **Body Text**: Inter, 400-500 weight
- **Code/Monospace**: JetBrains Mono

## 5. Interaction Design

### 5.1 Micro-interactions
- **Task Completion**: Smooth checkbox animation + strikethrough
- **Button Hover**: Subtle color transition (200ms)
- **Form Validation**: Real-time feedback with smooth error messages
- **Loading States**: Skeleton loaders for content areas

### 5.2 Animations
- **Page Transitions**: Fade in/out (300ms)
- **Modal Animations**: Scale + fade (250ms)
- **Task List**: Stagger animation for initial load
- **Success Feedback**: Bounce animation for confirmations

## 6. Responsive Design

### 6.1 Breakpoints
- **Mobile**: 0-768px (Stack layout, bottom navigation)
- **Tablet**: 768-1024px (Adaptive sidebar)
- **Desktop**: 1024px+ (Full sidebar, multiple columns)

### 6.2 Mobile Adaptations
- Collapsible sidebar becomes bottom navigation
- Task cards stack vertically
- Touch-friendly button sizes (44px minimum)
- Swipe gestures for task completion

## 7. Accessibility Requirements
- **WCAG 2.1 AA Compliance**: All interactive elements accessible
- **Keyboard Navigation**: Full keyboard support with visible focus
- **Screen Readers**: Proper ARIA labels and semantic HTML
- **Color Contrast**: 4.5:1 minimum for normal text
- **Motion Sensitivity**: Respect prefers-reduced-motion

## 8. Performance Considerations
- **Loading Time**: < 3 seconds initial load
- **Interaction Response**: < 100ms for UI feedback
- **Image Optimization**: WebP format with fallbacks
- **Code Splitting**: Route-based lazy loading

## 9. Next Steps
1. Create high-fidelity mockups in Figma
2. Build component library in Storybook
3. Conduct usability testing with prototypes
4. Prepare design handoff for development team
5. Create design system documentation
`
    };
  }

  generateDevContent(projectName, context) {
    return {
      title: 'Implementation Plan',
      type: 'Development Guide',
      filename: 'implementation.md',
      content: `# ${projectName} - Implementation Plan

## 1. Development Setup

### 1.1 Environment Configuration
\`\`\`bash
# Clone repository
git clone https://github.com/user/${projectName.toLowerCase().replace(' ', '-')}.git
cd ${projectName.toLowerCase().replace(' ', '-')}

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Configure database URL, JWT secrets, etc.

# Run development server
npm run dev
\`\`\`

### 1.2 Project Structure
\`\`\`
${projectName.toLowerCase().replace(' ', '-')}/
├── src/
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API service functions
│   ├── store/             # Redux store configuration
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── server/
│   ├── routes/            # Express route handlers
│   ├── middleware/        # Custom middleware
│   ├── models/            # Database models
│   ├── services/          # Business logic
│   └── utils/             # Server utilities
└── tests/                 # Test files
\`\`\`

## 2. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Set up development environment
- Configure build tools and linting
- Implement basic project structure
- Set up database schema and migrations
- Create basic authentication API endpoints

### Phase 2: Core Features (Week 3-4)
- Implement user registration and login
- Build task CRUD operations
- Create main UI components
- Set up state management
- Implement JWT authentication flow

### Phase 3: User Interface (Week 5-6)
- Build responsive task management interface
- Implement task filtering and sorting
- Add form validation and error handling
- Create loading states and animations
- Implement mobile-responsive design

### Phase 4: Polish & Testing (Week 7-8)
- Add comprehensive test coverage
- Implement accessibility features
- Performance optimization
- Error handling and edge cases
- Documentation and deployment setup

## 3. Key Implementation Details

### 3.1 Authentication Implementation
\`\`\`javascript
// JWT token generation
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};
\`\`\`

### 3.2 Task Management API
\`\`\`javascript
// Task creation endpoint
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;
    const task = await Task.create({
      userId: req.user.id,
      title,
      description,
      priority,
      dueDate
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
\`\`\`

### 3.3 Frontend State Management
\`\`\`javascript
// Redux slice for tasks
const tasksSlice = createSlice({
  name: 'tasks',
  initialState: {
    items: [],
    loading: false,
    error: null
  },
  reducers: {
    addTask: (state, action) => {
      state.items.push(action.payload);
    },
    toggleComplete: (state, action) => {
      const task = state.items.find(t => t.id === action.payload);
      if (task) task.completed = !task.completed;
    }
  }
});
\`\`\`

## 4. Testing Strategy

### 4.1 Unit Tests
- Component testing with React Testing Library
- API endpoint testing with Jest and Supertest
- Utility function testing
- Mock external dependencies

### 4.2 Integration Tests
- Authentication flow testing
- Database operations testing
- API integration testing
- User journey testing

### 4.3 E2E Tests
- Critical user paths with Playwright
- Cross-browser compatibility
- Mobile responsiveness testing
- Accessibility testing

## 5. Deployment Plan

### 5.1 Production Environment
- **Frontend**: Deployed on Vercel/Netlify
- **Backend**: Deployed on Railway/Heroku
- **Database**: PostgreSQL on Railway/Supabase
- **Monitoring**: Application logs and health checks

### 5.2 CI/CD Pipeline
\`\`\`yaml
# GitHub Actions workflow
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: npm test
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: npm run deploy
\`\`\`

## 6. Performance Optimization
- Implement lazy loading for route components
- Use React.memo for expensive components
- Database query optimization with proper indexing
- Image optimization and compression
- Bundle size analysis and code splitting

## 7. Security Checklist
- ✅ JWT token security with proper expiration
- ✅ Password hashing with bcrypt
- ✅ Input validation and sanitization
- ✅ CORS configuration
- ✅ Rate limiting implementation
- ✅ SQL injection prevention with parameterized queries

## 8. Next Steps
1. Set up development environment
2. Begin Phase 1 implementation
3. Regular code reviews and testing
4. Continuous integration setup
5. Documentation updates
`
    };
  }

  generateQAContent(projectName, context) {
    return {
      title: 'Quality Assurance Plan',
      type: 'QA Strategy & Test Plan',
      filename: 'qa-plan.md',
      content: `# ${projectName} - Quality Assurance Plan

## 1. QA Strategy Overview
This document outlines the comprehensive quality assurance strategy for ${projectName}, ensuring the application meets functional requirements, performance standards, and provides an excellent user experience.

## 2. Testing Scope

### 2.1 Functional Testing
- **Authentication System**: Registration, login, logout, password reset
- **Task Management**: Create, read, update, delete operations
- **User Interface**: All interactive elements and user flows
- **Data Validation**: Input validation and error handling
- **Security**: Authentication, authorization, data protection

### 2.2 Non-Functional Testing
- **Performance**: Load times, response times, scalability
- **Usability**: User experience, accessibility, intuitive design
- **Compatibility**: Cross-browser, cross-device testing
- **Security**: Vulnerability assessment, penetration testing
- **Reliability**: Error handling, data integrity, system stability

## 3. Test Cases

### 3.1 Authentication Test Cases

#### TC001: User Registration
- **Objective**: Verify user can successfully register with valid information
- **Preconditions**: User is on registration page
- **Steps**:
  1. Enter valid email address
  2. Enter strong password
  3. Confirm password
  4. Enter full name
  5. Click "Register" button
- **Expected Result**: User account created, redirect to dashboard
- **Priority**: High

#### TC002: User Login
- **Objective**: Verify registered user can log in successfully
- **Preconditions**: User account exists in system
- **Steps**:
  1. Navigate to login page
  2. Enter valid email and password
  3. Click "Login" button
- **Expected Result**: User authenticated, redirected to dashboard
- **Priority**: High

#### TC003: Invalid Login Attempt
- **Objective**: Verify system handles invalid credentials properly
- **Preconditions**: User is on login page
- **Steps**:
  1. Enter invalid email or password
  2. Click "Login" button
- **Expected Result**: Error message displayed, user remains on login page
- **Priority**: High

### 3.2 Task Management Test Cases

#### TC004: Create New Task
- **Objective**: Verify user can create a new task successfully
- **Preconditions**: User is logged in and on dashboard
- **Steps**:
  1. Click "Add Task" button
  2. Enter task title
  3. Enter task description (optional)
  4. Set priority level
  5. Set due date (optional)
  6. Click "Save" button
- **Expected Result**: Task created and displayed in task list
- **Priority**: High

#### TC005: Mark Task as Complete
- **Objective**: Verify user can mark tasks as completed
- **Preconditions**: At least one active task exists
- **Steps**:
  1. Locate task in task list
  2. Click checkbox next to task
- **Expected Result**: Task marked as complete, visual state updated
- **Priority**: High

#### TC006: Edit Existing Task
- **Objective**: Verify user can modify existing task details
- **Preconditions**: At least one task exists
- **Steps**:
  1. Click on task to open details
  2. Click "Edit" button
  3. Modify task information
  4. Click "Save" button
- **Expected Result**: Task updated with new information
- **Priority**: Medium

### 3.3 UI/UX Test Cases

#### TC007: Responsive Design
- **Objective**: Verify application works correctly on different screen sizes
- **Preconditions**: Application loaded in browser
- **Steps**:
  1. Test on mobile device (320px-768px)
  2. Test on tablet device (768px-1024px)
  3. Test on desktop (1024px+)
- **Expected Result**: Layout adapts properly, all functions accessible
- **Priority**: High

#### TC008: Accessibility Compliance
- **Objective**: Verify application meets WCAG 2.1 AA standards
- **Preconditions**: Application loaded
- **Steps**:
  1. Test keyboard navigation
  2. Test screen reader compatibility
  3. Verify color contrast ratios
  4. Test with assistive technologies
- **Expected Result**: All accessibility standards met
- **Priority**: High

## 4. Performance Testing

### 4.1 Load Testing Scenarios
- **Scenario 1**: 100 concurrent users performing normal operations
- **Scenario 2**: 500 concurrent users during peak usage
- **Scenario 3**: Database stress testing with 10,000+ tasks
- **Scenario 4**: API response time under various loads

### 4.2 Performance Benchmarks
- **Page Load Time**: < 3 seconds on 3G connection
- **API Response Time**: < 500ms for CRUD operations
- **Database Query Time**: < 100ms for simple queries
- **Memory Usage**: < 50MB per user session

## 5. Security Testing

### 5.1 Security Test Cases
- **Authentication Bypass**: Attempt to access protected routes without authentication
- **SQL Injection**: Test input fields for SQL injection vulnerabilities
- **XSS Prevention**: Test for cross-site scripting vulnerabilities
- **JWT Security**: Verify token expiration and refresh mechanisms
- **Rate Limiting**: Test API rate limiting effectiveness

### 5.2 Security Checklist
- ✅ Password strength validation
- ✅ Secure password storage (bcrypt)
- ✅ JWT token security
- ✅ Input validation and sanitization
- ✅ HTTPS enforcement
- ✅ CORS configuration
- ✅ Rate limiting implementation

## 6. Browser Compatibility

### 6.1 Supported Browsers
- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions
- **Mobile Safari**: iOS 14+
- **Chrome Mobile**: Android 10+

## 7. Test Automation

### 7.1 Automated Test Coverage
- **Unit Tests**: 90%+ code coverage for critical functions
- **Integration Tests**: All API endpoints and database operations
- **E2E Tests**: Critical user journeys and workflows
- **Visual Regression Tests**: UI component consistency

### 7.2 CI/CD Testing Pipeline
\`\`\`yaml
Testing Pipeline:
1. Unit Tests (Jest)
2. Integration Tests (Supertest)
3. E2E Tests (Playwright)
4. Security Scans (OWASP ZAP)
5. Performance Tests (Lighthouse CI)
6. Accessibility Tests (axe-core)
\`\`\`

## 8. Bug Tracking and Reporting

### 8.1 Bug Severity Levels
- **Critical**: Application crashes, data loss, security vulnerabilities
- **High**: Major functionality broken, blocking user workflows
- **Medium**: Minor functionality issues, workarounds available
- **Low**: Cosmetic issues, minor usability problems

### 8.2 Bug Report Template
\`\`\`
Bug ID: BUG-YYYY-MM-DD-###
Title: [Brief description]
Severity: [Critical/High/Medium/Low]
Environment: [Browser, OS, Device]
Steps to Reproduce:
1. Step one
2. Step two
3. Step three

Expected Result: [What should happen]
Actual Result: [What actually happens]
Screenshots: [If applicable]
Additional Notes: [Any other relevant information]
\`\`\`

## 9. Test Environment Setup
- **Development**: Local development environment
- **Staging**: Production-like environment for integration testing
- **Production**: Live application environment
- **Test Data**: Sanitized production data for realistic testing

## 10. Success Criteria
- ✅ All critical and high priority test cases pass
- ✅ Performance benchmarks met
- ✅ Security vulnerabilities addressed
- ✅ Accessibility compliance achieved
- ✅ Cross-browser compatibility verified
- ✅ User acceptance testing completed successfully

## 11. Next Steps
1. Set up test environments
2. Begin test case execution
3. Implement automated testing pipeline
4. Conduct performance and security testing
5. User acceptance testing with stakeholders
6. Final bug fixes and regression testing
`
    };
  }

  generateGenericContent(agent, projectName, context) {
    return {
      title: `${agent.agent.name || agent.id} Analysis`,
      type: 'Analysis Report',
      filename: `${agent.id}-analysis.md`,
      content: `# ${agent.agent.name || agent.id} Analysis for ${projectName}

## Executive Summary
This document presents the ${agent.persona?.role || 'specialist'} perspective on ${projectName} based on the project requirements.

## Analysis Overview
As a ${agent.persona?.role || 'specialist'}, I have reviewed the requirements for ${projectName} and provide the following insights:

### Key Considerations
1. **Technical Feasibility**: The project requirements are technically sound and achievable
2. **Best Practices**: Implementation should follow industry standards
3. **Quality Assurance**: Thorough testing and validation required
4. **Timeline**: Realistic development timeline needed for quality delivery

### Recommendations
1. Follow established patterns and conventions
2. Prioritize user experience and accessibility
3. Implement proper security measures
4. Plan for scalability and maintainability

### Risk Assessment
- **Low Risk**: Well-defined requirements and proven technology stack
- **Mitigation**: Regular code reviews and testing protocols
- **Success Factors**: Clear communication and iterative development

## Implementation Notes
The ${agent.persona?.role || 'specialist'} analysis confirms that this project aligns with modern development practices and can be successfully implemented with proper planning and execution.

## Next Steps
1. Proceed to the next phase of development
2. Coordinate with other team members
3. Regular progress reviews and adjustments
4. Maintain focus on quality and user needs

---
*Report generated by ${agent.agent.name || agent.id} (${agent.persona?.role || 'AI Agent'})*
*Generated at: ${new Date().toISOString()}*
`
    };
  }

  /**
   * Parse user prompt to extract project context (reused from original)
   */
  parseUserPrompt(userPrompt) {
    const prompt = userPrompt.toLowerCase();
    const features = [];
    let projectName = 'Project';
    let projectType = 'web_app';

    // Extract project name
    const todoMatch = prompt.match(/to-?do\s+app/i);
    const ecommerceMatch = prompt.match(/e-?commerce|shop|store/i);
    const blogMatch = prompt.match(/blog|cms/i);
    
    if (todoMatch) {
      projectName = 'To-Do App';
      projectType = 'task_management';
    } else if (ecommerceMatch) {
      projectName = 'E-Commerce Platform';
      projectType = 'ecommerce';
    } else if (blogMatch) {
      projectName = 'Blog/CMS';
      projectType = 'content_management';
    }

    // Extract features
    if (prompt.includes('jwt') || prompt.includes('auth')) {
      features.push('authentication');
    }
    if (prompt.includes('registration') || prompt.includes('signup') || prompt.includes('register')) {
      features.push('user_registration');
    }
    if (prompt.includes('task') || prompt.includes('todo') || prompt.includes('management')) {
      features.push('task_management');
    }
    if (prompt.includes('modern ui') || prompt.includes('clean ui') || prompt.includes('responsive')) {
      features.push('modern_ui');
    }

    return {
      projectName,
      projectType,
      features,
      originalPrompt: userPrompt
    };
  }

  /**
   * Create mock execution for client-side or fallback
   */
  createMockExecution(agent, context) {
    return {
      agentId: agent.id,
      agentName: agent.agent.name || agent.id,
      executionTime: 2000,
      artifacts: [{
        type: 'document',
        name: `Mock ${agent.agent.name} Output`,
        description: `Simulated output from ${agent.persona.role}`,
        content: `Mock content generated by ${agent.agent.name}`,
        metadata: { mock: true }
      }],
      messages: [
        `Mock execution for ${agent.agent.name}`,
        'Real execution requires server environment'
      ],
      success: true,
      mock: true
    };
  }

  /**
   * Configure mock settings
   */
  setMockDelay(delayMs) {
    this.mockDelayMs = delayMs;
  }

  setMockFailureRate(rate) {
    this.mockFailureRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Clear caches (same as original)
   */
  clearCache() {
    this.taskCache.clear();
    this.templateCache.clear();
    this.checklistCache.clear();
  }
}

module.exports = { MockAgentExecutor };