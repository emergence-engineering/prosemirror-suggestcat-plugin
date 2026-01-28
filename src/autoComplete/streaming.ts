/**
 * Streaming request wrapper for auto-complete plugin
 *
 * Manages abort controllers per view and handles streaming API requests.
 */

import { EditorView } from "prosemirror-view";
import { PluginKey } from "prosemirror-state";
import { streamingRequest as apiStreamingRequest } from "../api";
import { AiPromptsWithoutParam } from "../types";
import { AutoCompleteState, AutoCompleteActionType } from "./types";

// Active abort controllers for cancellation (per view)
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

interface AutoCompleteStreamingParams {
  view: EditorView;
  pluginKey: PluginKey<AutoCompleteState>;
  apiKey: string;
  context: string;
  apiEndpoint?: string;
  model?: string;
}

/**
 * Make a streaming request to the AI API for auto-completion
 */
export async function streamingRequest({
  view,
  pluginKey,
  apiKey,
  context,
  apiEndpoint,
  model,
}: AutoCompleteStreamingParams): Promise<void> {
  // Cancel any existing request
  cancelActiveRequest(view);

  // Create new abort controller
  const controller = new AbortController();
  activeControllers.set(view, controller);

  try {
    await apiStreamingRequest(
      {
        apiKey,
        text: context,
        task: AiPromptsWithoutParam.SmallComplete,
        endpoint: apiEndpoint,
        model,
        signal: controller.signal,
      },
      {
        onChunk: (_chunk, accumulated) => {
          if (!view.isDestroyed) {
            view.dispatch(
              view.state.tr.setMeta(pluginKey, {
                type: AutoCompleteActionType.STREAM_UPDATE,
                suggestion: accumulated,
              }),
            );
          }
        },
        onComplete: (result) => {
          if (!view.isDestroyed) {
            view.dispatch(
              view.state.tr.setMeta(pluginKey, {
                type: AutoCompleteActionType.STREAM_COMPLETE,
                suggestion: result,
              }),
            );
          }
        },
        onError: (error) => {
          console.error("Auto-complete streaming error:", error);
          if (!view.isDestroyed) {
            view.dispatch(
              view.state.tr.setMeta(pluginKey, {
                type: AutoCompleteActionType.STREAM_ERROR,
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

/**
 * Extract context text before cursor (up to maxLength)
 */
export function extractContext(view: EditorView, maxLength: number): string {
  const { doc, selection } = view.state;
  const cursorPos = selection.from;

  // Get text from start of document to cursor
  const fullText = doc.textBetween(0, cursorPos, "\n");

  // Trim to maxLength if needed (from the end, keeping most recent text)
  if (fullText.length > maxLength) {
    return fullText.slice(-maxLength);
  }

  return fullText;
}
