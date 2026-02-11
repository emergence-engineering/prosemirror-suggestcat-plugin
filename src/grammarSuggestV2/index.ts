// Types
export type {
  GrammarSuggestion,
  GrammarFixResult,
  GrammarContextState,
  GrammarUnitMetadata,
  GrammarSuggestV2Options,
  GrammarDecorationSpec,
  ModelFallbackConfig,
} from "./types";

// Plugin
export { grammarSuggestPluginV2, grammarSuggestV2Key } from "./plugin";

// Actions
export {
  acceptSuggestion,
  discardSuggestion,
  selectSuggestion,
  deselectSuggestion,
  getSelectedDecoration,
  requestHint,
} from "./actions";

// Decorations (for customization)
export {
  grammarDecorationFactory,
  grammarDecorationTransformer,
  grammarWidgetFactory,
} from "./decorations";

// Processor (for customization)
export { createGrammarProcessor, type GrammarProcessorOptions } from "./processor";
