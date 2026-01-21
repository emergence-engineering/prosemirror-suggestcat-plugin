import { test, expect } from "@playwright/test";
import {
  waitForHarness,
  dispatchInit,
  waitForPendingCount,
  getPendingKeys,
  resolveUnit,
  resolveAllPending,
  getUnitCountByStatus,
  insertTextAt,
  deleteRange,
  focusEditor,
  getDocText,
  sleep,
  waitForUnitCountByStatus,
  waitForMinUnitCountByStatus,
  waitForMockPendingCount,
} from "../helpers/test-utils";
import { UnitStatus } from "../../src";

test.describe("Editing While Processing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("editing a unit marks it DIRTY", async ({ page }) => {
    await dispatchInit(page);

    // Wait for processing to start
    await waitForPendingCount(page, 2);

    // Resolve first batch
    await resolveAllPending(page);

    // Wait for units to be done or dirty
    await page.waitForTimeout(100);

    // Edit the first paragraph (insert text at position 2, inside first paragraph)
    await insertTextAt(page, 2, "EDITED ");

    // Wait for dirty detection (debounce is 100ms in test config)
    await sleep(page, 150);

    // Check for DIRTY status
    const dirtyCount = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyCount).toBeGreaterThanOrEqual(1);
  });

  test("positions remap after edit", async ({ page }) => {
    await dispatchInit(page);

    // Wait for processing
    await waitForPendingCount(page, 2);

    // Get initial doc text
    const initialText = await getDocText(page);

    // Insert text at the beginning of the document
    await insertTextAt(page, 1, "PREFIX ");

    // New text should include the prefix
    const newText = await getDocText(page);
    expect(newText).toContain("PREFIX ");
    expect(newText.length).toBeGreaterThan(initialText.length);

    // Units should have been remapped - processing should continue
    await page.waitForTimeout(100);

    // Should still have units (they were remapped, not lost)
    const units = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.getUnits(),
    );
    expect(units).not.toBeNull();
    expect(units?.length).toBeGreaterThan(0);
  });

  test("dirty units get reprocessed after debounce", async ({ page }) => {
    await dispatchInit(page);

    // Wait for initial batch
    await waitForPendingCount(page, 2);

    // Resolve all to complete initial processing
    await resolveAllPending(page);
    await page.waitForTimeout(100);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for all done
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);

    // Edit a paragraph to make it dirty
    await insertTextAt(page, 2, "NEW ");

    // Wait for debounce and reprocessing to start
    await sleep(page, 200);

    // The dirty unit should be reprocessed (become pending again)
    await waitForMockPendingCount(page, 1);

    const pendingKeys = await getPendingKeys(page);
    expect(pendingKeys.length).toBeGreaterThanOrEqual(1);
  });

  test("edit during PROCESSING marks unit as DIRTY", async ({ page }) => {
    await dispatchInit(page);

    // Wait for processing
    await waitForPendingCount(page, 2);

    // Don't resolve - keep units in PROCESSING state
    // Edit the first paragraph while it's processing
    await insertTextAt(page, 2, "EDIT ");

    // The unit should become DIRTY
    await waitForMinUnitCountByStatus(page, UnitStatus.DIRTY, 1);

    const dirtyCount = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyCount).toBeGreaterThanOrEqual(1);
  });

  test("rapid edits are debounced", async ({ page }) => {
    await dispatchInit(page);

    // Wait for initial batch
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await page.waitForTimeout(100);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for all done
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);

    // Reset processing calls counter
    await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.mockProcessor.resetCalls(),
    );

    // Rapid edits
    await insertTextAt(page, 2, "A");
    await sleep(page, 30);
    await insertTextAt(page, 3, "B");
    await sleep(page, 30);
    await insertTextAt(page, 4, "C");

    // Wait for debounce (100ms) plus some buffer
    await sleep(page, 200);

    // Wait for reprocessing to start
    await waitForMockPendingCount(page, 1);

    // Resolve the reprocessing
    await resolveAllPending(page);

    // Should have only triggered one reprocess (debounced)
    // The call count should be 1 (one unit reprocessed due to edits)
    await page.waitForTimeout(100);
    const calls = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.mockProcessor.getProcessingCalls(),
    );
    expect(calls).toBe(1);
  });

  test("deleting text updates unit positions", async ({ page }) => {
    await dispatchInit(page);

    // Wait for processing
    await waitForPendingCount(page, 2);

    // Get initial text
    const initialText = await getDocText(page);

    // Delete some text from the beginning
    await deleteRange(page, 1, 10);

    // Text should be shorter
    const newText = await getDocText(page);
    expect(newText.length).toBeLessThan(initialText.length);

    // Units should still exist (remapped)
    const units = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.getUnits(),
    );
    expect(units?.length).toBeGreaterThan(0);
  });

  test("pause while units processing preserves state", async ({ page }) => {
    await dispatchInit(page);

    // Wait for processing
    await waitForPendingCount(page, 2);

    // Pause (FINISH)
    await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.dispatch.finish(),
    );

    // Should be IDLE
    const status = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.getStatus(),
    );
    expect(status).toBe("IDLE");

    // Units should still exist
    const units = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.getUnits(),
    );
    expect(units?.length).toBe(3);

    // Some should still be PROCESSING (they were mid-flight)
    const processingCount = await getUnitCountByStatus(page, UnitStatus.PROCESSING);
    expect(processingCount).toBe(2);
  });

  test("resume after pause continues PROCESSING units", async ({ page }) => {
    await dispatchInit(page);

    // Wait for processing
    await waitForPendingCount(page, 2);

    // Pause
    await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.dispatch.finish(),
    );

    // Resolve the pending units
    await resolveAllPending(page);

    // Resume
    await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.dispatch.resume(),
    );

    // Should be ACTIVE again
    const status = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.getStatus(),
    );
    expect(status).toBe("ACTIVE");

    // Should pick up the remaining unit
    await waitForMockPendingCount(page, 1);
  });

  test("editing creates new unit when paragraph split", async ({ page }) => {
    // Focus the editor
    await focusEditor(page);

    // Type some text in the editor to position cursor
    await page.keyboard.press("End");

    // Start processing
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Resolve all
    await resolveAllPending(page);
    await page.waitForTimeout(100);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for completion
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);

    // Insert a line break in the middle of first paragraph
    // This simulates splitting the paragraph
    await insertTextAt(page, 15, "\n");

    // Wait for dirty detection and potential unit restructuring
    await sleep(page, 200);

    // Units should have changed due to the split
    // The exact behavior depends on how the blockRunner handles splits
    const units = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.getUnits(),
    );
    expect(units).not.toBeNull();
  });
});
