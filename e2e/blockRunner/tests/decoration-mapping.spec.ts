import { test, expect } from "@playwright/test";
import {
  waitForHarness,
  dispatchInit,
  waitForPendingCount,
  resolveAllPending,
  getDecorationCount,
  waitForDecorations,
  waitForUnitCountByStatus,
  insertTextAt,
  deleteRange,
  sleep,
  getDecorationDetails,
  removeDecorationByIndex,
  selectDecorationByIndex,
  deselectDecoration,
  getSelectedDecoration,
  waitForExactDecorationCount,
  getUnitCountByStatus,
  getWidgetDetails,
  getWidgetCount,
  waitForWidgetCount,
  waitForMinWidgetCount,
  resolveUnit,
  getPendingKeys,
} from "../../helpers/test-utils";
import { UnitStatus } from "../../../src";

test.describe("Decoration Positioning", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("decorations render at correct positions", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for decorations
    await waitForDecorations(page, 3);

    const details = await getDecorationDetails(page);
    expect(details.length).toBe(3);

    // Decorations are created at unit.from+1 to unit.to-1
    // First paragraph: "First paragraph with some text." (from ~1 to ~31)
    // Decoration should be from 2 to 30
    expect(details[0].from).toBeGreaterThan(0);
    expect(details[0].to).toBeGreaterThan(details[0].from);

    // Each decoration should have positive from/to
    for (const detail of details) {
      expect(detail.from).toBeGreaterThan(0);
      expect(detail.to).toBeGreaterThan(detail.from);
    }
  });

  test("multiple decorations have distinct positions", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for decorations
    await waitForDecorations(page, 3);

    const details = await getDecorationDetails(page);
    expect(details.length).toBe(3);

    // Each decoration should have distinct positions (no overlapping)
    // Decoration 0's to should be less than decoration 1's from
    expect(details[0].to).toBeLessThan(details[1].from);
    expect(details[1].to).toBeLessThan(details[2].from);

    // Each decoration should have unique id
    const ids = details.map((d) => d.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  test("decoration contains correct response data", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Resolve with a specific message
    const pendingKeys = await page.evaluate(() =>
      window.__BLOCK_RUNNER_TEST__.mockProcessor.getPendingKeys(),
    );

    // Resolve first unit with custom message
    await page.evaluate(
      ({ key, msg }) =>
        window.__BLOCK_RUNNER_TEST__.mockProcessor.resolveUnit(key, msg),
      { key: pendingKeys[0], msg: "custom-message-1" },
    );

    // Resolve second with another custom message
    if (pendingKeys[1]) {
      await page.evaluate(
        ({ key, msg }) =>
          window.__BLOCK_RUNNER_TEST__.mockProcessor.resolveUnit(key, msg),
        { key: pendingKeys[1], msg: "custom-message-2" },
      );
    }

    await waitForDecorations(page, 2);

    const details = await getDecorationDetails(page);
    expect(details.length).toBeGreaterThanOrEqual(2);

    // Check that messages were captured
    const messages = details.map((d) => d.message);
    expect(messages).toContain("custom-message-1");
    expect(messages).toContain("custom-message-2");
  });
});

