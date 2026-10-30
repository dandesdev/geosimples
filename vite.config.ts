/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    // The engine runs its own tests, and e2e/ is Playwright's.
    include: ["src/**/*.test.{ts,tsx}"],
  },
  build: {
    rollupOptions: {
      output: {
        // React rarely changes between deploys, so browsers keep it cached while the app chunk updates.
        manualChunks(id) {
          // Rollup ids use forward slashes on every platform.
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
        },
      },
    },
  },
});
