/// <reference lib="dom" />
import { Page } from "@playwright/test";

// Helper to wait for the test harness to be ready
export async function waitForCompleteHarness(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__COMPLETE_V2_TEST__ !== "undefined",
    { timeout },
  );
}

// Helper to get current status
export async function getCompleteStatus(page: Page): Promise<string> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.getStatus());
}

// Helper to get task type
export async function getTaskType(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.getTaskType());
}

// Helper to get streamed result
export async function getStreamedResult(page: Page): Promise<string> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.getStreamedResult());
}

// Helper to get error
export async function getError(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.getError());
}

// Helper to check if enabled
export async function isEnabled(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.isEnabled());
}

// Helper to start a task
export async function startTask(
  page: Page,
  taskType: string,
  params?: object,
): Promise<void> {
  await page.evaluate(
    ({ t, p }) => window.__COMPLETE_V2_TEST__.actions.startTask(t, p),
    { t: taskType, p: params },
  );
}

// Helper to accept result
export async function acceptResult(page: Page): Promise<void> {
  await page.evaluate(() => window.__COMPLETE_V2_TEST__.actions.acceptResult());
}

// Helper to reject result
export async function rejectResult(page: Page): Promise<void> {
  await page.evaluate(() => window.__COMPLETE_V2_TEST__.actions.rejectResult());
}

// Helper to cancel task
export async function cancelTask(page: Page): Promise<void> {
  await page.evaluate(() => window.__COMPLETE_V2_TEST__.actions.cancelTask());
}

// Helper to set enabled
export async function setCompleteEnabled(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((e) => window.__COMPLETE_V2_TEST__.actions.setEnabled(e), enabled);
}

// Helper to clear error
export async function clearCompleteError(page: Page): Promise<void> {
  await page.evaluate(() => window.__COMPLETE_V2_TEST__.actions.clearError());
}

// Mock API helpers
export async function mockStreamResponse(page: Page, chunks: string[]): Promise<void> {
  await page.evaluate((c) => window.__COMPLETE_V2_TEST__.mockApi.setResponse(c), chunks);
}

export async function mockApiError(page: Page, error: string): Promise<void> {
  await page.evaluate((e) => window.__COMPLETE_V2_TEST__.mockApi.setError(e), error);
}

export async function getApiRequestCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.mockApi.getRequestCount());
}

export async function getLastApiRequest(page: Page): Promise<{ task: string; params?: object; text: string } | undefined> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.mockApi.getLastRequest());
}

export async function getAllApiRequests(page: Page): Promise<Array<{ task: string; params?: object; text: string }>> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.mockApi.getAllRequests());
}

export async function resolveStream(page: Page): Promise<void> {
  await page.evaluate(() => window.__COMPLETE_V2_TEST__.mockApi.resolveStream());
}

export async function resetMockApi(page: Page): Promise<void> {
  await page.evaluate(() => window.__COMPLETE_V2_TEST__.mockApi.reset());
}

export async function setAutoResolve(page: Page, auto: boolean): Promise<void> {
  await page.evaluate((a) => window.__COMPLETE_V2_TEST__.mockApi.setAutoResolve(a), auto);
}

export async function setChunkDelay(page: Page, ms: number): Promise<void> {
  await page.evaluate((d) => window.__COMPLETE_V2_TEST__.mockApi.setChunkDelay(d), ms);
}

// Editor helpers
export async function getDocText(page: Page): Promise<string> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.editor.getDocText());
}

export async function setSelection(page: Page, from: number, to: number): Promise<void> {
  await page.evaluate(({ f, t }) => window.__COMPLETE_V2_TEST__.editor.setSelection(f, t), { f: from, t: to });
}

export async function typeText(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => window.__COMPLETE_V2_TEST__.editor.typeText(t), text);
}

export async function focusEditor(page: Page): Promise<void> {
  await page.evaluate(() => window.__COMPLETE_V2_TEST__.editor.focus());
}

export async function getSelectionRange(page: Page): Promise<{ from: number; to: number }> {
  return page.evaluate(() => window.__COMPLETE_V2_TEST__.editor.getSelectionRange());
}

// Async helpers
export async function waitForStatus(page: Page, status: string, timeout = 5000): Promise<void> {
  await page.evaluate(
    ({ s, t }) => window.__COMPLETE_V2_TEST__.waitForStatus(s, t),
    { s: status, t: timeout },
  );
}

export async function waitForStreamChunks(page: Page, minLength: number, timeout = 5000): Promise<void> {
  await page.evaluate(
    ({ m, t }) => window.__COMPLETE_V2_TEST__.waitForStreamChunks(m, t),
    { m: minLength, t: timeout },
  );
}

export async function waitForRequestCount(page: Page, count: number, timeout = 5000): Promise<void> {
  await page.evaluate(
    ({ c, t }) => window.__COMPLETE_V2_TEST__.waitForRequestCount(c, t),
    { c: count, t: timeout },
  );
}

export async function sleep(page: Page, ms: number): Promise<void> {
  await page.evaluate((t) => window.__COMPLETE_V2_TEST__.sleep(t), ms);
}

// Convenience function to wait for preview state
export async function waitForPreview(page: Page, timeout = 5000): Promise<void> {
  await waitForStatus(page, "preview", timeout);
}

// Convenience function to wait for idle state
export async function waitForIdle(page: Page, timeout = 5000): Promise<void> {
  await waitForStatus(page, "idle", timeout);
}
