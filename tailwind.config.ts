import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        serif: ['Bricolage Grotesque', 'Georgia', 'serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        cyan: {
          DEFAULT: "hsl(var(--cyan-glow))",
          glow: "hsl(var(--cyan-glow))",
        },
        bone: {
          50: "#FAF8F4",
          100: "#F2EFE9",
          200: "#E8E4DA",
          300: "#DDD8CE",
          400: "#B9B3A6",
          500: "#8F897D",
          600: "#6B675F",
          700: "#4A4741",
          800: "#2B2926",
          900: "#111111",
        },
        signal: {
          "green-50": "#EAF6EF", "green-100": "#D5EBDD", "green-300": "#7CC49A",
          "green-500": "#177A4B", "green-600": "#11623B", "green-700": "#0F5132", "green-900": "#0A3622",
          "blue-50": "#EEF2FE", "blue-100": "#DCE5FB", "blue-300": "#8FA9F5",
          "blue-500": "#2F5BEA", "blue-600": "#2347C2", "blue-700": "#1E3A8A", "blue-900": "#14245A",
          "red-50": "#FDEEED", "red-100": "#F8D8D6", "red-300": "#EE8E8A",
          "red-500": "#D12B26", "red-600": "#A8201C", "red-700": "#7F1D1D", "red-900": "#4A1010",
        },
        status: {
          steady: "hsl(var(--status-steady))",
          "steady-bg": "hsl(var(--status-steady-bg))",
          "steady-text": "hsl(var(--status-steady-text))",
          info: "hsl(var(--status-info))",
          "info-bg": "hsl(var(--status-info-bg))",
          "info-text": "hsl(var(--status-info-text))",
          alert: "hsl(var(--status-alert))",
          "alert-bg": "hsl(var(--status-alert-bg))",
          "alert-text": "hsl(var(--status-alert-text))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        sm: "6px",   /* tags */
        md: "12px",  /* inputs */
        lg: "var(--radius)", /* 20px, cards */
        xl: "28px",  /* sheets */
        pill: "9999px", /* buttons */
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Screen-level entrance. Deliberately a CSS keyframe rather than a
        // framer-motion initial/animate pair: those were observed freezing
        // partway (screens stuck at ~0.47 opacity, washing the whole UI out).
        // A keyframe always reaches its end state.
        "screen-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "screen-in": "screen-in 0.5s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
