# Dream Team Design Tokens

Professional design token system for the Dream Team AI Agent Orchestration Platform.

## 🎯 Overview

This design token system provides a comprehensive foundation for building consistent, professional UI components. It's specifically tailored for enterprise AI platforms with complex workflows, real-time collaboration, and multi-agent coordination.

## 📁 File Structure

```
styles/tokens/
├── index.css          # Main import file - use this!
├── colors.css         # Color palette & agent theming
├── typography.css     # Font system & text styles  
├── spacing.css        # 8px grid system & spacing
├── shadows.css        # Professional depth & elevation
├── animations.css     # Motion system & micro-interactions
└── README.md          # This documentation
```

## 🚀 Quick Start

### 1. Import in your Next.js app

**Option A: Global Import (Recommended)**
```javascript
// pages/_app.js or app/layout.js
import '../styles/tokens/index.css';
```

**Option B: Component-Specific Import**
```javascript
// In your component file
import '../styles/tokens/index.css';
```

### 2. Use Design Tokens

**CSS Variables:**
```css
.my-component {
  /* Colors */
  color: var(--color-primary-600);
  background: var(--color-gray-50);
  
  /* Typography */
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  
  /* Spacing */
  padding: var(--spacing-md);
  margin: var(--spacing-lg);
  
  /* Shadows */
  box-shadow: var(--shadow-sm);
  
  /* Animations */
  transition: all var(--duration-normal) var(--ease-out);
}
```

**Utility Classes:**
```jsx
<div className="text-h3 p-6 shadow-md animate-fade-in">
  Professional Component
</div>
```

## 🎨 Design Token Categories

### Colors (`colors.css`)

