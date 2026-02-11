import { Plugin } from "prosemirror-state";
import { blockRunnerPlugin, createBlockRunnerKey } from "../../plugin";
import { RunnerState } from "../../types";
import { sentenceLengthDecorationFactory } from "./decorations";
import { sentenceLengthProcessor } from "./processor";
import {
  SentenceLengthContext,
  SentenceLengthMetadata,
  SentenceLengthResponse,
} from "./types";

// Default context state
const DEFAULT_CONTEXT: SentenceLengthContext = {
  warningThreshold: 25,
  errorThreshold: 40,
};

// Plugin key for sentence length
export const sentenceLengthKey = createBlockRunnerKey<
  SentenceLengthResponse,
  SentenceLengthContext,
  SentenceLengthMetadata
>("sentenceLength");

// Create the sentence length plugin
export function createSentenceLengthPlugin(
  initialContext: Partial<SentenceLengthContext> = {},
): Plugin<
  RunnerState<
    SentenceLengthResponse,
    SentenceLengthContext,
    SentenceLengthMetadata
  >
> {
  return blockRunnerPlugin<
    SentenceLengthResponse,
    SentenceLengthContext,
    SentenceLengthMetadata
  >({
    pluginKey: sentenceLengthKey,
    unitProcessor: sentenceLengthProcessor,
    decorationFactory: sentenceLengthDecorationFactory,
    initialContextState: {
      ...DEFAULT_CONTEXT,
      ...initialContext,
    },
  });
}
