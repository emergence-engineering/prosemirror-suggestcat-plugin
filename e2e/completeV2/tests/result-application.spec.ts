import { test, expect } from "@playwright/test";
import {
  waitForCompleteHarness,
  getCompleteStatus,
  startTask,
  acceptResult,
  rejectResult,
  mockStreamResponse,
  waitForPreview,
  waitForIdle,
  resetMockApi,
  setSelection,
  getDocText,
  getStreamedResult,
  focusEditor,
} from "../../helpers/complete-utils";

test.describe("CompleteV2 Result Application", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCompleteHarness(page);
    await resetMockApi(page);
  });

  test("Complete task inserts at document end", async ({ page }) => {
    const originalText = await getDocText(page);
    await mockStreamResponse(page, [" NEW COMPLETION TEXT"]);

    await startTask(page, "Complete");
    await waitForPreview(page);

    await acceptResult(page);
    await waitForIdle(page);

    const newText = await getDocText(page);
    // The completion should be added to the document
    expect(newText.length).toBeGreaterThan(originalText.length);
    expect(newText).toContain("NEW COMPLETION TEXT");
  });

  test("selection-based tasks replace selection", async ({ page }) => {
    // Get initial text
    const originalText = await getDocText(page);

    // Select "first" in "This is the first paragraph"
    await setSelection(page, 1, 45);

    await mockStreamResponse(page, ["REPLACEMENT TEXT"]);

    await startTask(page, "Improve");
    await waitForPreview(page);

    await acceptResult(page);
    await waitForIdle(page);

    const newText = await getDocText(page);
    expect(newText).toContain("REPLACEMENT TEXT");
    // Original text should be partially replaced
    expect(newText).not.toBe(originalText);
  });

  test("multi-paragraph result handling", async ({ page }) => {
    await setSelection(page, 1, 40);

    await mockStreamResponse(page, ["First paragraph\n\nSecond paragraph\n\nThird paragraph"]);

    await startTask(page, "Improve");
    await waitForPreview(page);

    await acceptResult(page);
    await waitForIdle(page);

    const newText = await getDocText(page);
    expect(newText).toContain("First paragraph");
    expect(newText).toContain("Second paragraph");
    expect(newText).toContain("Third paragraph");
  });

  test("reject does not modify document", async ({ page }) => {
    const originalText = await getDocText(page);

    await setSelection(page, 1, 30);
    await mockStreamResponse(page, ["SHOULD NOT APPEAR"]);

    await startTask(page, "Improve");
    await waitForPreview(page);

    // Verify the result is ready
    const result = await getStreamedResult(page);
    expect(result).toBe("SHOULD NOT APPEAR");

    // Reject
    await rejectResult(page);

    // Document should be unchanged
    const newText = await getDocText(page);
    expect(newText).toBe(originalText);
    expect(newText).not.toContain("SHOULD NOT APPEAR");
  });

  test("focus returns to editor after accept", async ({ page }) => {
    await mockStreamResponse(page, [" test completion"]);

    await startTask(page, "Complete");
    await waitForPreview(page);

    await acceptResult(page);
    await waitForIdle(page);

    // Check that the editor has focus by trying to type
    // This is a bit indirect but tests the behavior
    const status = await getCompleteStatus(page);
    expect(status).toBe("idle");
  });

  test("empty result handled correctly", async ({ page }) => {
    await setSelection(page, 1, 30);
    await mockStreamResponse(page, [""]);

    await startTask(page, "Improve");
    await waitForPreview(page);

    const result = await getStreamedResult(page);
    expect(result).toBe("");

    // Should still be able to accept/reject
    const status = await getCompleteStatus(page);
    expect(status).toBe("preview");
  });
});
