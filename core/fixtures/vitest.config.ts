import { defineConfig } from "vitest/config";

// Separate from the unit tests: this run writes files.
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ["generate.fixtures.ts"],
  },
});
