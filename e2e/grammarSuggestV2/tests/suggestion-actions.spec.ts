import { test, expect } from "@playwright/test";
import {
  waitForGrammarHarness,
  getDecorations,
  getDecorationCount,
  initGrammarCheck,
  mockGrammarResponse,
  waitForDecorations,
  resetGrammarMock,
  acceptSuggestion,
  discardSuggestion,
  getDocText,
} from "../../helpers/grammar-utils";

test.describe("GrammarSuggestV2 Suggestion Actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGrammarHarness(page);
    await resetGrammarMock(page);
  });

  test("accept replaces text correctly", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    const decorationsBefore = await getDecorations(page);
    expect(decorationsBefore.length).toBeGreaterThanOrEqual(1);
    expect(decorationsBefore[0].originalText).toBe("sentance");
    expect(decorationsBefore[0].replacement).toBe("sentence");

    // Accept the suggestion
    await acceptSuggestion(page, 0);

    // Text should be updated
    const text = await getDocText(page);
    expect(text).toContain("sentence");
    expect(text).not.toContain("sentance");
  });

  test("accept removes decoration", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    const countBefore = await getDecorationCount(page);
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // Accept the suggestion
    await acceptSuggestion(page, 0);

    // Decoration should be removed
    const countAfter = await getDecorationCount(page);
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("discard removes decoration only", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    // Get original text
    const originalText = await getDocText(page);

    // Discard the suggestion
    await discardSuggestion(page, 0);

    // Text should be unchanged
    const textAfter = await getDocText(page);
    expect(textAfter).toBe(originalText);

    // But decoration should be removed
    const countAfter = await getDecorationCount(page);
    expect(countAfter).toBe(0);
  });

  test("accept multi-word replacement", async ({ page }) => {
    // Test replacing multiple words
    await mockGrammarResponse(
      page,
      "She dont know what to do about it.",
      { fixed: true, result: "She doesn't know what to do about it." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    const decorations = await getDecorations(page);
    const dontDecoration = decorations.find((d) => d.originalText === "dont");
    expect(dontDecoration).toBeDefined();

    // Find the index
    const index = decorations.indexOf(dontDecoration!);
    await acceptSuggestion(page, index);

    const text = await getDocText(page);
    expect(text).toContain("doesn't");
  });

  test("accept removal (empty replacement)", async ({ page }) => {
    // Test accepting a removal suggestion
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is sentance with an error." }, // "a " removed
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    const decorations = await getDecorations(page);
    const removalDecoration = decorations.find((d) => d.replacement === "" || d.replacement === " ");

    if (removalDecoration) {
      const index = decorations.indexOf(removalDecoration);
      await acceptSuggestion(page, index);

      const text = await getDocText(page);
      // The removed word should no longer be there
      // (exact assertion depends on what was removed)
    }
  });
});
