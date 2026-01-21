import { test, expect } from "@playwright/test";
import {
  waitForCompleteHarness,
  getCompleteStatus,
  startTask,
  acceptResult,
  rejectResult,
  cancelTask,
  mockStreamResponse,
  mockApiError,
  waitForStatus,
  waitForPreview,
  waitForIdle,
  resetMockApi,
  setSelection,
} from "../../helpers/complete-utils";

test.describe("CompleteV2 State Machine", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCompleteHarness(page);
    await resetMockApi(page);
  });

  test("starts in IDLE state", async ({ page }) => {
    const status = await getCompleteStatus(page);
    expect(status).toBe("idle");
  });

  test("IDLE -> PENDING on startTask", async ({ page }) => {
    // Set up mock response
    await mockStreamResponse(page, ["Hello ", "world!"]);

    // Start a task (Complete doesn't need selection)
    await startTask(page, "Complete");

    // Should transition to pending, then streaming
    await waitForStatus(page, "pending", 1000).catch(() => {
      // May have already transitioned to streaming
    });

    const status = await getCompleteStatus(page);
    expect(["pending", "streaming", "preview"]).toContain(status);
  });

  test("PENDING -> STREAMING on first chunk", async ({ page }) => {
    await mockStreamResponse(page, ["First ", "Second ", "Third"]);

    await startTask(page, "Complete");

    // Wait for streaming to start
    await waitForStatus(page, "streaming", 2000);

    const status = await getCompleteStatus(page);
    expect(status).toBe("streaming");
  });

  test("STREAMING -> PREVIEW on complete", async ({ page }) => {
    await mockStreamResponse(page, ["Complete ", "response"]);

    await startTask(page, "Complete");

    // Wait for preview state
    await waitForPreview(page, 3000);

    const status = await getCompleteStatus(page);
    expect(status).toBe("preview");
  });

  test("PREVIEW -> APPLYING -> IDLE on accept", async ({ page }) => {
    await mockStreamResponse(page, ["Test result"]);

    await startTask(page, "Complete");
    await waitForPreview(page);

    // Accept the result
    await acceptResult(page);

    // Should transition to idle
    await waitForIdle(page, 2000);

    const status = await getCompleteStatus(page);
    expect(status).toBe("idle");
  });

  test("PREVIEW -> IDLE on reject", async ({ page }) => {
    await mockStreamResponse(page, ["Test result"]);

    await startTask(page, "Complete");
    await waitForPreview(page);

    // Reject the result
    await rejectResult(page);

    // Should be back to idle
    const status = await getCompleteStatus(page);
    expect(status).toBe("idle");
  });

  test("any state -> IDLE on cancel", async ({ page }) => {
    await mockStreamResponse(page, ["Chunk1 ", "Chunk2 ", "Chunk3 ", "Chunk4 ", "Chunk5"]);

    await startTask(page, "Complete");

    // Wait a bit for streaming to start
    await waitForStatus(page, "streaming", 2000);

    // Cancel mid-stream
    await cancelTask(page);

    // Should be idle
    const status = await getCompleteStatus(page);
    expect(status).toBe("idle");
  });

  test("any state -> IDLE on error", async ({ page }) => {
    await mockApiError(page, "Test API error");

    await startTask(page, "Complete");

    // Should transition to idle with error
    await waitForIdle(page, 2000);

    const status = await getCompleteStatus(page);
    expect(status).toBe("idle");
  });
});
