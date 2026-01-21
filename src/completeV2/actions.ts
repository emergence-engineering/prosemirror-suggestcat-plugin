import { TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { completeV2Key } from "./plugin";
import {
  CompleteActionType,
  CompleteV2State,
  TaskType,
  MoodParams,
  TranslationParams,
} from "./types";
import { cancelActiveRequest } from "./streaming";

/**
 * Start a completion task
 */
export function startTask(
  view: EditorView,
  taskType: TaskType,
  params?: MoodParams | TranslationParams,
): void {
  const selection = view.state.selection as TextSelection;

  view.dispatch(
    view.state.tr.setMeta(completeV2Key, {
      type: CompleteActionType.START_TASK,
      taskType,
      params,
      selection: selection.empty ? undefined : selection,
    }),
  );
}

/**
 * Accept the streamed result and apply it to the document
 */
export function acceptResult(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(completeV2Key, {
      type: CompleteActionType.ACCEPT_RESULT,
    }),
  );
}

/**
 * Reject the streamed result and discard it
 */
export function rejectResult(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(completeV2Key, {
      type: CompleteActionType.REJECT_RESULT,
    }),
  );
}

/**
 * Cancel an in-progress task
 */
export function cancelTask(view: EditorView): void {
  // Cancel any active streaming request
  cancelActiveRequest(view);

  view.dispatch(
    view.state.tr.setMeta(completeV2Key, {
      type: CompleteActionType.CANCEL_TASK,
    }),
  );
}

/**
 * Toggle the plugin enabled state
 */
export function setEnabled(view: EditorView, enabled: boolean): void {
  if (!enabled) {
    // Cancel any active request when disabling
    cancelActiveRequest(view);
  }

  view.dispatch(
    view.state.tr.setMeta(completeV2Key, {
      type: CompleteActionType.SET_ENABLED,
      enabled,
    }),
  );
}

/**
 * Clear any error state
 */
export function clearError(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(completeV2Key, {
      type: CompleteActionType.CLEAR_ERROR,
    }),
  );
}

/**
 * Get the current plugin state
 */
export function getCompleteState(view: EditorView): CompleteV2State | undefined {
  return completeV2Key.getState(view.state);
}
