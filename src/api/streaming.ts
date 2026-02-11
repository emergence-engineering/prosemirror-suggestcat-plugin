import type { TaskType, TaskParams } from "../types";
import type { ApiRequestBody, StreamingCallbacks } from "./types";
import { DEFAULT_COMPLETION_ENDPOINT, DEFAULT_MODEL } from "./config";

export interface StreamingRequestOptions {
  apiKey: string;
  text: string;
  task: TaskType;
  params?: TaskParams;
  endpoint?: string;
  model?: string;
  signal?: AbortSignal;
}

/**
 * Make a streaming request to the AI API.
 * Returns a promise that resolves when the stream completes.
 */
export async function streamingRequest(
  options: StreamingRequestOptions,
  callbacks: StreamingCallbacks,
): Promise<void> {
  const {
    apiKey,
    text,
    task,
    params,
    endpoint = DEFAULT_COMPLETION_ENDPOINT,
    model = DEFAULT_MODEL,
    signal,
  } = options;

  let result = "";

  const body: ApiRequestBody = {
    model,
    modelParams: {
      input: [text],
      task,
      params,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (signal?.aborted) {
        return;
      }

      const chunk = new TextDecoder().decode(value);
      result += chunk;

      callbacks.onChunk(chunk, result);
    }

    if (!signal?.aborted) {
      callbacks.onComplete(result);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }

    callbacks.onError(
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
