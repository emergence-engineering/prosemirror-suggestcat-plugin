/// <reference lib="dom" />
import { Page } from "@playwright/test";
import type { RunnerStatus, UnitStatus } from "../../src/blockRunner/types";

// Helper to wait for the test harness to be ready
export async function waitForHarness(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__BLOCK_RUNNER_TEST__ !== "undefined",
    { timeout },
  );
}

// Helper to get runner status
export async function getStatus(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.getStatus());
}

// Helper to get unit count
export async function getUnitCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.getUnitCount());
}

// Helper to get unit count by status
export async function getUnitCountByStatus(page: Page, status: UnitStatus): Promise<number> {
  return page.evaluate(
    (s) => window.__BLOCK_RUNNER_TEST__.getUnitCountByStatus(s),
    status,
  );
}

// Helper to get decoration count
export async function getDecorationCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.getDecorations().length);
}

// Helper to dispatch init
export async function dispatchInit(page: Page): Promise<void> {
  await page.evaluate(() => window.__BLOCK_RUNNER_TEST__.dispatch.init());
}

// Helper to dispatch finish
export async function dispatchFinish(page: Page): Promise<void> {
  await page.evaluate(() => window.__BLOCK_RUNNER_TEST__.dispatch.finish());
}

// Helper to dispatch clear
export async function dispatchClear(page: Page): Promise<void> {
  await page.evaluate(() => window.__BLOCK_RUNNER_TEST__.dispatch.clear());
}

// Helper to dispatch resume
export async function dispatchResume(page: Page): Promise<void> {
  await page.evaluate(() => window.__BLOCK_RUNNER_TEST__.dispatch.resume());
}

// Helper to get pending unit keys
export async function getPendingKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.mockProcessor.getPendingKeys());
}

// Helper to get pending count
export async function getPendingCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.mockProcessor.getPendingCount());
}

// Helper to resolve a unit
export async function resolveUnit(page: Page, key: string, message = "success"): Promise<boolean> {
  return page.evaluate(
    ({ k, m }) => window.__BLOCK_RUNNER_TEST__.mockProcessor.resolveUnit(k, m),
    { k: key, m: message },
  );
}

// Helper to reject a unit
export async function rejectUnit(page: Page, key: string, errorMessage = "test error"): Promise<boolean> {
  return page.evaluate(
    ({ k, e }) => window.__BLOCK_RUNNER_TEST__.mockProcessor.rejectUnit(k, e),
    { k: key, e: errorMessage },
  );
}

// Helper to resolve all pending units
export async function resolveAllPending(page: Page, message = "batch resolved"): Promise<number> {
  return page.evaluate(
    (m) => window.__BLOCK_RUNNER_TEST__.mockProcessor.resolveAllPending(m),
    message,
  );
}

// Helper to get processing calls count
export async function getProcessingCalls(page: Page): Promise<number> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.mockProcessor.getProcessingCalls());
}

// Helper to reset processing calls count
export async function resetProcessingCalls(page: Page): Promise<void> {
  await page.evaluate(() => window.__BLOCK_RUNNER_TEST__.mockProcessor.resetCalls());
}

// Helper to wait for specific status
export async function waitForStatus(page: Page, status: string, timeout = 5000): Promise<void> {
  await page.evaluate(
    ({ s, t }) => window.__BLOCK_RUNNER_TEST__.waitForStatus(s as RunnerStatus, t),
    { s: status, t: timeout },
  );
}

// Helper to wait for specific unit count with status
export async function waitForUnitCount(
  page: Page,
  count: number,
  status: string,
  timeout = 5000,
): Promise<void> {
  await page.evaluate(
    ({ c, s, t }) => window.__BLOCK_RUNNER_TEST__.waitForUnitCount(c, s as UnitStatus, t),
    { c: count, s: status, t: timeout },
  );
}

// Helper to wait for pending count
export async function waitForPendingCount(page: Page, count: number, timeout = 5000): Promise<void> {
  await page.evaluate(
    ({ c, t }) => window.__BLOCK_RUNNER_TEST__.waitForPendingCount(c, t),
    { c: count, t: timeout },
  );
}

// Helper to wait for processing calls
export async function waitForProcessingCalls(page: Page, count: number, timeout = 5000): Promise<void> {
  await page.evaluate(
    ({ c, t }) => window.__BLOCK_RUNNER_TEST__.waitForProcessingCalls(c, t),
    { c: count, t: timeout },
  );
}

// Helper to type text in editor
export async function typeText(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => window.__BLOCK_RUNNER_TEST__.editor.typeText(t), text);
}

// Helper to insert text at position
export async function insertTextAt(page: Page, pos: number, text: string): Promise<void> {
  await page.evaluate(
    ({ p, t }) => window.__BLOCK_RUNNER_TEST__.editor.insertTextAt(p, t),
    { p: pos, t: text },
  );
}

