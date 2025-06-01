/** @type {import('tailwindcss').Config} */
module.exports = { // Changed to module.exports
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // This line tells Tailwind to scan your React components
  ],
  darkMode: 'class', // Ensure dark mode is enabled via class
  theme: {
    extend: {},
  },
  plugins: [],
}
