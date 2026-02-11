import { Plugin } from "prosemirror-state";
import { blockRunnerPlugin, createBlockRunnerKey } from "../../plugin";
import { RunnerState } from "../../types";
import { wordComplexityDecorationFactory } from "./decorations";
import { wordComplexityProcessor } from "./processor";
import {
  WordComplexityContext,
  WordComplexityMetadata,
  WordComplexityResponse,
} from "./types";

// Default context state
const DEFAULT_CONTEXT: WordComplexityContext = {
  moderateThreshold: 3,
  highThreshold: 4,
};

// Plugin key for word complexity
export const wordComplexityKey = createBlockRunnerKey<
  WordComplexityResponse,
  WordComplexityContext,
  WordComplexityMetadata
>("wordComplexity");

// Create the word complexity plugin
export function createWordComplexityPlugin(
  initialContext: Partial<WordComplexityContext> = {},
): Plugin<
  RunnerState<
    WordComplexityResponse,
    WordComplexityContext,
    WordComplexityMetadata
  >
> {
  return blockRunnerPlugin<
    WordComplexityResponse,
    WordComplexityContext,
    WordComplexityMetadata
  >({
    pluginKey: wordComplexityKey,
    unitProcessor: wordComplexityProcessor,
    decorationFactory: wordComplexityDecorationFactory,
    initialContextState: {
      ...DEFAULT_CONTEXT,
      ...initialContext,
    },
  });
}
