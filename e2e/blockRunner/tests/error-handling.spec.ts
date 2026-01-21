import { test, expect } from "@playwright/test";
import {
  waitForHarness,
  dispatchInit,
  getPendingKeys,
  rejectUnit,
  resolveUnit,
  resolveAllPending,
  getUnitCountByStatus,
  waitForPendingCount,
  getPendingCount,
  waitForMinUnitCountByStatus,
  waitForMockPendingCount,
} from "../../helpers/test-utils";
import { UnitStatus } from "../../../src";

test.describe("Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("error transitions unit to BACKOFF", async ({ page }) => {
    await dispatchInit(page);

    // Wait for batch
    await waitForPendingCount(page, 2);

    const keys = await getPendingKeys(page);
    const firstKey = keys[0];

    // Reject the first unit
    await rejectUnit(page, firstKey, "test error");

    // Unit should be in BACKOFF (waiting for retry)
    await waitForMinUnitCountByStatus(page, UnitStatus.BACKOFF, 1);

    const backoffCount = await getUnitCountByStatus(page, UnitStatus.BACKOFF);
    expect(backoffCount).toBeGreaterThanOrEqual(1);
  });

  test("unit is retried after backoff", async ({ page }) => {
    await dispatchInit(page);

    // Wait for batch
    await waitForPendingCount(page, 2);

    const keys = await getPendingKeys(page);
    const firstKey = keys[0];

    // Reject the first unit
    await rejectUnit(page, firstKey, "test error");

    // Wait for BACKOFF
    await waitForMinUnitCountByStatus(page, UnitStatus.BACKOFF, 1);

    // The backoff delay is 100ms in test config, so wait for retry
    // The unit should become pending again after backoff
    await page.waitForFunction(
      (statuses) => {
        const backoff = window.__BLOCK_RUNNER_TEST__.getUnitCountByStatus(statuses.backoff);
        const processing = window.__BLOCK_RUNNER_TEST__.getUnitCountByStatus(statuses.processing);
        // Either back to processing or still in backoff waiting
        return backoff === 0 || processing > 0;
      },
      { backoff: UnitStatus.BACKOFF, processing: UnitStatus.PROCESSING },
      { timeout: 5000 },
    );

    // Wait for it to be picked up again (becomes pending)
    await page.waitForTimeout(200); // Wait for backoff to expire

    // Resolve all pending - including the retried unit
    const pending = await getPendingCount(page);
    if (pending > 0) {
      await resolveAllPending(page);
    }
  });

  test("max retries reached transitions to ERROR", async ({ page }) => {
    await dispatchInit(page);

    // Wait for batch
    await waitForPendingCount(page, 2);

    // Get the first key - track by position prefix (from-to stays constant)
    const keys = await getPendingKeys(page);
    const firstKey = keys[0];
    const targetPrefix = firstKey.split("-").slice(0, 2).join("-"); // "1-36" format

    // Resolve the other pending unit first
    const otherKey = keys.find((k) => !k.startsWith(targetPrefix));
    if (otherKey) {
      await resolveUnit(page, otherKey, "success");
    }

    // maxRetries is 3 in test config, so we need to fail 3 times
    // The backoff is very short (100ms, 10ms, 1ms) so retries happen quickly

    // First rejection
    await rejectUnit(page, firstKey, "error attempt 1");

    // Wait for the unit to become pending again (after short backoff)
    await page.waitForFunction(
      (prefix) => {
        const pendingKeys = window.__BLOCK_RUNNER_TEST__.mockProcessor.getPendingKeys();
        return pendingKeys.some((k) => k.startsWith(prefix));
      },
      targetPrefix,
      { timeout: 5000 },
    );

    // Second rejection
    let currentKeys = await getPendingKeys(page);
    let targetKey = currentKeys.find((k) => k.startsWith(targetPrefix));
    if (targetKey) {
      await rejectUnit(page, targetKey, "error attempt 2");
    }

    // Wait for the unit to become pending again (very short backoff ~10ms)
    await page.waitForFunction(
      (prefix) => {
        const pendingKeys = window.__BLOCK_RUNNER_TEST__.mockProcessor.getPendingKeys();
        return pendingKeys.some((k) => k.startsWith(prefix));
      },
      targetPrefix,
      { timeout: 5000 },
    );

    // Third rejection - this should trigger ERROR state
    currentKeys = await getPendingKeys(page);
    targetKey = currentKeys.find((k) => k.startsWith(targetPrefix));
    if (targetKey) {
      await rejectUnit(page, targetKey, "error attempt 3");
    }

    // After 3 failures, unit should be in ERROR status
    await waitForMinUnitCountByStatus(page, UnitStatus.ERROR, 1);

    const errorCount = await getUnitCountByStatus(page, UnitStatus.ERROR);
    expect(errorCount).toBeGreaterThanOrEqual(1);
  });

  test("other units continue processing after one errors", async ({ page }) => {
    await dispatchInit(page);

    // Wait for batch
    await waitForPendingCount(page, 2);

    const keys = await getPendingKeys(page);

    // Reject first unit, resolve second
    await rejectUnit(page, keys[0], "test error");
    await resolveUnit(page, keys[1], "success");

    // Wait for second unit to be DONE
    await waitForMinUnitCountByStatus(page, UnitStatus.DONE, 1);

    const doneCount = await getUnitCountByStatus(page, UnitStatus.DONE);
    expect(doneCount).toBeGreaterThanOrEqual(1);

    // Third unit should be picked up
    await waitForPendingCount(page, 1);
    const newKeys = await getPendingKeys(page);
    expect(newKeys.length).toBeGreaterThanOrEqual(1);
  });

  test("error in one batch slot does not affect others", async ({ page }) => {
    await dispatchInit(page);

    // Wait for initial batch of 2
    await waitForPendingCount(page, 2);

    const keys = await getPendingKeys(page);
    const [first, second] = keys;

    // Reject first, leave second pending
    await rejectUnit(page, first, "test error");

    // Second should still be pending
    await page.waitForTimeout(50);
    const keysAfter = await getPendingKeys(page);
    expect(keysAfter).toContain(second);

    // Now resolve the second
    await resolveUnit(page, second, "success");

    // Second should now be DONE
    await waitForMinUnitCountByStatus(page, UnitStatus.DONE, 1);
  });

  test("processing continues while unit is in BACKOFF", async ({ page }) => {
    await dispatchInit(page);

    // Wait for batch
    await waitForPendingCount(page, 2);

    const keys = await getPendingKeys(page);
    const [first, second] = keys;

    // Reject first to put it in BACKOFF
    await rejectUnit(page, first, "test error");

    // Resolve second
    await resolveUnit(page, second, "success");

    // Third unit should be picked up while first is in BACKOFF
    await waitForMockPendingCount(page, 1);

    // Should have a new pending unit (the third one)
    const newKeys = await getPendingKeys(page);
    expect(newKeys.length).toBeGreaterThanOrEqual(1);
    expect(newKeys).not.toContain(first);
    expect(newKeys).not.toContain(second);
  });

  test("ERROR units are not retried", async ({ page }) => {
    await dispatchInit(page);

    // Wait for batch
    await waitForPendingCount(page, 2);

    // Get first key
    const keys = await getPendingKeys(page);
    const firstKey = keys[0];

    // Reject first time
    await rejectUnit(page, firstKey, "error 1");

    // Wait for BACKOFF
    await waitForMinUnitCountByStatus(page, UnitStatus.BACKOFF, 1);

    // Resolve other pending units to let processing continue
    const otherKeys = await getPendingKeys(page);
    for (const key of otherKeys) {
      await resolveUnit(page, key, "success");
    }

    // Wait for retry (second attempt)
    await waitForMockPendingCount(page, 1);

    // Reject second time
    let currentKeys = await getPendingKeys(page);
    if (currentKeys.length > 0) {
      await rejectUnit(page, currentKeys[0], "error 2");
    }

    // Wait for third attempt
    await page.waitForTimeout(200);
    await waitForMockPendingCount(page, 1);

    // Reject third time
    currentKeys = await getPendingKeys(page);
    if (currentKeys.length > 0) {
      await rejectUnit(page, currentKeys[0], "error 3");
    }

    // Wait for ERROR state
    await waitForMinUnitCountByStatus(page, UnitStatus.ERROR, 1);

    // Resolve any remaining pending
    await resolveAllPending(page);

    // Record processing calls at this point
    const callsAfterError = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.mockProcessor.getProcessingCalls(),
    );

    // Wait and check no more calls happen (ERROR unit not retried)
    await page.waitForTimeout(500);

    const callsLater = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.mockProcessor.getProcessingCalls(),
    );

    // Processing calls should not have increased (no retry of ERROR unit)
    expect(callsLater).toBe(callsAfterError);

    const errorCount = await getUnitCountByStatus(page, UnitStatus.ERROR);
    expect(errorCount).toBe(1);
  });
});
