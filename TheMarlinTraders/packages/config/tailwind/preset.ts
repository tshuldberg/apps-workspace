import type { Config } from 'tailwindcss'

const preset: Config = {
  content: [],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Base
        'navy-black': '#0a0a0f',
        'navy-dark': '#0f0f1a',
        'navy-mid': '#1a1a2e',
        'navy-light': '#2a2a3e',

        // Trading
        'trading-green': '#22c55e',
        'trading-red': '#ef4444',
        'trading-green-dim': '#16a34a',
        'trading-red-dim': '#dc2626',

        // Accent
        accent: '#3b82f6',
        'accent-hover': '#2563eb',
        'accent-dim': '#1d4ed8',

        // Neutral
        'text-primary': '#f8fafc',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',
        border: '#1e293b',
        'border-hover': '#334155',

        // Semantic
        warning: '#f59e0b',
        info: '#06b6d4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'ticker': ['0.625rem', { lineHeight: '1', letterSpacing: '0.05em' }],
        'price': ['1.125rem', { lineHeight: '1.2', fontWeight: '600' }],
        'price-lg': ['1.5rem', { lineHeight: '1.2', fontWeight: '700' }],
      },
      spacing: {
        'panel-gap': '2px',
        'toolbar-h': '36px',
        'sidebar-w': '280px',
        'header-h': '48px',
      },
      borderRadius: {
        panel: '6px',
      },
      animation: {
        'flash-green': 'flash-green 0.3s ease-out',
        'flash-red': 'flash-red 0.3s ease-out',
      },
      keyframes: {
        'flash-green': {
          '0%': { backgroundColor: 'rgba(34, 197, 94, 0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'flash-red': {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
}

export default preset
