import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bunq: {
          blue: "#00AEFF",
          purple: "#7B4FFF",
          pink: "#FF4F9A",
          green: "#00E5A0",
          dark: "#0A0A0F",
          card: "#12121A",
          border: "#1E1E2E",
        },
      },
      backgroundImage: {
        "bunq-gradient": "linear-gradient(135deg, #7B4FFF 0%, #00AEFF 50%, #00E5A0 100%)",
        "card-gradient": "linear-gradient(135deg, rgba(123,79,255,0.1) 0%, rgba(0,174,255,0.05) 100%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
