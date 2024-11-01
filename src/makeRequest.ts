import debounce from "lodash.debounce";
import { EditorView } from "prosemirror-view";
import { docToTextWithMapping } from "@emergence-engineering/prosemirror-text-map";

import {
  getChangedRegions,
  getTextWithNewlines,
  grammarSuggestPluginKey,
} from "./utils";
import {
  FixMistakeResultData,
  GrammarSuggestMetaType,
  GrammarSuggestPluginOptions,
  UpdateSuggestionMeta,
} from "./types";

const isJsonString = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return true;
  }
  return false;
};

export const request = async (
  apiKey: string,
  text: string,
): Promise<FixMistakeResultData> => {
  const input = [...text.split("\n")];

  return fetch("https://prosemirror-ai-plugin.web.app/api/suggestion", {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      modelParams: {
        input,
      },
    }),
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
      return Promise.reject(response);
    })
    .then((jsonData: string[]) => {
      if (!jsonData?.length) {
        return {
          fixed: false,
          result: text,
        };
      }
      return {
        result: jsonData.join("\n"),
        fixed: true,
      } as FixMistakeResultData;
    })
    .catch((e) => {
      e.text().then((text: string) => {
        console.error({ status: e.status, text });
      });

      return {
        fixed: false,
        result: text,
      };
    });
};

export const createMakeRequest = (
  options: GrammarSuggestPluginOptions,
  apiKey: string,
): ((view: EditorView) => void) =>
  debounce((view: EditorView) => {
    // The document changed, start API request
    const versionAtRequestStart = docToTextWithMapping(view.state.doc);
    const oldText =
      grammarSuggestPluginKey.getState(view.state)?.lastText || "";
    const changedRegion = getChangedRegions(
      oldText,
      versionAtRequestStart.text,
    );
    request(apiKey, changedRegion.newText)
      .then((fix) => {
        // Check if the document version has changed while we were waiting
        if (
          getTextWithNewlines(view.state.doc) !== versionAtRequestStart.text
        ) {
          // The state changed, abort
          return;
        }

        // State did not change, update the plugin state
        const meta: UpdateSuggestionMeta = {
          type: GrammarSuggestMetaType.suggestionUpdate,
          fix,
          changedRegion,
          mapping: versionAtRequestStart.mapping,
          text: versionAtRequestStart.text,
        };
        view.dispatch(view.state.tr.setMeta(grammarSuggestPluginKey, meta));
      })
      .catch((error) => {
        console.error("Grammar suggest API error", error);
      });
  }, options.debounceMs);