#### Brand Colors
- **Primary**: `--color-primary-500` (#0066CC) - Trust, reliability
- **Secondary**: `--color-secondary-500` (#6366F1) - Innovation, intelligence  
- **Accent**: `--color-accent-500` (#8B5CF6) - Premium features

#### AI Agent Colors
Each agent has dedicated theming:
- **PM Agent**: `--color-agent-pm-500` (#8B5CF6) - Purple
- **Architect**: `--color-agent-architect-500` (#06B6D4) - Cyan
- **Developer**: `--color-agent-developer-500` (#10B981) - Green
- **QA Agent**: `--color-agent-qa-500` (#F59E0B) - Amber
- **UX Expert**: `--color-agent-ux-500` (#EC4899) - Pink
- **Data Architect**: `--color-agent-data-500` (#7C3AED) - Purple

#### Status Colors
- **Success**: `--color-success-500` (#10B981)
- **Warning**: `--color-warning-500` (#F59E0B)
- **Error**: `--color-error-500` (#EF4444)
- **Info**: `--color-info-500` (#06B6D4)

### Typography (`typography.css`)

#### Font Families
- **Primary**: Inter (professional, readable)
- **Secondary**: JetBrains Mono (code, technical data)
- **Display**: Inter (large headings)

#### Type Scale
- **Display**: 48px - Hero headings
- **H1**: 36px - Page titles
- **H2**: 30px - Section headings  
- **H3**: 24px - Component titles
- **Body**: 16px - Standard text
- **Caption**: 12px - Metadata

### Spacing (`spacing.css`)

#### 8px Grid System
- **xs**: 4px - Tight spacing
- **sm**: 8px - Component padding
- **md**: 16px - Standard spacing
- **lg**: 24px - Section spacing
- **xl**: 32px - Major gaps
- **2xl**: 48px - Page sections

#### Component-Specific
- **Agent Cards**: 24px padding, 16px margin
- **Workflow Timeline**: 32px padding, 24px margin
- **Chat Messages**: 16px padding, 8px margin
- **Mobile Touch**: 44px minimum target size

### Shadows (`shadows.css`)

#### Elevation Levels
- **sm**: Subtle cards, inputs
- **md**: Buttons, elevated cards
- **lg**: Modals, dropdowns
- **xl**: Major overlays
- **2xl**: Maximum elevation

#### Colored Shadows
- Agent-specific shadows for role recognition
- Status shadows for professional feedback
- Focus shadows for accessibility

### Animations (`animations.css`)

#### Duration & Easing
- **fast**: 150ms - Quick interactions
- **normal**: 300ms - Standard transitions
- **slow**: 500ms - Complex animations
- **ease-out**: Entering elements
- **ease-in**: Exiting elements
- **ease-professional**: Smooth, polished motion

## 🛠️ Professional Components

### Agent Cards
```css
.agent-card {
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: var(--spacing-agent-card-padding);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-normal) var(--ease-out);
}

.agent-card--active {
  border-color: var(--color-agent-developer-500);
  box-shadow: var(--shadow-agent-developer);
}
```

### Workflow Timeline
```css
.workflow-timeline {
  padding: var(--spacing-workflow-timeline-padding);
  margin: var(--spacing-workflow-timeline-margin);
  box-shadow: var(--shadow-md);
}
```

### Professional Status
```css
.status-active {
  color: var(--color-status-active);
  background: var(--color-status-active-bg);
  border: 1px solid var(--color-status-active-border);
}
```

## 🌙 Dark Mode Support

All tokens include automatic dark mode support:

**CSS Media Query:**
```css
@media (prefers-color-scheme: dark) {
  /* Tokens automatically adjust */
}
```

**Class-based:**
```css
.dark {
  /* Manual dark mode toggle */
}
```

## 📱 Mobile Optimization

Responsive adjustments included:
- Smaller font sizes on mobile
- Reduced shadows for performance
- Larger touch targets (44px minimum)
- Adjusted spacing for mobile screens

## ♿ Accessibility

Built-in accessibility features:
- WCAG compliant color contrasts
- Focus indicators with proper visibility
- Reduced motion support
- Screen reader friendly markup
- Minimum touch target sizes

## 🎯 Professional Usage Examples

### Agent Status Card
```jsx
<div className="agent-card agent-card--active">
  <div className="text-h4 text-agent-developer mb-2">
    Developer Agent
  </div>
  <div className="text-body-small text-secondary">
    Currently implementing authentication system
  </div>
  <div className="status-active mt-4 px-3 py-1 rounded-full text-caption">
    Active
  </div>
</div>
```

### Workflow Progress
```jsx
<div className="workflow-timeline">
  <h3 className="text-h3 mb-6">Full-Stack Development</h3>
  <div className="flex items-center gap-4">
    <div className="w-8 h-8 bg-agent-pm rounded-full shadow-agent-pm animate-pulse"></div>
    <div className="text-body">PM Agent - Requirements Analysis</div>
  </div>
</div>
```

### Professional Dashboard
```jsx
<div className="container-spacing">
  <h1 className="text-display mb-8">Dream Team Dashboard</h1>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div className="card-spacing shadow-md bg-white rounded-lg">
      <h3 className="text-h3 text-primary mb-4">Active Workflows</h3>
      <div className="text-display text-success">12</div>
    </div>
  </div>
</div>
```

## 🔧 Customization

To customize tokens for your specific needs:

1. **Override variables:**
```css
:root {
  --color-primary-500: #your-brand-color;
  --font-family-primary: YourFont, sans-serif;
}
```

2. **Add custom tokens:**
```css
:root {
  --color-custom-feature: #FF6B6B;
  --spacing-custom: 20px;
}
```

3. **Create component variants:**
```css
.agent-card--custom {
  border-color: var(--color-custom-feature);
  box-shadow: 0 4px 14px rgba(255, 107, 107, 0.15);
}
```

## 🚀 Next Steps

1. **Import the token system** in your app
2. **Start with utility classes** for rapid development
3. **Create component styles** using CSS variables
4. **Customize colors** to match your brand
5. **Test dark mode** and responsive behavior

---

**This design token system transforms your Dream Team platform into a professional, enterprise-grade AI orchestration interface that users will trust and love to use.** 🎨✨