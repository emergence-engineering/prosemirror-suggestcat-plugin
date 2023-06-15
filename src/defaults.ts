import { GrammarSuggestPluginOptions } from "./types";
import { createUpdatePopup } from "./createUpdatePopup";

export const defaultOptions: GrammarSuggestPluginOptions = {
  apiKey: "",
  debounceMs: 2000,
  createUpdatePopup,
};
