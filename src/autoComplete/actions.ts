/**
 * Public action functions for the auto-complete plugin
 *
 * These functions provide a clean API for controlling the plugin
 * from outside (e.g., from React components or other plugins).
 */

import { EditorView } from "prosemirror-view";
import { autoCompleteKey } from "./plugin";
import { AutoCompleteState, AutoCompleteActionType } from "./types";
import { cancelActiveRequest } from "./streaming";

/**
 * Enable or disable the auto-complete plugin
 */
export function setAutoCompleteEnabled(view: EditorView, enabled: boolean): void {
  if (!enabled) {
    // Cancel any active request when disabling
    cancelActiveRequest(view);
  }

  view.dispatch(
    view.state.tr.setMeta(autoCompleteKey, {
      type: AutoCompleteActionType.SET_ENABLED,
      enabled,
    }),
  );
}

/**
 * Accept the current completion (if showing)
 * This is typically triggered by pressing Tab, but can be called programmatically
 */
export function acceptAutoCompletion(view: EditorView): boolean {
  const pluginState = autoCompleteKey.getState(view.state);
  if (!pluginState || !pluginState.suggestion) {
    return false;
  }

  // Insert the suggestion text at the cursor position
  const tr = view.state.tr.insertText(
    pluginState.suggestion,
    pluginState.cursorPos,
  );
  view.dispatch(tr);

  // Dismiss the suggestion
  view.dispatch(
    view.state.tr.setMeta(autoCompleteKey, {
      type: AutoCompleteActionType.DISMISS,
    }),
  );

  view.focus();
  return true;
}

/**
 * Dismiss the current completion without accepting it
 */
export function dismissAutoCompletion(view: EditorView): void {
  cancelActiveRequest(view);

  view.dispatch(
    view.state.tr.setMeta(autoCompleteKey, {
      type: AutoCompleteActionType.DISMISS,
    }),
  );
}

/**
 * Get the current auto-complete plugin state
 */
export function getAutoCompleteState(
  view: EditorView,
): AutoCompleteState | undefined {
  return autoCompleteKey.getState(view.state);
}

/**
 * Check if auto-complete is currently enabled
 */
export function isAutoCompleteEnabled(view: EditorView): boolean {
  const state = autoCompleteKey.getState(view.state);
  return state?.enabled ?? false;
}

/**
 * Check if a completion is currently being shown
 */
export function hasAutoCompletion(view: EditorView): boolean {
  const state = autoCompleteKey.getState(view.state);
  return !!state?.suggestion;
}
