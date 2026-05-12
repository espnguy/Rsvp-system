/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        lego: {
          blue: '#1976D2',
          'blue-dark': '#0D47A1',
          red: '#E32636',
          'red-dark': '#B31B26',
          yellow: '#FFD700',
          'yellow-dark': '#C9A600',
          green: '#4CAF50',
          'green-dark': '#2E7D32',
          bg: '#FFF9E6',
        },
      },
      fontFamily: {
        display: ['Fredoka', 'system-ui', 'sans-serif'],
        body: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      maxWidth: {
        phone: '480px',
      },
    },
  },
  plugins: [],
};