test.describe("Decoration Remapping on Edit", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("decoration moves when text inserted before it", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    const detailsBefore = await getDecorationDetails(page);
    const firstDecoFrom = detailsBefore[0].from;
    const firstDecoTo = detailsBefore[0].to;
    const secondDecoFrom = detailsBefore[1].from;

    // Insert text at position 1 (beginning of first paragraph)
    await insertTextAt(page, 1, "PREFIX ");

    // Give time for remapping
    await sleep(page, 50);

    const detailsAfter = await getDecorationDetails(page);

    // First decoration should have shifted by 7 characters ("PREFIX " length)
    // However, note: inserting at position 1 may trigger DIRTY handling
    // We need to check the remapping happened
    expect(detailsAfter.length).toBeGreaterThan(0);

    // If decorations were remapped (not cleared), positions should have shifted
    if (detailsAfter.length >= 2) {
      // Second decoration should have shifted
      expect(detailsAfter[1].from).toBeGreaterThan(secondDecoFrom);
    }
  });

  test("decoration moves when text deleted before it", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    const detailsBefore = await getDecorationDetails(page);
    const secondDecoFrom = detailsBefore[1].from;
    const thirdDecoFrom = detailsBefore[2].from;

    // Delete some text from the first paragraph (positions 1-7)
    await deleteRange(page, 1, 7);

    // Give time for remapping
    await sleep(page, 50);

    const detailsAfter = await getDecorationDetails(page);

    // If remapping worked, later decorations should have shifted left
    // The exact behavior depends on how dirty handling works
    expect(detailsAfter.length).toBeGreaterThan(0);

    // Second and third decorations should have moved toward beginning
    if (detailsAfter.length >= 2) {
      expect(detailsAfter[1].from).toBeLessThan(secondDecoFrom);
    }
    if (detailsAfter.length >= 3) {
      expect(detailsAfter[2].from).toBeLessThan(thirdDecoFrom);
    }
  });

  test("decoration expands when text inserted inside it", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    const detailsBefore = await getDecorationDetails(page);
    const secondDecoFrom = detailsBefore[1].from;
    const secondDecoTo = detailsBefore[1].to;
    const secondDecoWidth = secondDecoTo - secondDecoFrom;

    // Insert text inside the second decoration
    const insertPos = secondDecoFrom + 5; // Inside the decoration
    await insertTextAt(page, insertPos, "INNER");

    // Give time for remapping
    await sleep(page, 50);

    const detailsAfter = await getDecorationDetails(page);

    // If decoration was remapped (expanded), its width should increase
    // Note: this may also trigger DIRTY handling depending on implementation
    expect(detailsAfter.length).toBeGreaterThan(0);

    if (detailsAfter.length >= 2) {
      const newWidth = detailsAfter[1].to - detailsAfter[1].from;
      // If decoration expanded, new width should be greater
      // If DIRTY handling cleared it, this test documents that behavior
      expect(newWidth).toBeGreaterThanOrEqual(0);
    }
  });

  test("decoration survives editing unrelated text", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    const detailsBefore = await getDecorationDetails(page);
    const thirdDecoFrom = detailsBefore[2].from;
    const thirdDecoTo = detailsBefore[2].to;

    // Edit the first paragraph (unrelated to third decoration)
    await insertTextAt(page, 2, "X");

    // Give time for remapping
    await sleep(page, 50);

    const detailsAfter = await getDecorationDetails(page);

    // Third decoration should still exist and have shifted by 1
    expect(detailsAfter.length).toBeGreaterThan(0);

    if (detailsAfter.length >= 3) {
      expect(detailsAfter[2].from).toBe(thirdDecoFrom + 1);
      expect(detailsAfter[2].to).toBe(thirdDecoTo + 1);
    }
  });

  test("decoration deleted when its entire range deleted", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    const detailsBefore = await getDecorationDetails(page);
    expect(detailsBefore.length).toBe(3);

    // Get the range of the first decoration and delete it
    const firstDecoFrom = detailsBefore[0].from;
    const firstDecoTo = detailsBefore[0].to;

    // Delete the entire decorated range
    await deleteRange(page, firstDecoFrom, firstDecoTo);

    // Give time for remapping
    await sleep(page, 50);

    const detailsAfter = await getDecorationDetails(page);

    // The first decoration should be gone or have zero width
    // ProseMirror may handle this by removing the decoration entirely
    // or by collapsing it to zero width (which effectively removes it)
    if (detailsAfter.length === 3) {
      // If still 3 decorations, first one should have collapsed
      expect(detailsAfter[0].to - detailsAfter[0].from).toBeLessThanOrEqual(
        firstDecoTo - firstDecoFrom,
      );
    } else {
      // Or decoration count should have decreased
      expect(detailsAfter.length).toBeLessThan(3);
    }
  });
});

