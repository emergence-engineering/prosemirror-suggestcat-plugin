/**
 * Auto-complete plugin module
 *
 * Shows AI-powered inline completion suggestions as ghost text
 * after the user stops typing.
 *
 * @example
 * ```typescript
 * import { autoCompletePlugin, setAutoCompleteEnabled } from 'prosemirror-suggestcat-plugin';
 *
 * const plugins = [
 *   autoCompletePlugin('your-api-key', {
 *     debounceMs: 500,
 *     maxContextLength: 2000,
 *   }),
 *   // ... other plugins
 * ];
 *
 * // To toggle the plugin:
 * setAutoCompleteEnabled(view, false);
 * ```
 *
 * CSS for ghost text (user responsibility):
 * ```css
 * .autoCompleteGhostText {
 *   color: #9ca3af;
 *   opacity: 0.7;
 *   pointer-events: none;
 * }
 * ```
 */

// Types
export {
  AutoCompleteStatus,
  AutoCompleteActionType,
  type AutoCompleteState,
  type AutoCompleteAction,
  type AutoCompleteOptions,
  type AutoCompleteSetEnabledAction,
  type AutoCompleteStartDebounceAction,
  type AutoCompleteStartRequestAction,
  type AutoCompleteStreamUpdateAction,
  type AutoCompleteStreamCompleteAction,
  type AutoCompleteStreamErrorAction,
  type AutoCompleteDismissAction,
  type AutoCompleteAcceptAction,
  defaultAutoCompleteOptions,
} from "./types";

// Plugin
export { autoCompletePlugin, autoCompleteKey } from "./plugin";

// Actions
export {
  setAutoCompleteEnabled,
  acceptAutoCompletion,
  dismissAutoCompletion,
  getAutoCompleteState,
  isAutoCompleteEnabled,
  hasAutoCompletion,
} from "./actions";

// Streaming utilities (for advanced use cases)
export {
  cancelActiveRequest as cancelAutoCompleteRequest,
  hasActiveRequest as hasAutoCompleteRequest,
} from "./streaming";
