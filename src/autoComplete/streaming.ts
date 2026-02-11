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
 * Ensure proper spacing between existing text and suggestion.
 *
 * If the last character before cursor is not a space/hyphen, and the first
 * character of the suggestion is not a space/hyphen, prepend a space.
 */
export function ensureLeadingSpace(
  view: EditorView,
  suggestion: string,
): string {
  if (!suggestion) {
    return suggestion;
  }

  const { doc, selection } = view.state;
  const cursorPos = selection.from;

  // Get the character before cursor
  if (cursorPos <= 0) {
    return suggestion;
  }

  const charBefore = doc.textBetween(cursorPos - 1, cursorPos, "");
  const firstCharOfSuggestion = suggestion.charAt(0);

  // eslint-disable-next-line no-useless-escape
  const spacingChars = /[\s\-]/;
  const needsSpace =
    !spacingChars.test(charBefore) && !spacingChars.test(firstCharOfSuggestion);

  return needsSpace ? ` ${suggestion}` : suggestion;
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
                suggestion: ensureLeadingSpace(view, accumulated),
              }),
            );
          }
        },
        onComplete: (result) => {
          if (!view.isDestroyed) {
            view.dispatch(
              view.state.tr.setMeta(pluginKey, {
                type: AutoCompleteActionType.STREAM_COMPLETE,
                suggestion: ensureLeadingSpace(view, result),
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

/**
 * Check if autoComplete should trigger based on sentence state and cursor position.
 *
 * Returns true only when:
 * 1. The cursor is at the end of the current node
 * 2. The text before cursor does NOT end with sentence-ending punctuation (. ! ?)
 */
export function shouldTriggerAutoComplete(view: EditorView): boolean {
  const { doc, selection } = view.state;
  const cursorPos = selection.from;

  // Get the resolved position to find the current node
  const $pos = doc.resolve(cursorPos);
  const node = $pos.parent;

  // Get cursor offset within the node
  const nodeStart = $pos.start();
  const nodeEnd = nodeStart + node.content.size;

  // Check 1: Is cursor at the end of the node?
  const isAtNodeEnd = cursorPos === nodeEnd;
  if (!isAtNodeEnd) {
    return false;
  }

  // Check 2: Get text before cursor in this node
  const textBeforeCursor = node.textBetween(0, cursorPos - nodeStart, "");

  // Empty or whitespace-only text should not trigger
  if (!textBeforeCursor.trim()) {
    return false;
  }

  // Check if sentence is incomplete (doesn't end with sentence-ending punctuation)
  const sentenceEndRegex = /[.!?]\s*$/;
  const isSentenceComplete = sentenceEndRegex.test(textBeforeCursor);

  return !isSentenceComplete;
}
