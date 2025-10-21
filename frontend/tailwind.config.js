/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Brand Color: #2AB7A9 (Soft Teal Green)
        primary: '#2AB7A9',
        'primary-dark': '#26A699',
        'primary-light': '#3AC5B8',

        // Accent Color: #FF6B6B (Coral Red)
        accent: '#FF6B6B',
        'accent-light': '#FF8A8A',
        'accent-dark': '#E55A5A',

        // Secondary Color: #FFD166 (Soft Amber)
        secondary: '#FFD166',
        'secondary-light': '#FFE599',
        'secondary-dark': '#E6BB5A',

        // Neutral Background: #F9FAFB (Off-White)
        'neutral-bg': '#F9FAFB',

        // Card / Section Background: #FFFFFF
        'card-bg': '#FFFFFF',

        // Sidebar Background: #FAF3E0 (Cream Beige)
        'sidebar-bg': '#FAF3E0',

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
