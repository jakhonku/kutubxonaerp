import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6f1',
          100: '#d4e9dd',
          200: '#a9d3bb',
          300: '#7bbb96',
          400: '#4e9d70',
          500: '#2f7d52',
          600: '#1a5d3a',
          700: '#154b2f',
          800: '#113a25',
          900: '#0c291a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
