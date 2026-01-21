import { test, expect } from "@playwright/test";
import {
  waitForGrammarHarness,
  getDecorations,
  initGrammarCheck,
  mockGrammarResponse,
  waitForDecorations,
  waitForProcessingComplete,
  resetGrammarMock,
} from "../../helpers/grammar-utils";

test.describe("GrammarSuggestV2 Suggestion Parsing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGrammarHarness(page);
    await resetGrammarMock(page);
  });

  test("single word replacement creates decoration", async ({ page }) => {
    // The first paragraph has "sentance" which should be "sentence"
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    const decorations = await getDecorations(page);
    expect(decorations.length).toBeGreaterThanOrEqual(1);

    const decoration = decorations[0];
    expect(decoration.originalText).toBe("sentance");
    expect(decoration.replacement).toBe("sentence");
  });

  test("word removal creates decoration with empty replacement", async ({ page }) => {
    // Test removing an extra word
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentance with error." }, // "an" removed
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    const decorations = await getDecorations(page);
    expect(decorations.length).toBeGreaterThanOrEqual(1);

    // Find the removal decoration
    const removalDecoration = decorations.find((d) => d.replacement === "");
    expect(removalDecoration).toBeDefined();
  });

  test("word correction creates decoration", async ({ page }) => {
    // Test correcting a misspelled word
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." }, // "sentance" -> "sentence"
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    const decorations = await getDecorations(page);
    expect(decorations.length).toBeGreaterThanOrEqual(1);

    // The decoration should show the correction
    const correction = decorations.find((d) => d.originalText === "sentance");
    expect(correction).toBeDefined();
    expect(correction?.replacement).toBe("sentence");
  });

  test("multiple suggestions in paragraph creates multiple decorations", async ({ page }) => {
    // Multiple fixes in one paragraph
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an mistake." }, // Two changes
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 2, 5000);

    const decorations = await getDecorations(page);
    expect(decorations.length).toBeGreaterThanOrEqual(2);
  });

  test("multi-paragraph processing creates decorations for each", async ({ page }) => {
    // Set up responses for both paragraphs with errors
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );
    await mockGrammarResponse(
      page,
      "She dont know what to do about it.",
      { fixed: true, result: "She doesn't know what to do about it." },
    );

    await initGrammarCheck(page);
    await waitForProcessingComplete(page, 10000);

    const decorations = await getDecorations(page);
    // Should have decorations from multiple paragraphs
    expect(decorations.length).toBeGreaterThanOrEqual(2);
  });

  test("no suggestions for correct text", async ({ page }) => {
    // Second paragraph is correct
    await mockGrammarResponse(
      page,
      "The quick brown fox jumps over the lazy dog.",
      { fixed: false, result: "The quick brown fox jumps over the lazy dog." },
    );

    await initGrammarCheck(page);
    await waitForProcessingComplete(page, 5000);

    // The correct paragraph should not have decorations
    // (other paragraphs may have decorations from default responses)
    const decorations = await getDecorations(page);
    const decorationsForCorrectPara = decorations.filter(
      (d) => d.originalText === "The quick brown fox jumps over the lazy dog.",
    );
    expect(decorationsForCorrectPara.length).toBe(0);
  });
});
