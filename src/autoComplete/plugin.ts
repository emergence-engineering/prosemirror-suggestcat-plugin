/**
 * Auto-complete plugin for ProseMirror
 *
 * Shows AI-powered inline completion suggestions as ghost text
 * after the user stops typing. The ghost text appears as a decoration
 * (not part of the document) and can be accepted with Tab.
 */

import { Plugin, PluginKey, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import {
  AutoCompleteState,
  AutoCompleteStatus,
  AutoCompleteAction,
  AutoCompleteActionType,
  AutoCompleteOptions,
  defaultAutoCompleteOptions,
} from "./types";
import {
  streamingRequest,
  extractContext,
  cancelActiveRequest,
} from "./streaming";

// Plugin key for accessing state
export const autoCompleteKey = new PluginKey<AutoCompleteState>("autoCompletePlugin");

// Initial state
const initialState: AutoCompleteState = {
  status: AutoCompleteStatus.IDLE,
  enabled: true,
  suggestion: "",
  cursorPos: 0,
};

/**
 * State reducer - handles all state transitions
 */
function reducer(
  state: AutoCompleteState,
  action: AutoCompleteAction,
): AutoCompleteState {
  switch (action.type) {
    case AutoCompleteActionType.SET_ENABLED:
      return {
        ...initialState,
        enabled: action.enabled,
      };

    case AutoCompleteActionType.START_DEBOUNCE:
      // Can start debounce from IDLE, DEBOUNCING, STREAMING, or SHOWING
      return {
        ...state,
        status: AutoCompleteStatus.DEBOUNCING,
        cursorPos: action.cursorPos,
        suggestion: "",
        error: undefined,
      };

    case AutoCompleteActionType.START_REQUEST:
      if (state.status !== AutoCompleteStatus.DEBOUNCING) {
        return state;
      }
      return {
        ...state,
        status: AutoCompleteStatus.PENDING,
      };

    case AutoCompleteActionType.STREAM_UPDATE:
      if (
        state.status !== AutoCompleteStatus.PENDING &&
        state.status !== AutoCompleteStatus.STREAMING
      ) {
        return state;
      }
      return {
        ...state,
        status: AutoCompleteStatus.STREAMING,
        suggestion: action.suggestion,
      };

    case AutoCompleteActionType.STREAM_COMPLETE:
      if (
        state.status !== AutoCompleteStatus.PENDING &&
        state.status !== AutoCompleteStatus.STREAMING
      ) {
        return state;
      }
      return {
        ...state,
        status: AutoCompleteStatus.SHOWING,
        suggestion: action.suggestion,
      };

    case AutoCompleteActionType.STREAM_ERROR:
      return {
        ...state,
        status: AutoCompleteStatus.IDLE,
        error: action.error,
        suggestion: "",
      };

    case AutoCompleteActionType.DISMISS:
      return {
        ...state,
        status: AutoCompleteStatus.IDLE,
        suggestion: "",
      };

    case AutoCompleteActionType.ACCEPT:
      // Acceptance is handled in view.update, just mark as idle
      return {
        ...state,
        status: AutoCompleteStatus.IDLE,
        suggestion: "",
      };

    default:
      return state;
  }
}

/**
 * Create ghost text decoration widget
 */
function createGhostTextDecoration(
  suggestion: string,
  cursorPos: number,
  ghostTextClass: string,
): DecorationSet {
  if (!suggestion) {
    return DecorationSet.empty;
  }

  const widget = document.createElement("span");
  widget.className = ghostTextClass;
  widget.textContent = suggestion;
  widget.setAttribute("contenteditable", "false");

  const decoration = Decoration.widget(cursorPos, widget, { side: 1 });
  return DecorationSet.create(
    // We need to pass a doc, but decorations are mapped later
    // This is a workaround - we create with empty and map in props.decorations
    { nodeSize: cursorPos + 1 } as never,
    [decoration],
  );
}

/**
 * Check if transaction is a text input (insertion at cursor)
 */
function isTextInput(tr: Transaction): boolean {
  if (!tr.docChanged) return false;

  // Check if this is a simple insertion
  const steps = tr.steps;
  if (steps.length !== 1) return false;

  const step = steps[0];
  // ReplaceStep with positive content length is an insertion
  if (step.toJSON().stepType === "replace") {
    const json = step.toJSON();
    // Check if slice has content (insertion) and it's near the selection
    return json.slice?.content?.length > 0;
  }

  return false;
}

/**
 * Create the auto-complete plugin
 */
export function autoCompletePlugin(
  apiKey: string,
  options: Partial<AutoCompleteOptions> = {},
): Plugin<AutoCompleteState> {
  const mergedOptions: AutoCompleteOptions = {
    ...defaultAutoCompleteOptions,
    ...options,
  };
  const { debounceMs, maxContextLength, apiEndpoint, model, ghostTextClass } =
    mergedOptions;

  // Timer ID for debouncing
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isRequestInFlight = false;
  let pendingAcceptSuggestion: string | null = null;
  let pendingAcceptPos: number | null = null;

  return new Plugin<AutoCompleteState>({
    key: autoCompleteKey,

    state: {
      init(): AutoCompleteState {
        return { ...initialState };
      },

      apply(tr, pluginState, _oldState, newState): AutoCompleteState {
        const action = tr.getMeta(autoCompleteKey) as AutoCompleteAction | undefined;

        if (action) {
          return reducer(pluginState, action);
        }

        // If document changed and we're showing/streaming, dismiss
        if (tr.docChanged) {
          if (
            pluginState.status === AutoCompleteStatus.SHOWING ||
            pluginState.status === AutoCompleteStatus.STREAMING
          ) {
            // Check if cursor moved away from suggestion position
            const newCursorPos = newState.selection.from;
            if (newCursorPos !== pluginState.cursorPos) {
              return reducer(pluginState, {
                type: AutoCompleteActionType.DISMISS,
              });
            }
          }
        }

        // If selection changed (without doc change), dismiss active suggestions
        if (tr.selectionSet && !tr.docChanged) {
          if (
            pluginState.status === AutoCompleteStatus.SHOWING ||
            pluginState.status === AutoCompleteStatus.STREAMING
          ) {
            return reducer(pluginState, {
              type: AutoCompleteActionType.DISMISS,
            });
          }
        }

        return pluginState;
      },
    },

    props: {
      decorations(state) {
        const pluginState = autoCompleteKey.getState(state);
        if (!pluginState || !pluginState.enabled) {
          return DecorationSet.empty;
        }

        // Show ghost text when streaming or showing
        if (
          (pluginState.status === AutoCompleteStatus.STREAMING ||
            pluginState.status === AutoCompleteStatus.SHOWING) &&
          pluginState.suggestion
        ) {
          const widget = document.createElement("span");
          widget.className = ghostTextClass!;
          widget.textContent = pluginState.suggestion;
          widget.setAttribute("contenteditable", "false");

          const decoration = Decoration.widget(pluginState.cursorPos, widget, {
            side: 1,
          });
          return DecorationSet.create(state.doc, [decoration]);
        }

        return DecorationSet.empty;
      },

      handleKeyDown(view, event) {
        const pluginState = autoCompleteKey.getState(view.state);
        if (!pluginState || !pluginState.enabled) {
          return false;
        }

        // Tab to accept suggestion
        if (event.key === "Tab" && !event.shiftKey) {
          if (
            pluginState.status === AutoCompleteStatus.SHOWING &&
            pluginState.suggestion
          ) {
            event.preventDefault();

            // Store suggestion for insertion in view.update
            pendingAcceptSuggestion = pluginState.suggestion;
            pendingAcceptPos = pluginState.cursorPos;

            view.dispatch(
              view.state.tr.setMeta(autoCompleteKey, {
                type: AutoCompleteActionType.ACCEPT,
              }),
            );
            return true;
          }
        }

        // Escape to dismiss suggestion
        if (event.key === "Escape") {
          if (
            pluginState.status === AutoCompleteStatus.STREAMING ||
            pluginState.status === AutoCompleteStatus.SHOWING
          ) {
            event.preventDefault();
            cancelActiveRequest(view);
            view.dispatch(
              view.state.tr.setMeta(autoCompleteKey, {
                type: AutoCompleteActionType.DISMISS,
              }),
            );
            return true;
          }
        }

        return false;
      },
    },

    view() {
      return {
        update(view, prevState) {
          const pluginState = autoCompleteKey.getState(view.state);
          const prevPluginState = autoCompleteKey.getState(prevState);

          if (!pluginState || !pluginState.enabled) {
            // Clear timer if disabled
            if (debounceTimer) {
              clearTimeout(debounceTimer);
              debounceTimer = null;
            }
            return;
          }

          // Handle pending accept - insert suggestion text
          if (pendingAcceptSuggestion !== null && pendingAcceptPos !== null) {
            const suggestion = pendingAcceptSuggestion;
            const pos = pendingAcceptPos;
            pendingAcceptSuggestion = null;
            pendingAcceptPos = null;

            // Insert the suggestion text at the cursor position
            const tr = view.state.tr.insertText(suggestion, pos);
            view.dispatch(tr);
            view.focus();
            return;
          }

          // Detect text input and start debounce
          const tr = view.state.tr;
          if (
            view.state.doc !== prevState.doc &&
            prevPluginState?.status !== AutoCompleteStatus.PENDING &&
            prevPluginState?.status !== AutoCompleteStatus.STREAMING
          ) {
            // Check if this looks like a text input (not a paste or programmatic change)
            const lastTr = (view.state as never)["tr"];

            // Reset any existing timer
            if (debounceTimer) {
              clearTimeout(debounceTimer);
              debounceTimer = null;
            }

            // Cancel any in-flight request
            cancelActiveRequest(view);

            const cursorPos = view.state.selection.from;

            // Start debounce
            view.dispatch(
              view.state.tr.setMeta(autoCompleteKey, {
                type: AutoCompleteActionType.START_DEBOUNCE,
                cursorPos,
              }),
            );

            // Set up debounce timer
            debounceTimer = setTimeout(() => {
              debounceTimer = null;
              const currentState = autoCompleteKey.getState(view.state);
              if (currentState?.status === AutoCompleteStatus.DEBOUNCING) {
                // Transition to pending and start request
                view.dispatch(
                  view.state.tr.setMeta(autoCompleteKey, {
                    type: AutoCompleteActionType.START_REQUEST,
                  }),
                );
              }
            }, debounceMs);
          }

          // Handle PENDING state - start the API request
          if (
            pluginState.status === AutoCompleteStatus.PENDING &&
            !isRequestInFlight
          ) {
            const context = extractContext(view, maxContextLength);

            if (!context.trim()) {
              // No context to suggest from
              view.dispatch(
                view.state.tr.setMeta(autoCompleteKey, {
                  type: AutoCompleteActionType.DISMISS,
                }),
              );
              return;
            }

            isRequestInFlight = true;
            streamingRequest({
              view,
              pluginKey: autoCompleteKey,
              apiKey,
              context,
              apiEndpoint,
              model,
            }).finally(() => {
              isRequestInFlight = false;
            });
          }
        },

        destroy() {
          // Clean up timer on destroy
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
        },
      };
    },
  });
}
