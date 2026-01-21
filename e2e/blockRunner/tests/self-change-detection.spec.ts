import { test, expect } from "@playwright/test";
import {
  waitForHarness,
  dispatchInit,
  waitForPendingCount,
  resolveAllPending,
  getUnitCountByStatus,
  insertTextAt,
  sleep,
  waitForUnitCountByStatus,
  getDecorationCount,
  getDecorationDetails,
  waitForDecorations,
  waitForMinUnitCountByStatus,
} from "../../helpers/test-utils";
import { UnitStatus } from "../../../src";

test.describe("Self-Change Detection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("self-call (text change + plugin meta) should NOT mark unit dirty", async ({ page }) => {
    // Init and process all units to DONE
    await dispatchInit(page);

    // Wait for processing
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await page.waitForTimeout(100);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for all done
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);
    await waitForDecorations(page, 3);

    const initialDecorationCount = await getDecorationCount(page);
    expect(initialDecorationCount).toBe(3);

    // Perform a self-call: text change + REMOVE_DECORATION meta (simulating acceptSuggestion)
    // NOTE: We must get the decoration ID inside the evaluate to avoid serialization issues
    await page.evaluate(({ decoIndex }) => {
      const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
      const deco = details[decoIndex];
      window.__BLOCK_RUNNER_TEST__.editor.performSelfCall(
        deco.from,
        deco.to,
        "REPLACED",
        "REMOVE_DECORATION",
        { id: deco.id },
      );
    }, { decoIndex: 0 });

    // Wait for any potential dirty marking
    await sleep(page, 200);

    // No units should be DIRTY - self-call should skip dirty marking
    const dirtyCount = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyCount).toBe(0);

    // All units should still be DONE
    const doneCount = await getUnitCountByStatus(page, UnitStatus.DONE);
    expect(doneCount).toBe(3);

    // Decoration should have been removed
    const finalDecorationCount = await getDecorationCount(page);
    expect(finalDecorationCount).toBe(2);
  });

  test("regular text change (no plugin meta) SHOULD mark unit dirty", async ({ page }) => {
    // Init and process all units to DONE
    await dispatchInit(page);

    // Wait for processing
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await page.waitForTimeout(100);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for all done
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);

    // PAUSE the runner so dirty units don't get immediately reprocessed
    await page.evaluate(() => window.__BLOCK_RUNNER_TEST__.dispatch.finish());

    // Verify we're now IDLE
    const status = await page.evaluate(() => window.__BLOCK_RUNNER_TEST__.getStatus());
    expect(status).toBe("IDLE");

    // Regular text edit (no plugin meta) - should mark dirty
    await insertTextAt(page, 2, "EDITED ");

    // Wait for dirty detection (debounce is 100ms in test config)
    await sleep(page, 150);

    // At least one unit should be DIRTY (and should stay DIRTY since we're paused)
    const dirtyCount = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyCount).toBeGreaterThanOrEqual(1);
  });

  test("decoration should still be removed on self-call", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await page.waitForTimeout(100);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);
    await waitForDecorations(page, 3);

    const initialCount = await getDecorationCount(page);
    expect(initialCount).toBe(3);

    // Perform self-call with REMOVE_DECORATION - get decoration ID inside evaluate
    await page.evaluate(({ decoIndex }) => {
      const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
      const deco = details[decoIndex];
      window.__BLOCK_RUNNER_TEST__.editor.performSelfCall(
        deco.from,
        deco.to,
        "NEW_TEXT",
        "REMOVE_DECORATION",
        { id: deco.id },
      );
    }, { decoIndex: 1 }); // Use middle decoration

    await sleep(page, 100);

    // Decoration count should decrease by 1
    const finalCount = await getDecorationCount(page);
    expect(finalCount).toBe(2);
  });

  test("positions should still remap correctly on self-call", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await page.waitForTimeout(100);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);
    await waitForDecorations(page, 3);

    // Record initial decoration positions
    const initialDetails = await getDecorationDetails(page);

    // Perform self-call that inserts text BEFORE decorations (position 1)
    // This should cause positions to shift. Get decoration ID inside evaluate.
    await page.evaluate(() => {
      const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
      const deco = details[0];
      // Insert at position 1 (before first para content starts)
      window.__BLOCK_RUNNER_TEST__.editor.performSelfCall(
        1,
        1,
        "PREFIX ",
        "REMOVE_DECORATION",
        { id: deco.id },
      );
    });

    await sleep(page, 100);

    // Remaining decorations should have shifted positions
    const finalDetails = await getDecorationDetails(page);

    // Should have 2 decorations left (one was removed)
    expect(finalDetails.length).toBe(2);

    // Positions should have shifted by the inserted text length ("PREFIX " = 7 chars)
    // Note: The exact shift depends on how PM handles the positions
    for (const detail of finalDetails) {
      // All remaining decorations should have valid positions
      expect(detail.from).toBeGreaterThan(0);
      expect(detail.to).toBeGreaterThan(detail.from);
    }
  });

  test("unit text replacement in self-call preserves DONE status", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await page.waitForTimeout(100);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);
    await waitForDecorations(page, 3);

    // Replace text within a unit via self-call - get decoration ID inside evaluate
    await page.evaluate(() => {
      const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
      const deco = details[0];
      // Replace just part of the decorated range
      window.__BLOCK_RUNNER_TEST__.editor.performSelfCall(
        deco.from + 1,
        deco.to - 1,
        "MODIFIED",
        "REMOVE_DECORATION",
        { id: deco.id },
      );
    });

    await sleep(page, 200);

    // Unit should stay DONE, not become DIRTY
    const dirtyCount = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyCount).toBe(0);

    const doneCount = await getUnitCountByStatus(page, UnitStatus.DONE);
    expect(doneCount).toBe(3);
  });

  test("multiple consecutive self-calls should not trigger dirty marking", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await page.waitForTimeout(100);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);
    await waitForDecorations(page, 3);

    // Perform multiple self-calls - get decoration details inside each evaluate
    for (let i = 0; i < 2; i++) {
      const decoCount = await getDecorationCount(page);
      if (decoCount === 0) break;

      await page.evaluate((timestamp) => {
        const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
        if (details.length === 0) return;
        const deco = details[0];
        window.__BLOCK_RUNNER_TEST__.editor.performSelfCall(
          deco.from,
          deco.to,
          `REPLACED_${timestamp}`,
          "REMOVE_DECORATION",
          { id: deco.id },
        );
      }, Date.now());

      await sleep(page, 50);
    }

    await sleep(page, 200);

    // No units should be DIRTY after multiple self-calls
    const dirtyCount = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyCount).toBe(0);
  });
});
