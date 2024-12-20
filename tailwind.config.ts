import type { Config } from "tailwindcss";
import { safelist } from "./utils/color";

const config: Config = {
  mode: 'jit',
  safelist: safelist,
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        'details': '1fr 2fr'
      },
      colors: {
        'primary-black': '#1C211E',
        'primary-white': '#DCE1DE',
        'dark-gray': '#7E8380',
        'light-gray': '#D5D5D5',
        'primary-green': '#004719',
        'secondary-green': '#619D75',
        'tertiary-green': '#257449'
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
