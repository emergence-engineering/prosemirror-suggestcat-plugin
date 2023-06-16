import debounce from "lodash.debounce";
import { EditorView } from "prosemirror-view";
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
import { docToTextWithMapping } from "./mapping";

const isJsonString = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

const myApiRequest = async (
  apiKey: string,
  text: string,
): Promise<FixMistakeResultData> => {
  const input = [...text.split("\n")];

  return fetch("https://openairequest-gw5lxik4dq-uc.a.run.app", {
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
      return response.json();
    })
    .then((jsonData) => {
      if (!jsonData || !jsonData.some((i: string) => isJsonString(i))) {
        return {
          fixed: false,
          result: text,
        };
      }
      return {
        result: jsonData
          .map((data: string) => JSON.parse(data).result)
          .join("\n"),
        fixed: true,
      } as FixMistakeResultData;
    })
    .catch((e) => {
      console.error(e.message);

      return {
        fixed: false,
        result: text,
      };
    });
};

export const createMakeRequest = (
  options: GrammarSuggestPluginOptions,
  apiKey: string,
) =>
  debounce((view: EditorView) => {
    // The document changed, start API request
    const versionAtRequestStart = docToTextWithMapping(view.state.doc);
    const oldText =
      grammarSuggestPluginKey.getState(view.state)?.lastText || "";
    const changedRegion = getChangedRegions(
      oldText,
      versionAtRequestStart.text,
    );
    myApiRequest(apiKey, changedRegion.newText)
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
