export { grammarSuggestPlugin } from "./plugin";
export { defaultOptions, defaultCompleteOptions } from "./defaults";
export {
  completePluginKey,
  grammarSuggestPluginKey,
  getChangedRegions,
  setGrammarSuggestEnabled,
  setCompleteEnabled,
} from "./utils";
export { completePlugin } from "./completePlugin";

export * from "./types";

export { request as completeRequest } from "./makeTaksRequest";
export { request as suggescatRequest } from "./makeRequest";
export { getDiff } from "@emergence-engineering/fast-diff-merge";

// Block Runner exports
export * from "./blockRunner";

// Grammar Suggest V2 (uses blockRunner)
export * from "./grammarSuggestV2";
