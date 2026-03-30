/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#07090d',
        surface: '#11161d',
        'surface-elevated': '#171d26',
        border: '#273142',
        text: '#f3f7fb',
        'text-subtle': '#98a7bb',
        muted: '#1a222d',
        primary: '#73d7ff',
        'primary-foreground': '#05131b',
        success: '#34d399',
        warning: '#f59e0b',
        danger: '#fb7185',
        info: '#60a5fa',
        ring: '#38bdf8'
      },
      boxShadow: {
        panel: '0 18px 60px rgba(0, 0, 0, 0.38)',
        glow: '0 0 0 1px rgba(115, 215, 255, 0.14), 0 12px 40px rgba(0, 0, 0, 0.32)'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem'
      },
      maxWidth: {
        shell: '1440px'
      },
      letterSpacing: {
        panel: '0.18em'
      }
    }
  },
  plugins: []
};
