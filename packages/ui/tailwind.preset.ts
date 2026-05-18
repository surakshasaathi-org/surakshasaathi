import type { Config } from 'tailwindcss';

/**
 * Shared Tailwind preset for every app in the monorepo.
 *
 * Palette — Cred-modern. Deep navy near-black canvas with electric mint as
 * the primary accent (a single energetic color carries every CTA and active
 * state); amber as the secondary used sparingly for emphasis and rupee-y
 * highlights. Ink is warm-tinted near-white so the dark surface still feels
 * human, not corporate-cold.
 */
const preset = {
  content: [],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        ink: {
          DEFAULT: 'hsl(210 20% 96%)',
          muted: 'hsl(220 12% 70%)',
          subtle: 'hsl(220 10% 52%)',
        },
        primary: {
          DEFAULT: 'hsl(160 95% 55%)',
          foreground: 'hsl(220 30% 8%)',
          muted: 'hsl(160 60% 18%)',
          subtle: 'hsl(160 50% 12%)',
        },
        accent: {
          DEFAULT: 'hsl(38 95% 60%)',
          foreground: 'hsl(220 30% 8%)',
        },
        surface: {
          DEFAULT: 'hsl(220 25% 10%)',
          elevated: 'hsl(220 22% 13%)',
          hover: 'hsl(220 22% 16%)',
        },
        'ink-deep': {
          DEFAULT: 'hsl(220 30% 6%)',
          muted: 'hsl(220 15% 70%)',
          subtle: 'hsl(220 10% 55%)',
        },
        brand: {
          ink: 'hsl(220 30% 8%)',
        },
        success: {
          DEFAULT: 'hsl(160 80% 50%)',
          subtle: 'hsl(160 60% 12%)',
        },
        warn: {
          DEFAULT: 'hsl(38 95% 60%)',
          subtle: 'hsl(38 60% 14%)',
        },
        danger: {
          DEFAULT: 'hsl(0 75% 60%)',
          subtle: 'hsl(0 50% 14%)',
        },
        border: 'hsl(220 18% 18%)',
        input: 'hsl(220 18% 16%)',
        ring: 'hsl(160 95% 55%)',
        card: {
          DEFAULT: 'hsl(220 25% 10%)',
          foreground: 'hsl(210 20% 96%)',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Noto Sans',
          'Noto Sans Devanagari',
          'Noto Sans Kannada',
          'sans-serif',
        ],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        display: [
          'var(--font-display)',
          'Inter',
          'Space Grotesk',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        lg: '14px',
        md: '10px',
        sm: '6px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.32)',
        floating: '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 64px rgba(0,0,0,0.5)',
        glow: '0 0 0 4px hsla(160 95% 55% / 0.18), 0 0 24px hsla(160 95% 55% / 0.4)',
      },
      maxWidth: {
        prose: '68ch',
      },
      backgroundImage: {
        'mint-glow':
          'radial-gradient(ellipse 1200px 600px at 50% -20%, hsl(160 95% 55% / 0.18), transparent 60%)',
        'amber-wash':
          'radial-gradient(ellipse 800px 400px at 100% 100%, hsl(38 95% 60% / 0.1), transparent 60%)',
        'hero-aurora':
          'radial-gradient(ellipse 1400px 700px at 20% 0%, hsl(160 95% 55% / 0.16), transparent 55%), radial-gradient(ellipse 1000px 500px at 90% 80%, hsl(38 95% 60% / 0.1), transparent 55%)',
        'warm-sun': 'radial-gradient(ellipse at top right, hsl(38 95% 60% / 0.08), transparent 60%)',
        'warm-mist': 'linear-gradient(180deg, hsl(220 25% 10%) 0%, hsl(220 28% 6%) 100%)',
        'warm-dawn':
          'radial-gradient(ellipse at 25% 0%, hsl(160 95% 55% / 0.12), transparent 55%), radial-gradient(ellipse at 75% 100%, hsl(38 95% 60% / 0.1), transparent 55%)',
      },
      fontSize: {
        hero: ['clamp(3.5rem, 7vw + 1rem, 6.5rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'section-hero': ['clamp(2.5rem, 4vw + 1rem, 4.5rem)', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        editorial: ['clamp(5rem, 10vw, 9rem)', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
      },
    },
  },
  plugins: [],
} satisfies Partial<Config>;

export default preset;
