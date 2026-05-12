/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        lego: {
          blue: '#2196F3',
          'blue-dark': '#1565C0',
          red: '#F44336',
          'red-dark': '#C62828',
          yellow: '#FFC107',
          'yellow-dark': '#FF8F00',
          green: '#66BB6A',
          'green-dark': '#388E3C',
          bg: '#FFFDE7',
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
