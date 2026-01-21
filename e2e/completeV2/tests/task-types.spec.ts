import { test, expect } from "@playwright/test";
import {
  waitForCompleteHarness,
  getTaskType,
  startTask,
  mockStreamResponse,
  waitForPreview,
  waitForIdle,
  resetMockApi,
  setSelection,
  getLastApiRequest,
  getStreamedResult,
  getError,
  mockApiError,
} from "../../helpers/complete-utils";

test.describe("CompleteV2 Task Types", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCompleteHarness(page);
    await resetMockApi(page);
  });

  test("Complete task uses last paragraphs", async ({ page }) => {
    await mockStreamResponse(page, ["Completion result"]);

    await startTask(page, "Complete");
    await waitForPreview(page);

    const taskType = await getTaskType(page);
    expect(taskType).toBe("Complete");

    const request = await getLastApiRequest(page);
    expect(request).toBeDefined();
    expect(request?.task).toBe("Complete");
    // Text should contain content from the document
    expect(request?.text.length).toBeGreaterThan(0);
  });

  test("MakeShorter task with selection", async ({ page }) => {
    await mockStreamResponse(page, ["Shorter text"]);

    // Select some text (paragraph 1)
    await setSelection(page, 1, 50);

    await startTask(page, "MakeShorter");
    await waitForPreview(page);

    const taskType = await getTaskType(page);
    expect(taskType).toBe("MakeShorter");

    const request = await getLastApiRequest(page);
    expect(request?.task).toBe("MakeShorter");
  });

  test("MakeLonger task with selection", async ({ page }) => {
    await mockStreamResponse(page, ["This is a longer version of the text with more details and elaboration."]);

    await setSelection(page, 1, 30);

    await startTask(page, "MakeLonger");
    await waitForPreview(page);

    const taskType = await getTaskType(page);
    expect(taskType).toBe("MakeLonger");
  });

  test("Improve task with selection", async ({ page }) => {
    await mockStreamResponse(page, ["Improved text with better quality"]);

    await setSelection(page, 1, 40);

    await startTask(page, "Improve");
    await waitForPreview(page);

    const taskType = await getTaskType(page);
    expect(taskType).toBe("Improve");
  });

  test("Simplify task with selection", async ({ page }) => {
    await mockStreamResponse(page, ["Simple text"]);

    await setSelection(page, 1, 50);

    await startTask(page, "Simplify");
    await waitForPreview(page);

    const taskType = await getTaskType(page);
    expect(taskType).toBe("Simplify");
  });

  test("Explain task with selection", async ({ page }) => {
    await mockStreamResponse(page, ["This explains the selected text in detail."]);

    await setSelection(page, 1, 30);

    await startTask(page, "Explain");
    await waitForPreview(page);

    const taskType = await getTaskType(page);
    expect(taskType).toBe("Explain");
  });

  test("ActionItems task with selection", async ({ page }) => {
    await mockStreamResponse(page, ["- Action item 1\n- Action item 2"]);

    await setSelection(page, 1, 50);

    await startTask(page, "ActionItems");
    await waitForPreview(page);

    const taskType = await getTaskType(page);
    expect(taskType).toBe("ActionItems");
  });

  test("ChangeTone task with mood param", async ({ page }) => {
    await mockStreamResponse(page, ["Casual version of the text"]);

    await setSelection(page, 1, 40);

    await startTask(page, "ChangeTone", { mood: "Casual" });
    await waitForPreview(page);

    const taskType = await getTaskType(page);
    expect(taskType).toBe("ChangeTone");

    const request = await getLastApiRequest(page);
    expect(request?.params).toEqual({ mood: "Casual" });
  });

  test("Translate task with language param", async ({ page }) => {
    await mockStreamResponse(page, ["Texto traducido al espa\u00f1ol"]);

    await setSelection(page, 1, 40);

    await startTask(page, "Translate", { targetLanguage: "Spanish" });
    await waitForPreview(page);

    const taskType = await getTaskType(page);
    expect(taskType).toBe("Translate");

    const request = await getLastApiRequest(page);
    expect(request?.params).toEqual({ targetLanguage: "Spanish" });
  });

  test("no selection error for non-Complete tasks", async ({ page }) => {
    // Don't select anything, but try a task that requires selection
    await mockStreamResponse(page, ["This should not appear"]);

    await startTask(page, "MakeShorter");
    await waitForIdle(page);

    const error = await getError(page);
    expect(error).toBeTruthy();
  });
});
