/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './App.{js,jsx,ts,tsx}',
  ],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#D7FF0C',
        'primary-foreground': '#1F4F33',
        secondary: '#2314CE',
        'secondary-foreground': '#EFEDFF',
        card: '#EBEBEB',
        'card-foreground': '#000000',
        muted: '#1F1F1F',
        'muted-foreground': '#FFFFFF',
        accent: '#EBEBEB',
      },
    },
  },
  plugins: [],
};
