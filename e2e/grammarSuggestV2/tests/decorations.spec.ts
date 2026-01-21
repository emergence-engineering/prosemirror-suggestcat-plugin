import { test, expect } from "@playwright/test";
import {
  waitForGrammarHarness,
  getDecorations,
  getDecorationCount,
  initGrammarCheck,
  clearGrammarCheck,
  mockGrammarResponse,
  mockDefaultGrammarResponse,
  waitForDecorations,
  waitForProcessingComplete,
  resetGrammarMock,
  insertTextAt,
} from "../../helpers/grammar-utils";

test.describe("GrammarSuggestV2 Decorations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGrammarHarness(page);
    await resetGrammarMock(page);
  });

  test("decoration has correct position", async ({ page }) => {
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
    // The decoration should have valid positions
    expect(decoration.from).toBeGreaterThan(0);
    expect(decoration.to).toBeGreaterThan(decoration.from);
  });

  test("decoration renders in DOM with correct class", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    // Check that the decoration is visible in the DOM
    const decorationElement = await page.$(".grammarSuggestionV2");
    expect(decorationElement).not.toBeNull();
  });

  test("multiple decorations rendered correctly", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an mistake." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 2, 5000);

    const decorationElements = await page.$$(".grammarSuggestionV2");
    expect(decorationElements.length).toBeGreaterThanOrEqual(2);
  });

  test("decorations update on text edit", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    const initialDecorations = await getDecorations(page);
    expect(initialDecorations.length).toBeGreaterThanOrEqual(1);
    const initialFrom = initialDecorations[0].from;

    // Insert text before the decoration
    await insertTextAt(page, 1, "ADDED ");

    // Decoration position should have shifted
    const updatedDecorations = await getDecorations(page);
    if (updatedDecorations.length > 0) {
      // Position should have increased by the length of inserted text
      expect(updatedDecorations[0].from).toBeGreaterThan(initialFrom);
    }
  });

  test("decorations removed on clear", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    let count = await getDecorationCount(page);
    expect(count).toBeGreaterThanOrEqual(1);

    // Clear
    await clearGrammarCheck(page);

    count = await getDecorationCount(page);
    expect(count).toBe(0);
  });

  test("decoration spec contains correct data", async ({ page }) => {
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
    // Verify decoration spec data
    expect(decoration.id).toBeDefined();
    expect(decoration.unitId).toBeDefined();
    expect(decoration.originalText).toBeDefined();
    expect(decoration.replacement).toBeDefined();
    expect(typeof decoration.originalText).toBe("string");
    expect(typeof decoration.replacement).toBe("string");
  });
});
