import type { Config } from "tailwindcss";

const config: Config = {
  // Follow the operating system's light/dark preference. `dark:` variants
  // activate automatically when the OS is in dark mode — no toggle needed.
  darkMode: "media",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
