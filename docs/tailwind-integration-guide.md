# Dream Team Tailwind Integration Guide

Complete guide for integrating the professional design token system with Tailwind CSS.

## 🚀 Quick Setup

### 1. Replace your existing `tailwind.config.js`

```bash
# Backup existing config (optional)
mv tailwind.config.js tailwind.config.js.backup

# The new config is already created at the root of your project
```

### 2. Update your main CSS file

Replace your current CSS imports with:

```css
/* styles/globals.css or app/globals.css */
@import './tailwind-integration.css';
```

Or if you prefer separate imports:

```css
@import './tokens/index.css';
@tailwind base;
@tailwind components; 
@tailwind utilities;
```

### 3. Install required dependencies

```bash
npm install @tailwindcss/forms @tailwindcss/typography
```

## 🎨 New Professional Utilities

### Agent Role Classes

```jsx
// Agent-specific text colors
<div className="text-agent-pm">PM Agent</div>
<div className="text-agent-developer">Developer Agent</div>
<div className="text-agent-qa">QA Agent</div>

// Agent-specific backgrounds
<div className="bg-agent-architect">Architect Panel</div>
<div className="bg-agent-ux-soft">UX Expert Section</div>

// Agent-specific borders
<div className="border-agent-developer border-2">Active Developer</div>

// Agent-specific shadows
<div className="shadow-agent-pm">PM Agent Card</div>
```

### Professional Typography

```jsx
// Professional text hierarchy
<h1 className="text-display">Dream Team Dashboard</h1>
<h2 className="text-h1">Section Title</h2>
<h3 className="text-h2">Subsection</h3>
<p className="text-body">Standard body text</p>
<span className="text-caption">Metadata text</span>
<code className="text-code">Technical data</code>

// Professional text colors
<p className="text-professional">Main content</p>
<p className="text-professional-muted">Secondary content</p>
<p className="text-professional-subtle">Subtle content</p>
```

### Status Indicators

```jsx
// Professional status badges
<span className="status-active">Active</span>
<span className="status-busy">Busy</span>
<span className="status-error">Error</span>
<span className="status-offline">Offline</span>

// Priority indicators
<span className="priority-critical">Critical</span>
<span className="priority-high">High Priority</span>
<span className="priority-medium">Medium</span>
<span className="priority-low">Low Priority</span>
```

### Professional Buttons

```jsx
// Button variants with professional animations
<button className="btn-primary">Primary Action</button>
<button className="btn-secondary">Secondary Action</button>
<button className="btn-success">Success Action</button>
<button className="btn-outline">Outline Button</button>
<button className="btn-ghost">Ghost Button</button>
```

### Professional Cards

```jsx
// Card variants
<div className="card p-6">Basic Card</div>
<div className="card-hover p-6">Hoverable Card</div>
<div className="card-interactive p-6">Interactive Card</div>

// Agent-specific cards
<div className="card p-6 border-agent-developer shadow-agent-developer">
  Developer Agent Card
</div>
```

### Professional Forms

```jsx
// Form components
<div>
  <label className="form-label">Agent Name</label>
  <input className="form-input" type="text" />
  <p className="form-help">Enter the agent's display name</p>
</div>

// Error states
<div>
  <input className="form-input border-red-300" type="text" />
  <p className="form-error">This field is required</p>
</div>
```

## 🎯 Professional Component Examples

### Agent Status Card

