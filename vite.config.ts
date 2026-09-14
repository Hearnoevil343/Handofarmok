import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Electron loads from app://local/, so asset paths must be relative
  base: mode === "electron" ? "./" : "/hand-of-armok/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@engine": path.resolve(__dirname, "./src/engine"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@helpers": path.resolve(__dirname, "./src/helpers"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@store": path.resolve(__dirname, "./src/store"),
      "@styles": path.resolve(__dirname, "./src/styles"),
      "@tile-map": path.resolve(__dirname, "./src/tile-map"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "#types": path.resolve(__dirname, "./src/types.ts"),
    },
  },
}));
