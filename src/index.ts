export { grammarSuggestPlugin } from "./plugin";
export { defaultOptions, defaultCompleteOptions } from "./defaults";
export { completePluginKey, getChangedRegions } from "./utils";
export { completePlugin } from "./completePlugin";

export * from "./types";

export { request as completeRequest } from "./makeTaksRequest";
export { request as suggescatRequest } from "./makeRequest";
export { getDiff } from "@emergence-engineering/fast-diff-merge";
