import { test, expect } from "@playwright/test";
import {
  waitForCompleteHarness,
  startTask,
  waitForPreview,
  getStreamedResult,
  setSelection,
} from "../../helpers/complete-utils";

// These tests use the real API and are skipped unless SUGGESTCAT_API_KEY is set
// Run with: SUGGESTCAT_API_KEY=xxx pnpm test:e2e:completeV2

const apiKey = process.env.SUGGESTCAT_API_KEY;

test.describe("CompleteV2 Real API", () => {
  test.skip(!apiKey, "Skipping: SUGGESTCAT_API_KEY not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCompleteHarness(page);
  });

  test("real Complete task returns meaningful response", async ({ page }) => {
    // Start a complete task with real API
    await startTask(page, "Complete");

    // Wait for the preview state (this may take longer with real API)
    await waitForPreview(page, 30000);

    const result = await getStreamedResult(page);

    // Verify we got a non-empty response
    expect(result.length).toBeGreaterThan(0);

    // The response should be somewhat coherent text (not error messages)
    expect(result).not.toContain("error");
    expect(result).not.toContain("Error");
  });

  test("real Translate task translates correctly", async ({ page }) => {
    // Select some text
    await setSelection(page, 1, 30);

    await startTask(page, "Translate", { targetLanguage: "Spanish" });

    await waitForPreview(page, 30000);

    const result = await getStreamedResult(page);

    // Verify we got a response
    expect(result.length).toBeGreaterThan(0);

    // The response should be different from English input
    // (This is a weak test, but we can't easily verify Spanish without more tooling)
    expect(result).not.toContain("error");
  });
});