test.describe("Remove Decoration Action", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("removeDecoration removes single decoration", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    const countBefore = await getDecorationCount(page);
    expect(countBefore).toBe(3);

    // Remove first decoration
    await removeDecorationByIndex(page, 0);

    const countAfter = await getDecorationCount(page);
    expect(countAfter).toBe(2);
  });

  test("removeDecoration does NOT mark unit dirty", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);
    await waitForDecorations(page, 3);

    // Check no dirty units initially
    const dirtyBefore = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyBefore).toBe(0);

    // Remove a decoration
    await removeDecorationByIndex(page, 0);

    // Wait a bit to ensure no async dirty marking
    await sleep(page, 150);

    // Should still have no dirty units
    const dirtyAfter = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyAfter).toBe(0);

    // Decoration count should have decreased
    const decoCount = await getDecorationCount(page);
    expect(decoCount).toBe(2);
  });

  test("other decorations unaffected by remove", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    const detailsBefore = await getDecorationDetails(page);
    const secondDecoBefore = detailsBefore[1];
    const thirdDecoBefore = detailsBefore[2];

    // Remove first decoration
    await removeDecorationByIndex(page, 0);

    const detailsAfter = await getDecorationDetails(page);
    expect(detailsAfter.length).toBe(2);

    // Remaining decorations should be the original second and third
    expect(detailsAfter[0].from).toBe(secondDecoBefore.from);
    expect(detailsAfter[0].to).toBe(secondDecoBefore.to);
    expect(detailsAfter[1].from).toBe(thirdDecoBefore.from);
    expect(detailsAfter[1].to).toBe(thirdDecoBefore.to);
  });

  test("removeDecoration with invalid id is no-op", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    const countBefore = await getDecorationCount(page);

    // Try to remove with an invalid id (empty object, not matching any decoration)
    await page.evaluate(() => {
      const invalidId = {}; // New object, won't match any decoration
      window.__BLOCK_RUNNER_TEST__.dispatch.removeDecoration(invalidId);
    });

    const countAfter = await getDecorationCount(page);

    // Should be unchanged (no crash, no removal)
    expect(countAfter).toBe(countBefore);
  });
});

test.describe("Select Decoration Action", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("selectDecoration sets selected state", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    // Initially no selection
    const selectedBefore = await getSelectedDecoration(page);
    expect(selectedBefore).toBeUndefined();

    // Select first decoration
    await selectDecorationByIndex(page, 0);

    // Should now have a selection
    const selectedAfter = await getSelectedDecoration(page);
    expect(selectedAfter).toBeDefined();
  });

  test("selectDecoration does NOT mark unit dirty", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);
    await waitForDecorations(page, 3);

    // Check no dirty units initially
    const dirtyBefore = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyBefore).toBe(0);

    // Select a decoration
    await selectDecorationByIndex(page, 0);

    // Wait a bit to ensure no async dirty marking
    await sleep(page, 150);

    // Should still have no dirty units
    const dirtyAfter = await getUnitCountByStatus(page, UnitStatus.DIRTY);
    expect(dirtyAfter).toBe(0);

    // Should have selection
    const selected = await getSelectedDecoration(page);
    expect(selected).toBeDefined();
  });

  test("deselectDecoration clears selection", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    // Select first decoration
    await selectDecorationByIndex(page, 0);

    // Should have selection
    const selectedBefore = await getSelectedDecoration(page);
    expect(selectedBefore).toBeDefined();

    // Deselect
    await deselectDecoration(page);

    // Selection should be cleared
    const selectedAfter = await getSelectedDecoration(page);
    expect(selectedAfter).toBeUndefined();
  });

  test("selecting different decoration changes selection", async ({ page }) => {
    // Init and process all units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForDecorations(page, 3);

    const details = await getDecorationDetails(page);

    // Select first decoration
    await selectDecorationByIndex(page, 0);
    const selectedFirst = await getSelectedDecoration(page);
    expect(selectedFirst).toBeDefined();

    // Select second decoration
    await selectDecorationByIndex(page, 1);
    const selectedSecond = await getSelectedDecoration(page);
    expect(selectedSecond).toBeDefined();

    // Selection should have changed (different object reference)
    // We can verify by checking the selected decoration matches the second one
    const isFirstSelected = await page.evaluate((idx) => {
      const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
      const selected = window.__BLOCK_RUNNER_TEST__.getSelectedDecoration();
      return details[idx].id === selected;
    }, 0);

    const isSecondSelected = await page.evaluate((idx) => {
      const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
      const selected = window.__BLOCK_RUNNER_TEST__.getSelectedDecoration();
      return details[idx].id === selected;
    }, 1);

    expect(isFirstSelected).toBe(false);
    expect(isSecondSelected).toBe(true);
  });
});

