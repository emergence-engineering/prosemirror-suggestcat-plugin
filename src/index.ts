export { defaultOptions, defaultCompleteOptions } from "./defaults";
export {
  completePluginKey,
  grammarSuggestPluginKey,
  getChangedRegions,
  setGrammarSuggestEnabled,
  setCompleteEnabled,
} from "./utils";

export * from "./types";

export { getDiff } from "@emergence-engineering/fast-diff-merge";

// Centralized API module
export * from "./api";

// Block Runner exports
export * from "./blockRunner";

// Grammar Suggest V2 (uses blockRunner)
export * from "./grammarSuggestV2";

// Complete V2 (modular completion plugin)
export * from "./completeV2";

// Backward compatibility alias
import { completePluginV2 } from "./completeV2";
/** @deprecated Use completePluginV2 instead */
export const completePlugin = completePluginV2;
