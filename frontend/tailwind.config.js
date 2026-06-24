/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'stock-up': '#ef4444',
        'stock-down': '#22c55e',
        'stock-flat': '#6b7280',
      }
    },
  },
  plugins: [],
}