// Helper to delete range
export async function deleteRange(page: Page, from: number, to: number): Promise<void> {
  await page.evaluate(
    ({ f, t }) => window.__BLOCK_RUNNER_TEST__.editor.deleteRange(f, t),
    { f: from, t: to },
  );
}

// Helper to focus editor
export async function focusEditor(page: Page): Promise<void> {
  await page.evaluate(() => window.__BLOCK_RUNNER_TEST__.editor.focus());
}

// Helper to get doc text
export async function getDocText(page: Page): Promise<string> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.editor.getDocText());
}

// Helper to sleep
export async function sleep(page: Page, ms: number): Promise<void> {
  await page.evaluate((t) => window.__BLOCK_RUNNER_TEST__.sleep(t), ms);
}

// Helper to wait for exact unit count by status
export async function waitForUnitCountByStatus(
  page: Page,
  status: UnitStatus,
  count: number,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    ({ s, c }) => window.__BLOCK_RUNNER_TEST__.getUnitCountByStatus(s) === c,
    { s: status, c: count },
    { timeout },
  );
}

// Helper to wait for minimum unit count by status
export async function waitForMinUnitCountByStatus(
  page: Page,
  status: UnitStatus,
  minCount: number,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    ({ s, c }) => window.__BLOCK_RUNNER_TEST__.getUnitCountByStatus(s) >= c,
    { s: status, c: minCount },
    { timeout },
  );
}

// Helper to wait for mock processor pending count
export async function waitForMockPendingCount(
  page: Page,
  minCount: number,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    (c) => window.__BLOCK_RUNNER_TEST__.mockProcessor.getPendingCount() >= c,
    minCount,
    { timeout },
  );
}

// Helper to wait for decorations
export async function waitForDecorations(
  page: Page,
  minCount: number,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    (c) => window.__BLOCK_RUNNER_TEST__.getDecorations().length >= c,
    minCount,
    { timeout },
  );
}

// Decoration detail type for test helpers
export interface DecorationDetail {
  from: number;
  to: number;
  id: object;
  unitId: object;
  message: string;
  originalText: string;
}

// Helper to get decoration details with positions
export async function getDecorationDetails(page: Page): Promise<DecorationDetail[]> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.getDecorationDetails());
}

// Helper to remove a decoration by index
export async function removeDecorationByIndex(page: Page, index: number): Promise<void> {
  await page.evaluate((idx) => {
    const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
    if (idx >= 0 && idx < details.length) {
      window.__BLOCK_RUNNER_TEST__.dispatch.removeDecoration(details[idx].id);
    }
  }, index);
}

// Helper to select decoration by index
export async function selectDecorationByIndex(page: Page, index: number): Promise<void> {
  await page.evaluate((idx) => {
    const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
    if (idx >= 0 && idx < details.length) {
      window.__BLOCK_RUNNER_TEST__.dispatch.selectDecoration(details[idx].id);
    }
  }, index);
}

// Helper to deselect decoration
export async function deselectDecoration(page: Page): Promise<void> {
  await page.evaluate(() => window.__BLOCK_RUNNER_TEST__.dispatch.deselectDecoration());
}

// Helper to get selected decoration
export async function getSelectedDecoration(page: Page): Promise<object | undefined> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.getSelectedDecoration());
}

// Helper to check if a decoration is selected (by index)
export async function isDecorationSelected(page: Page, index: number): Promise<boolean> {
  return page.evaluate((idx) => {
    const details = window.__BLOCK_RUNNER_TEST__.getDecorationDetails();
    const selected = window.__BLOCK_RUNNER_TEST__.getSelectedDecoration();
    if (idx >= 0 && idx < details.length && selected) {
      return details[idx].id === selected;
    }
    return false;
  }, index);
}

// Helper to wait for exact decoration count
export async function waitForExactDecorationCount(
  page: Page,
  count: number,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    (c) => window.__BLOCK_RUNNER_TEST__.getDecorations().length === c,
    count,
    { timeout },
  );
}

// Widget detail type for test helpers
export interface WidgetDetail {
  pos: number;
  unitId: object;
  status: string;
  unitFrom: number;
  unitTo: number;
}

// Helper to get widget details with positions
export async function getWidgetDetails(page: Page): Promise<WidgetDetail[]> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.getWidgetDetails());
}

// Helper to get widget count
export async function getWidgetCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__BLOCK_RUNNER_TEST__.getWidgetCount());
}

// Helper to wait for widget count
export async function waitForWidgetCount(
  page: Page,
  count: number,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    (c) => window.__BLOCK_RUNNER_TEST__.getWidgetCount() === c,
    count,
    { timeout },
  );
}

// Helper to wait for minimum widget count
export async function waitForMinWidgetCount(
  page: Page,
  minCount: number,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    (c) => window.__BLOCK_RUNNER_TEST__.getWidgetCount() >= c,
    minCount,
    { timeout },
  );
}

