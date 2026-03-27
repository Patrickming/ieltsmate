/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        surface: {
          bg: '#09090b',
          sidebar: '#18181b',
          card: '#1c1c20',
          'card-alt': '#141420',
          overlay: '#1c1c20',
        },
        // Borders
        border: {
          DEFAULT: '#27272a',
          strong: '#3f3f46',
          subtle: '#1f1f23',
        },
        // Primary accent (indigo)
        primary: {
          DEFAULT: '#818cf8',
          muted: '#a5b4fc',
          dim: '#1e1b4b',
          btn: '#4f46e5',
          'btn-hover': '#4338ca',
        },
        // Category colors
        cat: {
          speech: '#60a5fa',    // 口语 - blue
          phrase: '#34d399',    // 短语 - green
          sentence: '#fb7185',  // 句子 - pink
          synonym: '#fbbf24',   // 同义替换 - yellow
          spelling: '#a78bfa',  // 拼写 - violet
          vocab: '#22d3ee',     // 单词 - cyan
        },
        // Text
        text: {
          primary: '#fafafa',
          secondary: '#e4e4e7',
          muted: '#a1a1aa',
          dim: '#71717a',
          subtle: '#52525b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      height: {
        '13': '52px',
        '15': '60px',
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        modal: '0 25px 60px rgba(0,0,0,0.6)',
        card: '0 4px 16px rgba(0,0,0,0.3)',
        glow: '0 0 20px rgba(129,140,248,0.15)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
