import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
const fromSrc = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

/** Import shortcuts (@map, @store, ...); keep in step with "paths" in tsconfig.app.json. */
const SOURCE_FOLDERS = ["components", "df", "engine", "formats", "helpers", "hooks", "map", "store", "styles", "theme", "world"];

export default defineConfig(({ mode }) => ({
  // The desktop app loads files from disk, so paths must be relative there.
  // On the web the site lives at <user>.github.io/Handofarmok/.
  base: mode === "electron" ? "./" : "/Handofarmok/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      ...Object.fromEntries(SOURCE_FOLDERS.map((dir) => [`@${dir}`, fromSrc(dir)])),
      "#types": fromSrc("types.ts"),
    },
  },
}));
