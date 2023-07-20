import { Plugin } from "prosemirror-state";
import { DecorationSet } from "prosemirror-view";
import {
  completePluginKey,
  getTextWithNewlines,
  grammarSuggestPluginKey,
} from "./utils";
import {
  CompletePluginState,
  GrammarPluginMeta,
  GrammarSuggestMetaType,
  GrammarSuggestPluginOptions,
  GrammarSuggestPluginState,
  Status,
} from "./types";
import { createMakeRequest } from "./makeRequest";
import {
  handleAccept,
  handleClick,
  handleDiscardSuggestion,
  handleDocChange,
  handleOpenSuggestion,
  handleUpdate,
} from "./eventHandlers";

import { defaultOptions } from "./defaults";

export const grammarSuggestPlugin = (
  apiKey: string,
  options: GrammarSuggestPluginOptions = defaultOptions,
) => {
  let init = false;
  return new Plugin<GrammarSuggestPluginState>({
    key: grammarSuggestPluginKey,
    state: {
      init() {
        return {
          lastText: "",
          decorations: DecorationSet.empty,
          popupDecoration: DecorationSet.empty,
        };
      },
      apply(tr, pluginState, oldState, newState) {
        const meta: GrammarPluginMeta | undefined = tr.getMeta(
          grammarSuggestPluginKey,
        );
        if (meta?.type === GrammarSuggestMetaType.suggestionUpdate) {
          return handleUpdate(pluginState, meta, tr);
        }
        if (meta?.type === GrammarSuggestMetaType.acceptSuggestion) {
          return handleAccept(pluginState, meta, tr);
        }
        if (meta?.type === GrammarSuggestMetaType.openSuggestion) {
          return handleOpenSuggestion(pluginState, meta, tr, options);
        }
        if (meta?.type === GrammarSuggestMetaType.closeSuggestion) {
          return { ...pluginState, popupDecoration: DecorationSet.empty };
        }
        if (meta?.type === GrammarSuggestMetaType.discardSuggestion) {
          return handleDiscardSuggestion(pluginState, meta, tr);
        }
        // return the new plugin state after a transaction
        if (tr.docChanged) {
          return handleDocChange(pluginState, tr, oldState);
        }
        return pluginState;
      },
    },
    props: {
      handleClick,
      decorations: (state) => {
        const pluginState = grammarSuggestPluginKey.getState(state);
        if (!pluginState) return null;
        const completePluginState = completePluginKey.getState(state);
        if (completePluginState?.status !== Status.idle)
          return pluginState.decorations;
        return pluginState.decorations.add(
          state.doc,
          pluginState.popupDecoration.find(),
        );
      },
    },
    view() {
      const makeRequest = createMakeRequest(options, apiKey);
      return {
        update(view, prevState) {
          const pluginState = grammarSuggestPluginKey.getState(view.state);
          // When editor state changes, check if the version changed
          if (
            (view.state.doc.textBetween(
              0,
              view.state.doc.nodeSize - 2,
              "/n",
            ) !==
              prevState.doc.textBetween(0, prevState.doc.nodeSize - 2, "/n") ||
              !init) &&
            pluginState &&
            pluginState.lastText !== getTextWithNewlines(view.state.doc)
          ) {
            init = true;
            makeRequest(view);
          }
        },
      };
    },
  });
};
