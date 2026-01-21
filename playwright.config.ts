import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "blockRunner",
      testDir: "./e2e/blockRunner/tests",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3333",
      },
    },
    {
      name: "completeV2",
      testDir: "./e2e/completeV2/tests",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3334",
      },
    },
    {
      name: "grammarSuggestV2",
      testDir: "./e2e/grammarSuggestV2/tests",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3335",
      },
    },
  ],

  webServer: [
    {
      command: "pnpm e2e:server:blockRunner",
      url: "http://localhost:3333",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: "pnpm e2e:server:completeV2",
      url: "http://localhost:3334",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: "pnpm e2e:server:grammarV2",
      url: "http://localhost:3335",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