```jsx
function AgentCard({ agent }) {
  return (
    <div className={`
      card-interactive p-6 
      ${agent.status === 'active' ? 'border-agent-developer shadow-agent-developer' : ''}
    `}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            agent.status === 'active' ? 'bg-agent-developer animate-agent-pulse' : 'bg-gray-400'
          }`} />
          <h3 className="text-h4 text-agent-developer">{agent.name}</h3>
        </div>
        <span className={`status-${agent.status}`}>
          {agent.status}
        </span>
      </div>
      
      <p className="text-body-small text-professional-muted mb-4">
        {agent.currentTask}
      </p>
      
      <div className="flex items-center justify-between">
        <div className="text-caption text-professional-subtle">
          Last updated: {agent.lastUpdated}
        </div>
        <button className="btn-ghost text-caption">
          View Details
        </button>
      </div>
    </div>
  );
}
```

### Workflow Timeline

```jsx
function WorkflowTimeline({ workflow }) {
  return (
    <div className="card p-8">
      <h2 className="text-h2 mb-6">Workflow Progress</h2>
      
      <div className="space-y-6">
        {workflow.steps.map((step, index) => (
          <div key={index} className="flex items-center space-x-4">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center
              ${step.completed ? 'bg-agent-developer text-white' : 
                step.active ? 'border-2 border-agent-developer animate-agent-pulse' : 
                'bg-gray-200'}
            `}>
              {step.completed ? '✓' : index + 1}
            </div>
            
            <div className="flex-1">
              <h4 className={`text-h5 ${
                step.active ? 'text-agent-developer' : 'text-professional'
              }`}>
                {step.title}
              </h4>
              <p className="text-body-small text-professional-muted">
                {step.description}
              </p>
            </div>
            
            {step.active && (
              <div className="text-caption bg-agent-developer-soft px-2 py-1 rounded">
                In Progress
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Professional Dashboard

```jsx
function Dashboard() {
  return (
    <div className="container-professional py-8">
      <div className="mb-8">
        <h1 className="text-display mb-2">Dream Team Dashboard</h1>
        <p className="text-body-large text-professional-muted">
          AI Agent Orchestration Platform
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="text-h4 mb-2">Active Workflows</h3>
          <div className="text-display text-agent-developer mb-2">12</div>
          <p className="text-body-small text-professional-muted">
            Currently running
          </p>
        </div>
        
        <div className="card p-6">
          <h3 className="text-h4 mb-2">Available Agents</h3>
          <div className="text-display text-agent-architect mb-2">8</div>
          <p className="text-body-small text-professional-muted">
            Ready for tasks
          </p>
        </div>
        
        <div className="card p-6">
          <h3 className="text-h4 mb-2">Completed Today</h3>
          <div className="text-display text-agent-qa mb-2">24</div>
          <p className="text-body-small text-professional-muted">
            Workflows finished
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <h3 className="text-h3 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {/* Activity items */}
          </div>
        </div>
        
        <div className="card p-6">
          <h3 className="text-h3 mb-4">Agent Status</h3>
          <div className="space-y-4">
            {/* Agent status items */}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Professional Modal

```jsx
function WorkflowModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Start New Workflow</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="form-label">Workflow Type</label>
            <select className="form-input">
              <option>Full-Stack Development</option>
              <option>Backend Service</option>
              <option>Frontend Application</option>
            </select>
          </div>
          
          <div>
            <label className="form-label">Project Description</label>
            <textarea className="form-input" rows="3" />
            <p className="form-help">
              Describe what you want to build
            </p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary">
            Start Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
```

## 🌙 Dark Mode Usage

Dark mode is automatically handled by the `dark:` prefix:

```jsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
  Content adapts to theme
</div>
```

Toggle dark mode in your app:

```jsx
// Using next-themes or similar
const { theme, setTheme } = useTheme();

<button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
  Toggle Theme
</button>
```

## 📱 Responsive Design

Professional responsive utilities included:

```jsx
<div className="
  grid 
  grid-cols-1 
  md:grid-cols-2 
  lg:grid-cols-3 
  gap-4 
  md:gap-6
">
  Responsive grid
</div>
```

## ♿ Accessibility Features

Built-in accessibility utilities:

```jsx
// Focus styles
<button className="focus:ring-2 focus:ring-primary-500">
  Accessible Button
</button>

// Touch targets
<button className="touch-target">
  Mobile-friendly
</button>

// High contrast support
<div className="border border-gray-300 contrast-more:border-gray-900">
  High contrast ready
</div>
```

## 🎨 Custom Agent Themes

Create custom agent themes:

```css
/* Add to your CSS */
.agent-custom {
  --agent-color: #ff6b6b;
  --agent-color-bg: #fff5f5;
  --agent-color-border: #fed7d7;
}

.text-agent-custom { color: var(--agent-color); }
.bg-agent-custom { background-color: var(--agent-color); }
.border-agent-custom { border-color: var(--agent-color); }
```

## 🚀 Performance Tips

1. **Purge unused styles** (automatically handled in production)
2. **Use utility-first approach** for better tree-shaking
3. **Leverage component classes** for repeated patterns
4. **Import only needed plugins**

## 🔧 Troubleshooting

### Common Issues

**Colors not working?**
- Ensure you're importing `tailwind-integration.css`
- Check that dark mode is configured correctly

**Animations not smooth?**
- Verify GPU acceleration is enabled
- Check for `prefers-reduced-motion` settings

**Components not styled?**
- Make sure Tailwind is processing your files correctly
- Check the `content` paths in `tailwind.config.js`

### VSCode Setup

Install these extensions for better DX:
- Tailwind CSS IntelliSense
- PostCSS Language Support
- Headwind (class sorting)

Add to your VSCode settings:
```json
{
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["className:\\s*?[\"'`]([^\"'`]*).*?[\"'`]", "[\"'`]([^\"'`]*)[\"'`]"]
  ]
}
```

---

**Your Dream Team platform now has a complete, professional Tailwind integration that scales beautifully and maintains design consistency across all components!** 🎨✨