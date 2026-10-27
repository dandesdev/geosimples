import { defineConfig, devices } from "@playwright/test";

const PORT = 4847;
const CI = !!process.env.CI;

// Runs against the production build served by `vite preview`, so build first (`npm run e2e` does).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    viewport: { width: 1366, height: 820 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 820 } } }],
  webServer: {
    command: `npm run preview -w apps/geosimples -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
