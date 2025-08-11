# Agent Teams Component

## Overview

The Agent Teams system is a core component of the BMAD (Business Methodology for Autonomous Development) platform that provides pre-configured bundles of specialized AI agents designed for different development scenarios. Each team includes specific agents and workflows optimized for particular use cases, enabling efficient orchestration of multi-agent development workflows.

## Architecture

### Core Components

```
components/agent-teams/
├── README.md                    # This documentation
├── components/                  # UI components (to be created)
│   ├── TeamCard.js             # Individual team display card
│   ├── TeamGrid.js             # Grid layout for teams
│   ├── TeamComparison.js       # Comparison table
│   ├── AgentList.js            # Agent display within teams
│   └── WorkflowList.js         # Workflow display within teams
├── hooks/                       # Custom hooks (to be created)
│   ├── useAgentTeams.js        # Team data fetching
│   └── useTeamDeployment.js    # Team deployment logic
└── utils/                       # Utilities (to be created)
    ├── teamHelpers.js          # Team processing utilities
    └── teamValidation.js       # Team configuration validation
```

### Data Flow

1. **Configuration Loading**: Teams are defined in `.bmad-core/agent-teams/*.yaml` files
2. **API Layer**: `/api/agent-teams` route reads and parses YAML configurations
3. **Frontend Display**: React components render team data with styling from `agentHelpers.js`
4. **Deployment**: Teams can be deployed for workflow execution (future implementation)

## Agent Teams Configuration

### Team Definition Structure (YAML)

```yaml
bundle:
  name: "Team Name"
  icon: "🚀"
  description: "Description of what this team does"
agents:
  - bmad-orchestrator
  - analyst
  - pm
  - architect
  - dev
workflows:
  - greenfield-fullstack.yaml
  - brownfield-service.yaml
```

### Available Teams

#### 1. Team All (`team-all.yaml`)
- **Purpose**: Complete comprehensive development team
- **Agents**: All core system agents (9 agents)
- **Workflows**: All available workflows 
- **Best For**: Large, complex projects requiring full BMAD capabilities
- **Icon**: 👥

#### 2. Team Fullstack (`team-fullstack.yaml`)
- **Purpose**: Full-stack application development
- **Agents**: bmad-orchestrator, analyst, pm, ux-expert, architect, po
- **Workflows**: All fullstack, service, and UI workflows
- **Best For**: Web applications, SaaS products, enterprise applications
- **Icon**: 🚀

#### 3. Team IDE Minimal (`team-ide-minimal.yaml`)
- **Purpose**: Minimal team for IDE development cycles
- **Agents**: po, sm, dev, qa
- **Workflows**: None (focuses on story-driven development)
- **Best For**: Simple development workflows, existing projects with clear requirements
- **Icon**: ⚡

#### 4. Team No UI (`team-no-ui.yaml`)
- **Purpose**: Backend and service development without UI planning
- **Agents**: bmad-orchestrator, analyst, pm, architect, po
- **Workflows**: Service-focused workflows (greenfield-service, brownfield-service)
- **Best For**: APIs, microservices, backend systems
- **Icon**: 🔧

## Core Agents

### Planning & Analysis Agents
- **analyst** (Mary, 📊): Market research, brainstorming, competitive analysis, project briefing
- **pm** (Project Manager): PRD creation, feature prioritization, strategic planning
- **architect** (System Architect): Technical architecture, system design, scalability planning

### Design & User Experience
- **ux-expert** (UX Designer): UI/UX design, prototypes, user experience optimization

### Development & Quality
- **dev** (Developer): Code implementation, debugging, feature development
- **qa** (QA Engineer): Test planning, quality assurance, bug validation

### Coordination & Management
- **po** (Product Owner): Backlog management, story validation, acceptance criteria
- **sm** (Scrum Master): Sprint planning, story creation, workflow management
- **bmad-orchestrator** (Orchestrator): Multi-agent coordination, workflow orchestration

## Workflow Integration

### Phase 1: Planning (Web UI)
Teams are used in web interfaces (ChatGPT, Claude, Gemini) where large context windows enable:
- Comprehensive document generation (PRDs, Architecture specs)
- Multi-agent brainstorming and collaboration
- Strategic planning and requirement gathering

### Phase 2: Development (IDE)
Teams transition to IDE environments for:
- Document sharding and story creation
- Sequential SM → Dev → QA cycles
- Real-time implementation and testing

### Workflow Types

1. **Greenfield Workflows**: Building new projects from scratch
   - `greenfield-fullstack.yaml`: Complete application development
   - `greenfield-service.yaml`: New service/API development
   - `greenfield-ui.yaml`: Frontend-only projects

2. **Brownfield Workflows**: Enhancing existing projects
   - `brownfield-fullstack.yaml`: Adding features to existing apps
   - `brownfield-service.yaml`: Extending existing services
   - `brownfield-ui.yaml`: UI improvements and additions

