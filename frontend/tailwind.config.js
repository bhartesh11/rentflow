/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4fb",
          100: "#d9e7f5",
          500: "#2b5f8a",
          600: "#1e3a5f",
          700: "#16304d",
        },
      },
    },
  },
  plugins: [],
}
