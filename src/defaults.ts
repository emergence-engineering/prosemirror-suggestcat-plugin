import { GrammarSuggestPluginOptions } from "./types";
import { createUpdatePopup } from "./createUpdatePopup";

export const defaultOptions: GrammarSuggestPluginOptions = {
  debounceMs: 2000,
  createUpdatePopup,
};
