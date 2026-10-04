const paletteScale = (variable) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((level) => [
      level,
      `rgb(var(${variable}) / <alpha-value>)`,
    ]),
  );

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        black: "var(--color-ink)",
        white: "var(--color-text)",
        ink: "var(--color-ink)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        mint: "var(--color-mint)",
        teal: "var(--color-teal)",
        positive: "var(--color-positive)",
        red: paletteScale("--rgb-accent"),
        orange: paletteScale("--rgb-accent"),
        yellow: paletteScale("--rgb-accent"),
        amber: paletteScale("--rgb-accent"),
        green: paletteScale("--rgb-positive"),
        emerald: paletteScale("--rgb-positive"),
        blue: paletteScale("--rgb-teal"),
        cyan: paletteScale("--rgb-mint"),
        purple: paletteScale("--rgb-teal"),
        indigo: paletteScale("--rgb-teal"),
        pink: paletteScale("--rgb-mint"),
        slate: paletteScale("--rgb-surface-raised"),
        gray: paletteScale("--rgb-muted"),
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        page: "var(--space-page)",
        panel: "var(--space-panel)",
        section: "var(--space-section)",
        control: "var(--space-control)",
      },
      borderRadius: {
        lg: "var(--radius-control)",
        xl: "var(--radius-panel)",
        "2xl": "var(--radius-panel)",
        "3xl": "var(--radius-panel)",
        panel: "var(--radius-panel)",
        control: "var(--radius-control)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
  safelist: [
    "from-green-400", "to-emerald-500",
    "from-blue-400", "to-blue-600",
    "from-orange-400", "to-red-500",
    "from-purple-400", "to-pink-500",
    "from-yellow-400", "to-amber-500",
    "from-indigo-400", "to-purple-500",
    "from-rose-400", "to-rose-600",
    "from-cyan-400", "to-blue-500",
    "from-gray-400", "to-gray-600",
    "bg-gradient-to-br", "bg-gradient-to-r",
  ],
};
