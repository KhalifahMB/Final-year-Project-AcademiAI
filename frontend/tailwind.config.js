/** @type {import("tailwindcss").Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      colors: {
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--bg)',
        foreground: 'var(--fg)',
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        fg: {
          DEFAULT: 'var(--fg)',
          soft: 'var(--fg-soft)',
        },
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        hover: 'var(--hover)',
        primary: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--on-accent)',
          soft: 'var(--accent-soft)',
          strong: 'var(--accent-strong)',
        },
        secondary: {
          DEFAULT: 'var(--surface-2)',
          foreground: 'var(--fg)',
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--bg)',
          soft: 'var(--danger-soft)',
        },
        accent: {
          DEFAULT: 'var(--accent-soft)',
          foreground: 'var(--accent-strong)',
        },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
        card: { DEFAULT: 'var(--surface)', foreground: 'var(--fg)' },
        popover: { DEFAULT: 'var(--surface)', foreground: 'var(--fg)' },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          muted: 'var(--sidebar-muted)',
          hover: 'var(--sidebar-hover)',
          active: 'var(--sidebar-active)',
          border: 'var(--sidebar-border)',
          accent: 'var(--sidebar-accent)',
        },
      },
      boxShadow: {
        pop: 'var(--shadow-pop)',
      },
      height: {
        topbar: 'var(--topbar-h)',
      },
      width: {
        sidebar: 'var(--sidebar-w)',
        'sidebar-collapsed': 'var(--sidebar-w-collapsed)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
};
