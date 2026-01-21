import { test, expect } from "@playwright/test";
import {
  waitForGrammarHarness,
  getDecorations,
  getSelectedDecorationId,
  initGrammarCheck,
  mockGrammarResponse,
  waitForDecorations,
  resetGrammarMock,
  selectSuggestion,
  deselectSuggestion,
  getDecorationCount,
  getDocText,
} from "../../helpers/grammar-utils";

test.describe("GrammarSuggestV2 Popup Interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGrammarHarness(page);
    await resetGrammarMock(page);
  });

  test("click on decoration selects it", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    // Initially no selection
    let selectedId = await getSelectedDecorationId(page);
    expect(selectedId).toBeUndefined();

    // Select the decoration
    await selectSuggestion(page, 0);

    // Should now be selected
    selectedId = await getSelectedDecorationId(page);
    expect(selectedId).toBeDefined();
  });

  test("click outside deselects", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    // Select the decoration
    await selectSuggestion(page, 0);
    let selectedId = await getSelectedDecorationId(page);
    expect(selectedId).toBeDefined();

    // Deselect
    await deselectSuggestion(page);

    selectedId = await getSelectedDecorationId(page);
    expect(selectedId).toBeUndefined();
  });

  test("popup shows original and replacement", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    // Select to show popup
    await selectSuggestion(page, 0);

    // Check popup is visible
    const popup = await page.$(".grammarPopupV2");
    expect(popup).not.toBeNull();

    // Check popup contains original text
    const originalSpan = await page.$(".grammarPopupV2-original");
    if (originalSpan) {
      const originalText = await originalSpan.textContent();
      expect(originalText).toContain("sentance");
    }

    // Check popup contains replacement
    const replacementSpan = await page.$(".grammarPopupV2-replacement");
    if (replacementSpan) {
      const replacementText = await replacementSpan.textContent();
      expect(replacementText).toContain("sentence");
    }
  });

  test("accept button works", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    // Select to show popup
    await selectSuggestion(page, 0);

    // Click accept button
    const acceptButton = await page.$(".grammarPopupV2-accept");
    expect(acceptButton).not.toBeNull();
    await acceptButton?.click();

    // Text should be updated
    const text = await getDocText(page);
    expect(text).toContain("sentence");
    expect(text).not.toContain("sentance");

    // Decoration should be removed
    const count = await getDecorationCount(page);
    expect(count).toBe(0);
  });

  test("discard button works", async ({ page }) => {
    await mockGrammarResponse(
      page,
      "This is a sentance with an error.",
      { fixed: true, result: "This is a sentence with an error." },
    );

    await initGrammarCheck(page);
    await waitForDecorations(page, 1, 5000);

    const originalText = await getDocText(page);

    // Select to show popup
    await selectSuggestion(page, 0);

    // Click discard button
    const discardButton = await page.$(".grammarPopupV2-discard");
    expect(discardButton).not.toBeNull();
    await discardButton?.click();

    // Text should be unchanged
    const text = await getDocText(page);
    expect(text).toBe(originalText);

    // Decoration should be removed
    const count = await getDecorationCount(page);
    expect(count).toBe(0);
  });
});
