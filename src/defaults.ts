import { DefaultCompleteOptions, GrammarSuggestPluginOptions } from "./types";
import { createUpdatePopup } from "./createUpdatePopup";

export const defaultOptions: GrammarSuggestPluginOptions = {
  debounceMs: 2000,
  createUpdatePopup,
};

export const defaultCompleteOptions: DefaultCompleteOptions = {
  maxSelection: 1000,
};
