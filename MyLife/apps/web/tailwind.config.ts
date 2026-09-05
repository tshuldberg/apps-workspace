import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../MyWorkouts/apps/web/app/**/*.{ts,tsx}',
    '../../MyWorkouts/apps/web/lib/**/*.{ts,tsx}',
    '../../MyHomes/apps/web/src/**/*.{ts,tsx}',
    '../../MySurf/apps/web/app/**/*.{ts,tsx}',
    '../../MySurf/apps/web/components/**/*.{ts,tsx}',
    '../../MySurf/apps/web/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        terracotta: {
          50: '#FDF5F0',
          100: '#FAEADF',
          200: '#F3D0B8',
          300: '#ECB691',
          400: '#D88A5E',
          500: '#C4704B',
          600: '#A85A3A',
          700: '#8C472E',
          800: '#703822',
          900: '#5A2D1B',
        },
        sage: {
          50: '#F4F6F2',
          100: '#E8EDE4',
          200: '#D1DBCA',
          300: '#B5C4A9',
          400: '#96AB86',
          500: '#7A8B6F',
          600: '#617059',
          700: '#4D5946',
          800: '#3E4838',
          900: '#323A2E',
        },
        'warm-white': '#FAF7F2',
        charcoal: {
          50: '#F5F5F5',
          100: '#E5E5E5',
          200: '#CCCCCC',
          300: '#B0B0B0',
          400: '#8A8A8A',
          500: '#5C5C5C',
          600: '#454545',
          700: '#363636',
          800: '#2A2A2A',
          900: '#1A1A1A',
        },
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(0, 0, 0, 0.06)',
        'soft-lg': '0 4px 24px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