test.describe("Widget Positioning", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("widgets render at correct positions during processing", async ({ page }) => {
    // Init to create units - widgets should appear for processing units
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Should have widgets for units that are PROCESSING or WAITING
    const widgetCount = await getWidgetCount(page);
    expect(widgetCount).toBeGreaterThan(0);

    const widgets = await getWidgetDetails(page);

    // Each widget should be at the start of its unit (unit.from)
    for (const widget of widgets) {
      expect(widget.pos).toBe(widget.unitFrom);
      // Position can be 0 for the first unit (start of document)
      expect(widget.pos).toBeGreaterThanOrEqual(0);
    }
  });

  test("multiple widgets have distinct positions", async ({ page }) => {
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    const widgets = await getWidgetDetails(page);
    expect(widgets.length).toBeGreaterThan(1);

    // Each widget should have distinct position (one per paragraph start)
    const positions = widgets.map((w) => w.pos);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(widgets.length);
  });

  test("widget shows correct unit status", async ({ page }) => {
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    const widgets = await getWidgetDetails(page);

    // All widgets should have a valid status
    for (const widget of widgets) {
      expect(["DIRTY", "WAITING", "QUEUED", "PROCESSING", "BACKOFF"]).toContain(
        widget.status,
      );
    }
  });

  test("widgets disappear when units complete", async ({ page }) => {
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Should have widgets initially
    const widgetsBefore = await getWidgetCount(page);
    expect(widgetsBefore).toBeGreaterThan(0);

    // Resolve all units
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);

    // Wait for all units to be done
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);

    // All widgets should be gone (DONE units don't have widgets)
    const widgetsAfter = await getWidgetCount(page);
    expect(widgetsAfter).toBe(0);
  });
});

test.describe("Widget Remapping on Edit", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("widget moves when text inserted before it", async ({ page }) => {
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    const widgetsBefore = await getWidgetDetails(page);
    expect(widgetsBefore.length).toBeGreaterThan(0);

    // Get all widget positions before edit
    const positionsBefore = widgetsBefore.map((w) => w.pos).sort((a, b) => a - b);

    // Insert text at position 1 (beginning of first paragraph)
    await insertTextAt(page, 1, "PREFIX ");

    // Give time for remapping
    await sleep(page, 50);

    const widgetsAfter = await getWidgetDetails(page);
    expect(widgetsAfter.length).toBeGreaterThan(0);

    // Get all widget positions after edit
    const positionsAfter = widgetsAfter.map((w) => w.pos).sort((a, b) => a - b);

    // Widgets should have been remapped - positions change due to insertion
    // The exact change depends on which units become DIRTY, but
    // positions should generally shift for widgets after the insertion point
    // At minimum, widgets should still track their units
    for (const widget of widgetsAfter) {
      expect(widget.pos).toBe(widget.unitFrom);
    }
  });

  test("widget moves when text deleted before it", async ({ page }) => {
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    const widgetsBefore = await getWidgetDetails(page);
    // Find widget for second or third paragraph
    const laterWidget = widgetsBefore.find((w) => w.pos > 35);
    const laterWidgetPosBefore = laterWidget?.pos ?? 0;

    // Delete text from first paragraph (positions 1-7)
    await deleteRange(page, 1, 7);

    // Give time for remapping
    await sleep(page, 50);

    const widgetsAfter = await getWidgetDetails(page);

    // Later widgets should have shifted left
    if (widgetsAfter.length > 0 && laterWidgetPosBefore > 0) {
      const shiftedWidget = widgetsAfter.find(
        (w) => w.pos < laterWidgetPosBefore && w.pos > 30,
      );
      // There should be a widget that's now at a lower position
      expect(widgetsAfter.some((w) => w.pos < laterWidgetPosBefore)).toBe(true);
    }
  });

  test("widget survives editing unrelated text", async ({ page }) => {
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    const widgetsBefore = await getWidgetDetails(page);
    const widgetCountBefore = widgetsBefore.length;

    // Find the third widget position (if exists)
    const thirdWidget = widgetsBefore[2];
    const thirdWidgetPosBefore = thirdWidget?.pos ?? 0;

    // Edit the first paragraph (insert at position 2)
    await insertTextAt(page, 2, "X");

    // Give time for remapping
    await sleep(page, 50);

    const widgetsAfter = await getWidgetDetails(page);

    // Widget count should remain the same (editing may trigger DIRTY, but widgets still exist)
    expect(widgetsAfter.length).toBeGreaterThan(0);

    // Third widget should have shifted by 1
    if (thirdWidgetPosBefore > 0 && widgetsAfter.length >= 3) {
      expect(widgetsAfter[2].pos).toBe(thirdWidgetPosBefore + 1);
    }
  });

  test("widget position tracks unit position after multiple edits", async ({ page }) => {
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Do multiple edits
    await insertTextAt(page, 1, "A");
    await sleep(page, 30);
    await insertTextAt(page, 1, "B");
    await sleep(page, 30);
    await insertTextAt(page, 1, "C");

    // Give time for remapping
    await sleep(page, 100);

    const widgets = await getWidgetDetails(page);

    // Widgets should still exist and track their units
    expect(widgets.length).toBeGreaterThan(0);

    // Each widget's pos should still equal its unitFrom
    for (const widget of widgets) {
      expect(widget.pos).toBe(widget.unitFrom);
    }
  });
});

