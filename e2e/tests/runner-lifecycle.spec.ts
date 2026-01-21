import { test, expect } from "@playwright/test";
import {
  waitForHarness,
  getStatus,
  getUnitCount,
  getUnitCountByStatus,
  getDecorationCount,
  dispatchInit,
  dispatchFinish,
  dispatchClear,
  dispatchResume,
  getPendingCount,
  resolveAllPending,
  waitForPendingCount,
  waitForDecorations,
  waitForUnitCountByStatus,
} from "../helpers/test-utils";
import { UnitStatus } from "../../src";

test.describe("Runner Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("starts in IDLE state", async ({ page }) => {
    const status = await getStatus(page);
    expect(status).toBe("IDLE");
  });

  test("has no units initially", async ({ page }) => {
    const unitCount = await getUnitCount(page);
    expect(unitCount).toBe(0);
  });

  test("INIT transitions to ACTIVE and creates units", async ({ page }) => {
    // Dispatch INIT
    await dispatchInit(page);

    // Wait for units to start processing
    await waitForPendingCount(page, 1);

    const status = await getStatus(page);
    expect(status).toBe("ACTIVE");

    // Should have created units for the 3 paragraphs
    const unitCount = await getUnitCount(page);
    expect(unitCount).toBe(3);
  });

  test("FINISH transitions to IDLE and preserves units", async ({ page }) => {
    // Start processing
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Verify ACTIVE
    let status = await getStatus(page);
    expect(status).toBe("ACTIVE");

    // Dispatch FINISH
    await dispatchFinish(page);

    // Should be IDLE now
    status = await getStatus(page);
    expect(status).toBe("IDLE");

    // Units should still be there (preserved for resume)
    const unitCount = await getUnitCount(page);
    expect(unitCount).toBe(3);
  });

  test("RESUME restarts processing from IDLE", async ({ page }) => {
    // Start processing
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Pause
    await dispatchFinish(page);
    let status = await getStatus(page);
    expect(status).toBe("IDLE");

    // Resolve all pending to simulate partial completion
    await resolveAllPending(page);

    // Resume
    await dispatchResume(page);

    // Should be ACTIVE again
    status = await getStatus(page);
    expect(status).toBe("ACTIVE");
  });

  test("CLEAR removes all units and decorations", async ({ page }) => {
    // Start processing
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Complete some units to create decorations
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for decorations to be created
    await waitForDecorations(page, 1);

    const decorationsBeforeClear = await getDecorationCount(page);
    expect(decorationsBeforeClear).toBeGreaterThan(0);

    // Dispatch CLEAR
    await dispatchClear(page);

    // Should be IDLE
    const status = await getStatus(page);
    expect(status).toBe("IDLE");

    // Units should be gone
    const unitCount = await getUnitCount(page);
    expect(unitCount).toBe(0);

    // Decorations should be gone
    const decorations = await getDecorationCount(page);
    expect(decorations).toBe(0);
  });

  test("INIT while ACTIVE reinitializes", async ({ page }) => {
    // Start processing
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Get initial unit count
    const initialUnitCount = await getUnitCount(page);
    expect(initialUnitCount).toBe(3);

    // Resolve all units
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for all units to be done
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);

    // INIT again
    await dispatchInit(page);

    // Should have fresh units
    await waitForPendingCount(page, 2);

    const status = await getStatus(page);
    expect(status).toBe("ACTIVE");
  });

  test("RESUME does nothing when already ACTIVE", async ({ page }) => {
    // Start processing
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    const pendingBefore = await getPendingCount(page);

    // Try to resume while active
    await dispatchResume(page);

    // Should still be ACTIVE with same pending count
    const status = await getStatus(page);
    expect(status).toBe("ACTIVE");

    const pendingAfter = await getPendingCount(page);
    expect(pendingAfter).toBe(pendingBefore);
  });

  test("RESUME does nothing when no units to process", async ({ page }) => {
    // Should be IDLE initially
    const statusBefore = await getStatus(page);
    expect(statusBefore).toBe("IDLE");

    // Try to resume with no units
    await dispatchResume(page);

    // Should still be IDLE
    const statusAfter = await getStatus(page);
    expect(statusAfter).toBe("IDLE");
  });
});
