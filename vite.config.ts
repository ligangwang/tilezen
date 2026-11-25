import { defineConfig } from "vite";
export default defineConfig({
  // Published under /g/tilezen/<version>/, so every URL stays relative.
  base: "./",
  esbuild: { jsx: "automatic" },
  // dingn's playground loads the dev server from a sandboxed frame.
  server: { cors: true },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
  test: { environment: "jsdom", include: ["tests/**/*.test.tsx"] },
});