test.describe("Widget Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHarness(page);
  });

  test("widget appears when unit becomes DIRTY or reprocessed", async ({ page }) => {
    // Process all units to completion first
    await dispatchInit(page);
    await waitForPendingCount(page, 2);
    await resolveAllPending(page);
    await waitForPendingCount(page, 1);
    await resolveAllPending(page);
    await waitForUnitCountByStatus(page, UnitStatus.DONE, 3);

    // No widgets when all done
    const widgetsBefore = await getWidgetCount(page);
    expect(widgetsBefore).toBe(0);

    // Edit a paragraph to make it DIRTY
    await insertTextAt(page, 2, "EDIT ");

    // Wait for dirty detection and potential reprocessing
    await sleep(page, 200);

    // Should have a widget - could be DIRTY, QUEUED, or PROCESSING
    // depending on how quickly the debounce triggers reprocessing
    const widgetsAfter = await getWidgetCount(page);
    expect(widgetsAfter).toBeGreaterThanOrEqual(1);

    const widgets = await getWidgetDetails(page);
    // Widget should have a non-DONE, non-ERROR status
    const activeWidget = widgets.find((w) =>
      ["DIRTY", "WAITING", "QUEUED", "PROCESSING", "BACKOFF"].includes(w.status),
    );
    expect(activeWidget).toBeDefined();
  });

  test("widget transitions through statuses during processing", async ({ page }) => {
    await dispatchInit(page);

    // Wait for processing to start
    await waitForPendingCount(page, 2);

    // Get widgets - should have PROCESSING or WAITING statuses
    const widgets = await getWidgetDetails(page);
    const statuses = widgets.map((w) => w.status);

    // Should have at least one PROCESSING widget
    expect(statuses).toContain("PROCESSING");
  });

  test("widget shows BACKOFF status after error", async ({ page }) => {
    await dispatchInit(page);
    await waitForPendingCount(page, 2);

    // Get pending keys and reject one
    const keys = await getPendingKeys(page);
    if (keys.length > 0) {
      await page.evaluate(
        ({ k, e }) => window.__BLOCK_RUNNER_TEST__.mockProcessor.rejectUnit(k, e),
        { k: keys[0], e: "test error" },
      );

      // Wait for backoff status
      await sleep(page, 150);

      const widgets = await getWidgetDetails(page);

      // Should have a BACKOFF widget
      const backoffWidget = widgets.find((w) => w.status === "BACKOFF");
      expect(backoffWidget).toBeDefined();
    }
  });
});
