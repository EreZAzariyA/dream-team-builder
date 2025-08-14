/** @type {import('tailwindcss').Config} */

// Dream Team Custom Tailwind Configuration for v4
// Dark mode is now configured in CSS via @variant directive

module.exports = {
  // Content scanning for Tailwind v4
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Note: darkMode config moved to CSS @variant in globals.css
  theme: {
    extend: {
      // Colors - Professional AI Platform Palette
      colors: {
        // Primary Brand Colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#0066cc',
          600: '#0056b3',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Secondary Brand Colors
        secondary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Accent Colors
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // AI Agent Role Colors
        agent: {
          pm: {
            50: '#faf5ff',
            100: '#f3e8ff',
            200: '#e9d5ff',
            300: '#d8b4fe',
            400: '#c084fc',
            500: '#8b5cf6',
            600: '#7c3aed',
            700: '#6d28d9',
            800: '#5b21b6',
            900: '#4c1d95',
          },
          architect: {
            50: '#ecfeff',
            100: '#cffafe',
            200: '#a5f3fc',
            300: '#67e8f9',
            400: '#22d3ee',
            500: '#06b6d4',
            600: '#0891b2',
            700: '#0e7490',
            800: '#155e75',
            900: '#164e63',
          },
          developer: {
            50: '#ecfdf5',
            100: '#d1fae5',
            200: '#a7f3d0',
            300: '#6ee7b7',
            400: '#34d399',
            500: '#10b981',
            600: '#059669',
            700: '#047857',
            800: '#065f46',
            900: '#064e3b',
          },
          qa: {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f',
          },
          ux: {
            50: '#fdf2f8',
            100: '#fce7f3',
            200: '#fbcfe8',
            300: '#f9a8d4',
            400: '#f472b6',
            500: '#ec4899',
            600: '#db2777',
            700: '#be185d',
            800: '#9d174d',
            900: '#831843',
          },
          data: {
            50: '#f5f3ff',
            100: '#ede9fe',
            200: '#ddd6fe',
            300: '#c4b5fd',
            400: '#a78bfa',
            500: '#7c3aed',
            600: '#7c3aed',
            700: '#6d28d9',
            800: '#5b21b6',
            900: '#4c1d95',
          },
        },
        // Professional Status Colors
        status: {
          active: '#10b981',
          'active-bg': '#ecfdf5',
          available: '#6b7280',
          'available-bg': '#f9fafb',
          busy: '#f59e0b',
          'busy-bg': '#fffbeb',
          error: '#ef4444',
          'error-bg': '#fef2f2',
          offline: '#9ca3af',
          'offline-bg': '#f3f4f6',
        },
        // Priority Colors
        priority: {
          critical: '#dc2626',
          'critical-bg': '#fef2f2',
          high: '#ea580c',
          'high-bg': '#fff7ed',
          medium: '#ca8a04',
          'medium-bg': '#fefce8',
          low: '#65a30d',
          'low-bg': '#f7fee7',
        },
      },

      borderColor: {
        'status-active': 'var(--color-status-active-border)',
        'status-available': 'var(--color-status-available-border)',
        'status-busy': 'var(--color-status-busy-border)',
        'status-error': 'var(--color-status-error-border)',
        'status-offline': 'var(--color-status-offline-border)',
      },

      // Typography - Professional Font System
      fontFamily: {
        primary: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        secondary: ['JetBrains Mono', 'Monaco', 'Consolas', 'monospace'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display': ['40px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'h1': ['30px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'h2': ['26px', { lineHeight: '1.3', letterSpacing: '0em' }],
        'h3': ['20px', { lineHeight: '1.4', letterSpacing: '0em' }],
        'h4': ['18px', { lineHeight: '1.5', letterSpacing: '0em' }],
        'h5': ['16px', { lineHeight: '1.5', letterSpacing: '0em' }],
        'h6': ['14px', { lineHeight: '1.5', letterSpacing: '0em' }],
        'body-large': ['16px', { lineHeight: '1.6', letterSpacing: '0em' }],
        'body': ['14px', { lineHeight: '1.6', letterSpacing: '0em' }],
        'body-small': ['12px', { lineHeight: '1.5', letterSpacing: '0em' }],
        'caption': ['10px', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        'code': ['12px', { lineHeight: '1.4', letterSpacing: '0em' }],
        'button': ['14px', { lineHeight: '1.5', letterSpacing: '0em' }],
      },

      // Spacing - 6px Grid System
      spacing: {
        '0.5': '2px',
        '1': '3px',
        '1.5': '5px',
        '2': '6px',
        '2.5': '8px',
        '3': '9px',
        '3.5': '11px',
        '4': '12px',
        '5': '15px',
        '6': '18px',
        '7': '21px',
        '8': '24px',
        '9': '27px',
        '10': '30px',
        '11': '33px',
        '12': '36px',
        '14': '42px',
        '16': '48px',
        '20': '60px',
        '24': '72px',
        '28': '84px',
        '32': '96px',
        '36': '108px',
        '40': '120px',
        '44': '132px',
        '48': '144px',
        '52': '156px',
        '56': '168px',
        '60': '180px',
        '64': '192px',
        '72': '216px',
        '80': '240px',
        '96': '288px',
      },

      // Professional Shadow System
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.15), 0 10px 10px rgba(0, 0, 0, 0.04)',
        'inner': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
        
        // Colored Shadows for Professional Status
        'primary': '0 4px 14px rgba(0, 102, 204, 0.15)',
        'success': '0 4px 14px rgba(16, 185, 129, 0.15)',
        'warning': '0 4px 14px rgba(245, 158, 11, 0.15)',
        'error': '0 4px 14px rgba(239, 68, 68, 0.15)',
        
        // Agent Role Shadows
        'agent-pm': '0 4px 14px rgba(139, 92, 246, 0.15)',
        'agent-architect': '0 4px 14px rgba(6, 182, 212, 0.15)',
        'agent-developer': '0 4px 14px rgba(16, 185, 129, 0.15)',
        'agent-qa': '0 4px 14px rgba(245, 158, 11, 0.15)',
        'agent-ux': '0 4px 14px rgba(236, 72, 153, 0.15)',
        'agent-data': '0 4px 14px rgba(124, 58, 237, 0.15)',
        
        // Focus Shadows for Accessibility
        'focus-primary': '0 0 0 3px rgba(0, 102, 204, 0.2)',
        'focus-success': '0 0 0 3px rgba(16, 185, 129, 0.2)',
        'focus-warning': '0 0 0 3px rgba(245, 158, 11, 0.2)',
        'focus-error': '0 0 0 3px rgba(239, 68, 68, 0.2)',
      },

      // Professional Border Radius
      borderRadius: {
        'none': '0px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        'full': '9999px',
      },

      // Animation System
      transitionDuration: {
        'instant': '0ms',
        'fast': '150ms',
        'normal': '300ms',
        'slow': '500ms',
        'slower': '750ms',
      },
      transitionTimingFunction: {
        'linear': 'linear',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'professional': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'snappy': 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
      },

      // Professional Layout
      maxWidth: {
        'container': '1200px',
      },
      height: {
        'navbar': '64px',
        'header': '48px',
        'footer': '40px',
      },
      width: {
        'sidebar': '256px',
      },

      // Component-Specific Spacing
      padding: {
        'agent-card': '18px',
        'workflow-timeline': '24px',
        'chat-message': '12px',
        'modal': '18px',
        'button-x': '12px',
        'button-y': '6px',
      },
      margin: {
        'agent-card': '12px',
        'workflow-timeline': '18px',
        'chat-message': '6px',
        'section': '24px',
      },

      // Professional Animations
      keyframes: {
        'agent-pulse': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'workflow-progress': {
          '0%': { width: '0%' },
          '100%': { width: 'var(--progress-width, 100%)' },
        },
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'slide-in-up': {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          'from': { opacity: '0', transform: 'scale(0.9)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        'professional-bounce': {
          '0%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.05)' },
          '50%': { transform: 'scale(0.98)' },
          '75%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        'data-update': {
          '0%': { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
          '50%': { backgroundColor: 'rgba(16, 185, 129, 0.3)' },
          '100%': { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
        },
      },
      animation: {
        'agent-pulse': 'agent-pulse 2s ease-in-out infinite',
        'workflow-progress': 'workflow-progress 2s ease-out forwards',
        'fade-in': 'fade-in 300ms ease-out forwards',
        'slide-in-up': 'slide-in-up 300ms ease-out forwards',
        'scale-in': 'scale-in 300ms ease-out forwards',
        'professional-bounce': 'professional-bounce 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'data-update': 'data-update 1s ease-in-out',
      },
    },
  },
  plugins: [
    // Professional Form Styling
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
    
    // Typography Plugin for Rich Text
    require('@tailwindcss/typography'),
    
    // Custom Plugin for Dream Team Components
    function({ addComponents, theme }) {
      addComponents({
        // Professional Agent Card Component
        '.agent-card': {
          backgroundColor: theme('colors.gray.50'),
          border: `1px solid ${theme('colors.gray.200')}`,
          borderRadius: theme('borderRadius.lg'),
          padding: theme('padding.agent-card'),
          boxShadow: theme('boxShadow.sm'),
          transition: `all ${theme('transitionDuration.normal')} ${theme('transitionTimingFunction.ease-out')}`,
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme('boxShadow.md'),
          },
          '&.active': {
            borderColor: theme('colors.agent.developer.500'),
            boxShadow: theme('boxShadow.agent-developer'),
          },
        },
        
        // Workflow Timeline Component
        '.workflow-timeline': {
          padding: theme('padding.workflow-timeline'),
          margin: theme('margin.workflow-timeline'),
          boxShadow: theme('boxShadow.md'),
          borderRadius: theme('borderRadius.lg'),
        },
        
        // Professional Button Styles
        '.btn-primary': {
          backgroundColor: theme('colors.primary.600'),
          color: theme('colors.white'),
          padding: `${theme('padding.button-y')} ${theme('padding.button-x')}`,
          borderRadius: theme('borderRadius.md'),
          fontWeight: theme('fontWeight.medium'),
          transition: `all ${theme('transitionDuration.fast')} ${theme('transitionTimingFunction.ease-out')}`,
          '&:hover': {
            backgroundColor: theme('colors.primary.700'),
            transform: 'translateY(-1px)',
            boxShadow: theme('boxShadow.sm'),
          },
          '&:active': {
            transform: 'translateY(0)',
          },
          '&:focus': {
            outline: 'none',
            boxShadow: theme('boxShadow.focus-primary'),
          },
        },
        
        // Status Indicator Components
        '.status-active': {
          color: theme('colors.status.active'),
          backgroundColor: theme('colors.status.active-bg'),
          border: `1px solid ${theme('colors.status.active')}`,
          borderRadius: theme('borderRadius.full'),
          padding: `${theme('spacing.0.5')} ${theme('spacing.2')}`,
          fontSize: theme('fontSize.caption[0]'),
          fontWeight: theme('fontWeight.medium'),
        },
        
        '.status-busy': {
          color: theme('colors.status.busy'),
          backgroundColor: theme('colors.status.busy-bg'),
          border: `1px solid ${theme('colors.status.busy')}`,
          borderRadius: theme('borderRadius.full'),
          padding: `${theme('spacing.0.5')} ${theme('spacing.2')}`,
          fontSize: theme('fontSize.caption[0]'),
          fontWeight: theme('fontWeight.medium'),
        },
        
        '.status-error': {
          color: theme('colors.status.error'),
          backgroundColor: theme('colors.status.error-bg'),
          border: `1px solid ${theme('colors.status.error')}`,
          borderRadius: theme('borderRadius.full'),
          padding: `${theme('spacing.0.5')} ${theme('spacing.2')}`,
          fontSize: theme('fontSize.caption[0]'),
          fontWeight: theme('fontWeight.medium'),
        },
        
        // Professional Container
        '.container-professional': {
          maxWidth: theme('maxWidth.container'),
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingLeft: theme('spacing.4'),
          paddingRight: theme('spacing.4'),
        },
        
        // Mobile Touch Targets
        '.touch-target': {
          minHeight: theme('spacing.11'),
          minWidth: theme('spacing.11'),
        },
      })
    },
  ],
}