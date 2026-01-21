import { expect, test } from "@playwright/test";
import {
  dispatchInit,
  getPendingCount,
  getPendingKeys,
  getProcessingCalls,
  getUnitCountByStatus,
  resetProcessingCalls,
  resolveAllPending,
  resolveUnit,
  waitForHarness,
  waitForPendingCount,
  waitForProcessingCalls,
  waitForUnitCountByStatus,
} from "../../helpers/test-utils";
import { UnitStatus } from "../../../src";

test.describe("Concurrent Processing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("respects batchSize - only N units processing at once", async ({
    page,
  }) => {
    // The harness is configured with batchSize: 2
    await dispatchInit(page);

    // Wait for batch to start processing
    await waitForPendingCount(page, 2);

    // Should have exactly 2 pending (batchSize)
    const pendingCount = await getPendingCount(page);
    expect(pendingCount).toBe(2);

    // Should have 2 units in PROCESSING status
    const processingCount = await getUnitCountByStatus(
      page,
      UnitStatus.PROCESSING,
    );
    expect(processingCount).toBe(2);
  });

  test("picks up next unit when one completes", async ({ page }) => {
    await dispatchInit(page);

    // Wait for initial batch
    await waitForPendingCount(page, 2);

    // Get pending keys
    const keys = await getPendingKeys(page);
    expect(keys.length).toBe(2);

    // Resolve the first pending unit
    await resolveUnit(page, keys[0]);

    // Wait for the third unit to be picked up
    await waitForPendingCount(page, 2);

    // Should have 2 pending again (one new one started)
    const newPendingCount = await getPendingCount(page);
    expect(newPendingCount).toBe(2);

    // New pending should include the third unit (not the resolved one)
    const newKeys = await getPendingKeys(page);
    expect(newKeys).not.toContain(keys[0]);
  });

  test("all units eventually processed", async ({ page }) => {
    await dispatchInit(page);

    // Wait for initial batch
    await waitForPendingCount(page, 2);

    // Process all units by resolving them as they become pending
    let totalResolved = 0;
    const maxIterations = 10;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      const pendingCount = await getPendingCount(page);

      if (pendingCount === 0) {
        // Check if all done
        const doneCount = await getUnitCountByStatus(page, UnitStatus.DONE);
        if (doneCount === 3) break;

        // Wait a bit for more units to become pending
        await page.waitForTimeout(100);
        continue;
      }

      // Resolve all currently pending
      const resolved = await resolveAllPending(page);
      totalResolved += resolved;

      // Give time for new units to be picked up
      await page.waitForTimeout(50);
    }

    // All 3 units should be DONE
    const doneCount = await getUnitCountByStatus(page, UnitStatus.DONE);
    expect(doneCount).toBe(3);

    // We should have resolved all 3 units
    expect(totalResolved).toBe(3);
  });

  test("processing calls match unit count", async ({ page }) => {
    await resetProcessingCalls(page);

    await dispatchInit(page);

    // Wait for initial batch
    await waitForPendingCount(page, 2);

    // Resolve all units
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for all units to complete
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);

    // Processing calls should equal number of units (3)
    const calls = await getProcessingCalls(page);
    expect(calls).toBe(3);
  });

  test("concurrent batches process independently", async ({ page }) => {
    await dispatchInit(page);

    // Wait for initial batch (2 units)
    await waitForPendingCount(page, 2);

    const keys = await getPendingKeys(page);
    const [first, second] = keys;

    // Resolve second one first (out of order)
    await resolveUnit(page, second);

    // First should still be pending
    const keysAfter = await getPendingKeys(page);
    expect(keysAfter).toContain(first);
    expect(keysAfter).not.toContain(second);

    // The third unit should have been picked up
    await waitForPendingCount(page, 2);

    // Now resolve the first
    await resolveUnit(page, first);

    // Should still have one pending (the third unit)
    await page.waitForTimeout(50);
    const finalKeys = await getPendingKeys(page);
    expect(finalKeys.length).toBe(1);
  });

  test("batch continues after individual unit completion", async ({ page }) => {
    await dispatchInit(page);

    // Wait for batch
    await waitForPendingCount(page, 2);

    // Get processing count before resolving
    const callsBefore = await getProcessingCalls(page);

    // Resolve one unit
    const keys = await getPendingKeys(page);
    await resolveUnit(page, keys[0]);

    // Wait for next unit to be picked up
    await waitForProcessingCalls(page, callsBefore + 1);

    // Should maintain batch size
    await waitForPendingCount(page, 2);
    const pendingAfter = await getPendingCount(page);
    expect(pendingAfter).toBe(2);
  });
});
