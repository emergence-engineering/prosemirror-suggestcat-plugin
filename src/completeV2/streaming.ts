import { EditorView } from "prosemirror-view";
import { PluginKey } from "prosemirror-state";
import type { TaskType, TaskParams, CompleteV2State } from "./types";
import { CompleteActionType } from "./types";
import { streamingRequest as apiStreamingRequest } from "../api";

// Active abort controllers for cancellation
const activeControllers = new WeakMap<EditorView, AbortController>();

/**
 * Cancel any active streaming request for the given view
 */
export function cancelActiveRequest(view: EditorView): void {
  const controller = activeControllers.get(view);
  if (controller) {
    controller.abort();
    activeControllers.delete(view);
  }
}

/**
 * Check if there's an active request for the given view
 */
export function hasActiveRequest(view: EditorView): boolean {
  return activeControllers.has(view);
}

interface StreamingRequestParams {
  view: EditorView;
  pluginKey: PluginKey<CompleteV2State>;
  apiKey: string;
  text: string;
  task: TaskType;
  params?: TaskParams;
  apiEndpoint?: string;
  model?: string;
}

/**
 * Make a streaming request to the AI API
 */
export async function streamingRequest({
  view,
  pluginKey,
  apiKey,
  text,
  task,
  params,
  apiEndpoint,
  model,
}: StreamingRequestParams): Promise<void> {
  // Cancel any existing request
  cancelActiveRequest(view);

  // Create new abort controller
  const controller = new AbortController();
  activeControllers.set(view, controller);

  try {
    await apiStreamingRequest(
      {
        apiKey,
        text,
        task,
        params,
        endpoint: apiEndpoint,
        model,
        signal: controller.signal,
      },
      {
        onChunk: (_chunk, accumulated) => {
          if (!view.isDestroyed) {
            view.dispatch(
              view.state.tr.setMeta(pluginKey, {
                type: CompleteActionType.STREAM_UPDATE,
                result: accumulated,
              }),
            );
          }
        },
        onComplete: (result) => {
          if (!view.isDestroyed) {
            view.dispatch(
              view.state.tr.setMeta(pluginKey, {
                type: CompleteActionType.STREAM_COMPLETE,
                result,
              }),
            );
          }
        },
        onError: (error) => {
          console.error("Streaming request error:", error);
          if (!view.isDestroyed) {
            view.dispatch(
              view.state.tr.setMeta(pluginKey, {
                type: CompleteActionType.STREAM_ERROR,
                error: error.message,
              }),
            );
          }
        },
      },
    );
  } finally {
    activeControllers.delete(view);
  }
}
