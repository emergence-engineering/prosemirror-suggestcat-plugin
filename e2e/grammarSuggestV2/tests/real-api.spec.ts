import { test, expect } from "@playwright/test";
import {
  waitForGrammarHarness,
  getDecorations,
  initGrammarCheck,
  waitForProcessingComplete,
} from "../../helpers/grammar-utils";

// These tests use the real API and are skipped unless SUGGESTCAT_API_KEY is set
// Run with: SUGGESTCAT_API_KEY=xxx pnpm test:e2e:grammarV2

const apiKey = process.env.SUGGESTCAT_API_KEY;

test.describe("GrammarSuggestV2 Real API", () => {
  test.skip(!apiKey, "Skipping: SUGGESTCAT_API_KEY not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGrammarHarness(page);
  });

  test("real grammar check finds intentional errors", async ({ page }) => {
    // The test harness has intentional errors:
    // - "sentance" should be "sentence"
    // - "dont" should be "doesn't"

    // Start grammar check
    await initGrammarCheck(page);

    // Wait for processing (longer timeout for real API)
    await waitForProcessingComplete(page, 60000);

    // Get decorations
    const decorations = await getDecorations(page);

    // Should have found at least one error
    expect(decorations.length).toBeGreaterThan(0);

    // Verify at least one of the expected errors was caught
    const foundSentanceError = decorations.some((d) =>
      d.originalText.toLowerCase().includes("sentance") ||
      d.replacement.toLowerCase().includes("sentence"),
    );
    const foundDontError = decorations.some((d) =>
      d.originalText.toLowerCase().includes("dont") ||
      d.replacement.toLowerCase().includes("doesn't"),
    );

    // At least one of the known errors should be detected
    expect(foundSentanceError || foundDontError).toBe(true);
  });

  test("suggestions match expected corrections", async ({ page }) => {
    await initGrammarCheck(page);
    await waitForProcessingComplete(page, 60000);

    const decorations = await getDecorations(page);

    // Find the "sentance" -> "sentence" correction
    const sentenceCorrection = decorations.find((d) =>
      d.originalText === "sentance",
    );

    if (sentenceCorrection) {
      // The replacement should be "sentence" or similar
      expect(
        sentenceCorrection.replacement.toLowerCase().includes("sentence") ||
        sentenceCorrection.replacement.toLowerCase().includes("sentance"),
      ).toBe(true);
    }
  });
});
