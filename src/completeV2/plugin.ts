import { Fragment, Node, Slice } from "prosemirror-model";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {
  CompleteV2State,
  CompleteStatus,
  CompleteAction,
  CompleteActionType,
  CompleteV2Options,
  defaultCompleteV2Options,
  AiPromptsWithoutParam,
} from "./types";
import { streamingRequest, cancelActiveRequest } from "./streaming";

// Plugin key for accessing state
export const completeV2Key = new PluginKey<CompleteV2State>("completePluginV2");

// Initial state
const initialState: CompleteV2State = {
  status: CompleteStatus.IDLE,
  streamedResult: "",
  enabled: true,
};

/**
 * State reducer - handles all state transitions
 */
function reducer(
  state: CompleteV2State,
  action: CompleteAction,
): CompleteV2State {
  switch (action.type) {
    case CompleteActionType.SET_ENABLED:
      return {
        ...state,
        enabled: action.enabled,
        // Reset to idle if disabling while active
        ...(action.enabled ? {} : initialState),
      };

    case CompleteActionType.START_TASK:
      if (state.status !== CompleteStatus.IDLE) {
        return state; // Can only start from idle
      }
      return {
        ...state,
        status: CompleteStatus.PENDING,
        taskType: action.taskType,
        params: action.params,
        selection: action.selection,
        streamedResult: "",
        error: undefined,
      };

    case CompleteActionType.STREAM_UPDATE:
      if (
        state.status !== CompleteStatus.PENDING &&
        state.status !== CompleteStatus.STREAMING
      ) {
        return state;
      }
      return {
        ...state,
        status: CompleteStatus.STREAMING,
        streamedResult: action.result,
      };

    case CompleteActionType.STREAM_COMPLETE:
      if (
        state.status !== CompleteStatus.PENDING &&
        state.status !== CompleteStatus.STREAMING
      ) {
        return state;
      }
      return {
        ...state,
        status: CompleteStatus.PREVIEW,
        streamedResult: action.result,
      };

    case CompleteActionType.STREAM_ERROR:
      return {
        ...state,
        status: CompleteStatus.IDLE,
        error: action.error,
        streamedResult: "",
        taskType: undefined,
        params: undefined,
        selection: undefined,
      };

    case CompleteActionType.ACCEPT_RESULT:
      if (state.status !== CompleteStatus.PREVIEW) {
        return state;
      }
      return {
        ...state,
        status: CompleteStatus.APPLYING,
      };

    case CompleteActionType.REJECT_RESULT:
      if (state.status !== CompleteStatus.PREVIEW) {
        return state;
      }
      return {
        ...initialState,
        enabled: state.enabled,
      };

    case CompleteActionType.CANCEL_TASK:
      return {
        ...initialState,
        enabled: state.enabled,
      };

    case CompleteActionType.CLEAR_ERROR:
      return {
        ...state,
        error: undefined,
      };

    default:
      return state;
  }
}

/**
 * Apply the result to the document
 */
function applyResult(view: EditorView, state: CompleteV2State): void {
  const { taskType, selection, streamedResult } = state;

  if (!streamedResult) return;

  let { tr } = view.state;

  switch (taskType) {
    case AiPromptsWithoutParam.Complete: {
      // Insert at end of document
      tr = tr.insertText(streamedResult, view.state.doc.nodeSize - 2);
      break;
    }

    default: {
      // Replace selection with result
      if (selection) {
        const paragraphs = streamedResult.split("\n\n");
        const paragraphNodes = paragraphs.map((paragraph) =>
          view.state.schema.node(
            "paragraph",
            null,
            paragraph ? view.state.schema.text(paragraph) : undefined,
          ),
        );
        const fragment = Fragment.fromArray(paragraphNodes);

        tr = tr.setSelection(
          TextSelection.create(view.state.doc, selection.from, selection.to),
        );
        tr.selection.replace(tr, new Slice(fragment, 0, 0));
      }
      break;
    }
  }

  // Dispatch the transaction (the state will reset in the next apply cycle)
  view.dispatch(tr);
  view.focus();
}

/**
 * Get text for the task based on task type and selection
 */
function getTextForTask(
  view: EditorView,
  state: CompleteV2State,
  maxSelection: number,
): { text: string; error?: string } {
  const { taskType, selection } = state;

  if (taskType === AiPromptsWithoutParam.Complete) {
    // Get last 2 paragraphs for completion
    const { doc } = view.state;
    const paragraphNodes: string[] = [];
    doc.descendants((node: Node) => {
      if (node.type.name === "paragraph") {
        paragraphNodes.push(node.textContent);
      }
    });

    const text =
      paragraphNodes.length >= 2
        ? paragraphNodes.slice(-2).join(" ")
        : paragraphNodes.join(" ");

    return { text };
  }

  // For other tasks, use selection
  if (!selection) {
    return { text: "", error: "No selection" };
  }

  const selectedText = view.state.doc.textBetween(selection.from, selection.to);
  if (selectedText.length > maxSelection) {
    return { text: "", error: "Selection is too big" };
  }

  const text = view.state.doc.textBetween(selection.from, selection.to, "\n");
  return { text };
}

/**
 * Create the complete V2 plugin
 */
export function completePluginV2(
  apiKey: string,
  options: Partial<CompleteV2Options> = {},
): Plugin<CompleteV2State> {
  const { maxSelection, apiEndpoint, model } = {
    ...defaultCompleteV2Options,
    ...options,
  };

  let isRequestInFlight = false;

  return new Plugin<CompleteV2State>({
    key: completeV2Key,

    state: {
      init(): CompleteV2State {
        return { ...initialState };
      },

      apply(tr, pluginState): CompleteV2State {
        const action = tr.getMeta(completeV2Key) as CompleteAction | undefined;

        if (!action) {
          // If we're in APPLYING state, reset to idle
          if (pluginState.status === CompleteStatus.APPLYING) {
            return {
              ...initialState,
              enabled: pluginState.enabled,
            };
          }
          return pluginState;
        }

        return reducer(pluginState, action);
      },
    },

    view() {
      return {
        update(view) {
          const pluginState = completeV2Key.getState(view.state);
          if (!pluginState || !pluginState.enabled) return;

          // Handle PENDING state - start the request
          if (
            pluginState.status === CompleteStatus.PENDING &&
            !isRequestInFlight
          ) {
            const { text, error } = getTextForTask(
              view,
              pluginState,
              maxSelection,
            );

            if (error) {
              view.dispatch(
                view.state.tr.setMeta(completeV2Key, {
                  type: CompleteActionType.STREAM_ERROR,
                  error,
                }),
              );
              return;
            }

            if (!text) {
              view.dispatch(
                view.state.tr.setMeta(completeV2Key, {
                  type: CompleteActionType.STREAM_ERROR,
                  error: "No text to process",
                }),
              );
              return;
            }

            isRequestInFlight = true;
            streamingRequest({
              view,
              pluginKey: completeV2Key,
              apiKey,
              text,
              task: pluginState.taskType!,
              params: pluginState.params,
              apiEndpoint,
              model,
            }).finally(() => {
              isRequestInFlight = false;
            });
          }

          // Handle APPLYING state - apply the result
          if (pluginState.status === CompleteStatus.APPLYING) {
            applyResult(view, pluginState);
          }
        },

        destroy() {
          // Cancel any pending request when view is destroyed
          // Note: view reference is captured in closure
        },
      };
    },
  });
}
