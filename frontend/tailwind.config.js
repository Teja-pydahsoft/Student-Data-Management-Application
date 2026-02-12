/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Brand Color: #1A2517 (Deep Olive)
        primary: '#1A2517',
        'primary-dark': '#11180F',
        'primary-light': '#2B3C26',

        // Accent Color: #A3B18A (Sage Green) - Matches text in Deep Olive combo image
        accent: '#A3B18A',
        'accent-light': '#CAD2C5',
        'accent-dark': '#849669',

        // Secondary Color: #FAFAF5 (Milk White)
        secondary: '#FAFAF5',
        'secondary-light': '#FFFFFF',
        'secondary-dark': '#E6E6E1',

        // Neutral Background: #FAFAF5 (Milk White)
        'neutral-bg': '#FAFAF5',

        // Card / Section Background: #FFFFFF
        'card-bg': '#FFFFFF',

        // Sidebar Background: #F3F1EB (Slightly darker Milk White)
        'sidebar-bg': '#F3F1EB',

        // Text Colors
        'text-primary': '#333333',     // Dark Charcoal
        'text-secondary': '#555555',   // Medium Gray
        'muted-text': '#777777',       // Labels, placeholders

        // Border / Divider: #E5E7EB (Light Gray Border)
        'border-light': '#E5E7EB',
        'border-lighter': '#F3F4F6',

        // Status Colors
        success: '#06D6A0',           // Success states and badges
        warning: '#FFB703',           // Warnings and notices
        error: '#EF476F',             // Errors and invalid states
        info: '#118AB2',              // Info states

        // Legacy colors for backward compatibility
        navy: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
    },
  },
  plugins: [],
}
