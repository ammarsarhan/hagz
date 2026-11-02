// Expo's CSS pipeline runs global.css through PostCSS, which runs Tailwind.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
