/// <reference lib="dom" />
import { Page } from "@playwright/test";

// Decoration info type
export interface DecorationInfo {
  from: number;
  to: number;
  id: object;
  unitId: object;
  originalText: string;
  replacement: string;
}

// Processing status type
export interface ProcessingStatus {
  queued: number;
  processing: number;
  done: number;
  error: number;
}

// Helper to wait for the test harness to be ready
export async function waitForGrammarHarness(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__GRAMMAR_V2_TEST__ !== "undefined",
    { timeout },
  );
}

// Helper to get decorations
export async function getDecorations(page: Page): Promise<DecorationInfo[]> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.getDecorations());
}

// Helper to get decoration count
export async function getDecorationCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.getDecorations().length);
}

// Helper to get selected decoration ID
export async function getSelectedDecorationId(page: Page): Promise<object | undefined> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.getSelectedDecorationId());
}

// Helper to get runner status
export async function getRunnerStatus(page: Page): Promise<string> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.getRunnerStatus());
}

// Helper to get processing status
export async function getProcessingStatus(page: Page): Promise<ProcessingStatus> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.getProcessingStatus());
}

// Helper to get unit count
export async function getUnitCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.getUnitCount());
}

// Actions
export async function initGrammarCheck(page: Page): Promise<void> {
  await page.evaluate(() => window.__GRAMMAR_V2_TEST__.actions.init());
}

export async function finishGrammarCheck(page: Page): Promise<void> {
  await page.evaluate(() => window.__GRAMMAR_V2_TEST__.actions.finish());
}

export async function clearGrammarCheck(page: Page): Promise<void> {
  await page.evaluate(() => window.__GRAMMAR_V2_TEST__.actions.clear());
}

export async function acceptSuggestion(page: Page, index: number): Promise<void> {
  await page.evaluate((i) => window.__GRAMMAR_V2_TEST__.actions.acceptSuggestion(i), index);
}

export async function discardSuggestion(page: Page, index: number): Promise<void> {
  await page.evaluate((i) => window.__GRAMMAR_V2_TEST__.actions.discardSuggestion(i), index);
}

export async function selectSuggestion(page: Page, index: number): Promise<void> {
  await page.evaluate((i) => window.__GRAMMAR_V2_TEST__.actions.selectSuggestion(i), index);
}

export async function deselectSuggestion(page: Page): Promise<void> {
  await page.evaluate(() => window.__GRAMMAR_V2_TEST__.actions.deselectSuggestion());
}

// Mock API helpers
export async function mockGrammarResponse(
  page: Page,
  text: string,
  result: { fixed: boolean; result: string },
): Promise<void> {
  await page.evaluate(
    ({ t, r }) => window.__GRAMMAR_V2_TEST__.mockApi.setResponse(t, r),
    { t: text, r: result },
  );
}

export async function mockDefaultGrammarResponse(
  page: Page,
  result: { fixed: boolean; result: string },
): Promise<void> {
  await page.evaluate((r) => window.__GRAMMAR_V2_TEST__.mockApi.setDefaultResponse(r), result);
}

export async function mockGrammarError(page: Page, error: string): Promise<void> {
  await page.evaluate((e) => window.__GRAMMAR_V2_TEST__.mockApi.setError(e), error);
}

export async function getPendingGrammarRequests(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.mockApi.getPendingRequests());
}

export async function resolveGrammarRequest(page: Page, text: string): Promise<boolean> {
  return page.evaluate((t) => window.__GRAMMAR_V2_TEST__.mockApi.resolveRequest(t), text);
}

export async function resolveAllGrammarRequests(page: Page): Promise<void> {
  await page.evaluate(() => window.__GRAMMAR_V2_TEST__.mockApi.resolveAll());
}

export async function getGrammarRequestCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.mockApi.getRequestCount());
}

export async function getAllGrammarRequests(page: Page): Promise<Array<{ text: string }>> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.mockApi.getAllRequests());
}

export async function resetGrammarMock(page: Page): Promise<void> {
  await page.evaluate(() => window.__GRAMMAR_V2_TEST__.mockApi.reset());
}

export async function setGrammarAutoResolve(page: Page, auto: boolean): Promise<void> {
  await page.evaluate((a) => window.__GRAMMAR_V2_TEST__.mockApi.setAutoResolve(a), auto);
}

export async function setGrammarResponseDelay(page: Page, ms: number): Promise<void> {
  await page.evaluate((d) => window.__GRAMMAR_V2_TEST__.mockApi.setResponseDelay(d), ms);
}

// Editor helpers
export async function getDocText(page: Page): Promise<string> {
  return page.evaluate(() => window.__GRAMMAR_V2_TEST__.editor.getDocText());
}

export async function typeText(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => window.__GRAMMAR_V2_TEST__.editor.typeText(t), text);
}

export async function insertTextAt(page: Page, pos: number, text: string): Promise<void> {
  await page.evaluate(
    ({ p, t }) => window.__GRAMMAR_V2_TEST__.editor.insertTextAt(p, t),
    { p: pos, t: text },
  );
}

export async function deleteRange(page: Page, from: number, to: number): Promise<void> {
  await page.evaluate(
    ({ f, t }) => window.__GRAMMAR_V2_TEST__.editor.deleteRange(f, t),
    { f: from, t: to },
  );
}

export async function focusEditor(page: Page): Promise<void> {
  await page.evaluate(() => window.__GRAMMAR_V2_TEST__.editor.focus());
}

// Async helpers
export async function waitForDecorations(page: Page, count: number, timeout = 5000): Promise<void> {
  await page.evaluate(
    ({ c, t }) => window.__GRAMMAR_V2_TEST__.waitForDecorations(c, t),
    { c: count, t: timeout },
  );
}

export async function waitForProcessingComplete(page: Page, timeout = 5000): Promise<void> {
  await page.evaluate((t) => window.__GRAMMAR_V2_TEST__.waitForProcessingComplete(t), timeout);
}

export async function waitForGrammarStatus(page: Page, status: string, timeout = 5000): Promise<void> {
  await page.evaluate(
    ({ s, t }) => window.__GRAMMAR_V2_TEST__.waitForStatus(s, t),
    { s: status, t: timeout },
  );
}

export async function waitForUnitCount(
  page: Page,
  count: number,
  status: string,
  timeout = 5000,
): Promise<void> {
  await page.evaluate(
    ({ c, s, t }) => window.__GRAMMAR_V2_TEST__.waitForUnitCount(c, s, t),
    { c: count, s: status, t: timeout },
  );
}

export async function sleep(page: Page, ms: number): Promise<void> {
  await page.evaluate((t) => window.__GRAMMAR_V2_TEST__.sleep(t), ms);
}
