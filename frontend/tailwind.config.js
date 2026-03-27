/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'pharma': {
          'slate': {
            900: '#0a0f1a',
            800: '#111827',
            700: '#1e293b',
            600: '#2d3a4f',
            500: '#475569',
          },
          'emerald': {
            DEFAULT: '#10b981',
            glow: '#34d399',
            dim: '#065f46',
          },
          'crimson': {
            DEFAULT: '#ef4444',
            glow: '#f87171',
            dim: '#7f1d1d',
          },
          'cyan': {
            DEFAULT: '#06b6d4',
            glow: '#22d3ee',
          },
          'amber': {
            DEFAULT: '#f59e0b',
            glow: '#fbbf24',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'scan-line': 'scanLine 2.5s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        scanLine: {
          '0%, 100%': { top: '5%', opacity: '0.4' },
          '50%': { top: '90%', opacity: '1' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', opacity: '1' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(16, 185, 129, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(16, 185, 129, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
