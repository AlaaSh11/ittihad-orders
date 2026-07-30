/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red:          '#e2495c',
          navy:         '#0f1a2e',
          navyLight:    '#1b2740',
          lavender:     '#eceafa',
          lavenderDark: '#ddd8ec', // Fixed typo: was lavendertDark
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