## Component Implementation

### Current Implementation (`app/(dashboard)/agent-teams/page.js`)

The current monolithic component (205 lines) handles:
- Team configuration loading via API
- Grid layout display of team cards
- Agent list rendering within teams
- Workflow display and formatting
- Comparison table generation
- Error handling and loading states

### Planned Refactoring

Following the "small components" approach, the component should be broken down into:

#### 1. Container Components
- **AgentTeamsPage.js**: Main page container, data fetching, error handling
- **TeamGrid.js**: Grid layout manager for team cards

#### 2. Display Components  
- **TeamCard.js**: Individual team card with styling and interactions
- **AgentList.js**: Agent display within team cards
- **WorkflowList.js**: Workflow display and formatting
- **TeamComparison.js**: Comparison table component

#### 3. Utility Components
- **LoadingState.js**: Loading indicator with spinner
- **ErrorState.js**: Error display with retry options

#### 4. Custom Hooks
- **useAgentTeams.js**: Team data fetching with React Query (already exists)
- **useTeamDeployment.js**: Team deployment logic (future)

## API Integration

### Endpoint: `/api/agent-teams`

```javascript
GET /api/agent-teams
```

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "team-fullstack",
      "fileName": "team-fullstack.yaml",
      "name": "Team Fullstack",
      "icon": "🚀",
      "description": "Team capable of full stack development",
      "agents": ["bmad-orchestrator", "analyst", "pm", "ux-expert", "architect", "po"],
      "workflows": ["brownfield-fullstack.yaml", "greenfield-fullstack.yaml"]
    }
  ],
  "count": 4
}
```

### Error Handling

The API handles:
- Missing `.bmad-core/agent-teams` directory
- Invalid YAML file parsing
- File system access errors
- Graceful degradation when individual files fail to parse

## Styling System

### Agent Styling (`lib/utils/agentHelpers.js`)

Each agent has consistent color theming:
- **pm**: Purple theme (`text-purple-600`, `bg-purple-50`)
- **architect**: Cyan theme (`text-cyan-600`, `bg-cyan-50`)
- **dev**: Green theme (`text-green-600`, `bg-green-50`)
- **qa**: Orange theme (`text-orange-600`, `bg-orange-50`)

### Team Styling

Teams have distinct visual identities:
- **team-all**: Blue theme with 👥 emoji
- **team-fullstack**: Purple theme with 🚀 emoji  
- **team-ide-minimal**: Green theme with ⚡ emoji
- **team-no-ui**: Orange theme with 🔧 emoji

## Usage Patterns

### 1. Team Selection
Users browse available teams based on:
- Project type (greenfield vs brownfield)
- Scope (fullstack, backend-only, minimal)
- Team size preferences
- Workflow complexity needs

### 2. Team Deployment
Teams are deployed to initiate workflows:
- Configuration validation
- Agent instantiation
- Workflow template loading
- Real-time collaboration setup

### 3. Workflow Execution
Once deployed, teams execute structured workflows:
- Sequential agent handoffs
- Document generation and validation
- Story creation and implementation
- Quality assurance and review cycles

## Development Considerations

### Performance
- Team configurations are cached via React Query (30-minute stale time)
- YAML parsing happens server-side to reduce client bundle size
- Error boundaries prevent team loading failures from breaking the entire interface

### Extensibility
- New teams can be added by creating YAML files in `.bmad-core/agent-teams/`
- Custom agents can be integrated through the agent system
- Workflows can be mixed and matched across teams

### Testing Strategy
- Unit tests for individual components
- Integration tests for API endpoints
- E2E tests for team deployment workflows
- Mock data for consistent testing

## Future Enhancements

### Team Customization
- Custom team builder interface
- Agent role modification
- Workflow sequence customization
- Team templates and presets

### Advanced Features
- Team performance analytics
- Workflow success metrics
- Agent utilization tracking
- Cost optimization insights

### Integration Improvements
- IDE-specific team configurations
- Git workflow integration
- Slack/Teams notifications
- Project management tool synchronization

## Best Practices

### Configuration Management
- Use semantic team names that clearly indicate purpose
- Maintain consistent YAML structure across team files
- Document team capabilities and limitations
- Version control team configurations

### UI/UX Guidelines
- Provide clear visual distinction between team types
- Show agent count and workflow count prominently
- Enable easy comparison between teams
- Offer helpful descriptions and use case guidance

### Error Handling
- Graceful degradation when teams fail to load
- Clear error messages for configuration issues
- Fallback options when preferred teams are unavailable
- Retry mechanisms for transient failures

---

This README provides comprehensive documentation for understanding, implementing, and extending the Agent Teams component within the BMAD platform. The modular architecture supports both current functionality and future enhancements while maintaining clean separation of concerns.