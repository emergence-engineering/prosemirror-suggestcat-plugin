import { test, expect } from "@playwright/test";
import {
  waitForCompleteHarness,
  getCompleteStatus,
  getStreamedResult,
  startTask,
  cancelTask,
  mockStreamResponse,
  mockApiError,
  waitForStatus,
  waitForPreview,
  waitForStreamChunks,
  resetMockApi,
  setChunkDelay,
  getError,
} from "../../helpers/complete-utils";

test.describe("CompleteV2 Streaming", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCompleteHarness(page);
    await resetMockApi(page);
  });

  test("chunks accumulate correctly", async ({ page }) => {
    const chunks = ["Hello ", "beautiful ", "world!"];
    await mockStreamResponse(page, chunks);
    await setChunkDelay(page, 50);

    await startTask(page, "Complete");
    await waitForPreview(page);

    const result = await getStreamedResult(page);
    expect(result).toBe(chunks.join(""));
  });

  test("multiple rapid chunks handled", async ({ page }) => {
    // Many small chunks
    const chunks = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    await mockStreamResponse(page, chunks);
    await setChunkDelay(page, 5);

    await startTask(page, "Complete");
    await waitForPreview(page);

    const result = await getStreamedResult(page);
    expect(result).toBe(chunks.join(""));
  });

  test("cancellation stops stream", async ({ page }) => {
    // Slow chunks so we can cancel mid-stream
    await mockStreamResponse(page, ["Chunk1 ", "Chunk2 ", "Chunk3 ", "Chunk4 ", "Chunk5"]);
    await setChunkDelay(page, 200);

    await startTask(page, "Complete");
    await waitForStatus(page, "streaming", 2000);

    // Wait for some chunks
    await waitForStreamChunks(page, 7, 2000);

    // Cancel
    await cancelTask(page);

    const status = await getCompleteStatus(page);
    expect(status).toBe("idle");

    // Result should be cleared or partial
    const result = await getStreamedResult(page);
    expect(result.length).toBeLessThan("Chunk1 Chunk2 Chunk3 Chunk4 Chunk5".length);
  });

  test("error during stream transitions to idle with error", async ({ page }) => {
    await mockApiError(page, "Stream error occurred");

    await startTask(page, "Complete");

    // Should go to idle with error
    await waitForStatus(page, "idle", 2000);

    const status = await getCompleteStatus(page);
    expect(status).toBe("idle");

    const error = await getError(page);
    expect(error).toBeTruthy();
  });

  test("multiple sequential requests work correctly", async ({ page }) => {
    // First request
    await mockStreamResponse(page, ["First ", "response"]);
    await startTask(page, "Complete");
    await waitForPreview(page);

    let result = await getStreamedResult(page);
    expect(result).toBe("First response");

    // Cancel and reset
    await cancelTask(page);
    await resetMockApi(page);

    // Second request
    await mockStreamResponse(page, ["Second ", "response"]);
    await startTask(page, "Complete");
    await waitForPreview(page);

    result = await getStreamedResult(page);
    expect(result).toBe("Second response");
  });

  test("empty response handled gracefully", async ({ page }) => {
    await mockStreamResponse(page, [""]);

    await startTask(page, "Complete");
    await waitForPreview(page, 3000);

    const result = await getStreamedResult(page);
    expect(result).toBe("");
  });
});
