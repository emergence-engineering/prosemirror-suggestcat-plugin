import { Plugin } from "prosemirror-state";
import { blockRunnerPlugin, createBlockRunnerKey } from "../../plugin";
import { RunnerState } from "../../types";
import {
  randomProcessorDecorationFactory,
  randomProcessorWidgetFactory,
} from "./decorations";
import { randomProcessor } from "./processor";
import {
  RandomProcessorContext,
  RandomProcessorMetadata,
  RandomProcessorResponse,
} from "./types";

// Default context state
const DEFAULT_CONTEXT: RandomProcessorContext = {
  minDelay: 500,
  maxDelay: 3000,
  errorRate: 0.3,
};

// Plugin key for random processor
export const randomProcessorKey = createBlockRunnerKey<
  RandomProcessorResponse,
  RandomProcessorContext,
  RandomProcessorMetadata
>("randomProcessor");

// Create the random processor plugin
export function createRandomProcessorPlugin(
  initialContext: Partial<RandomProcessorContext> = {},
): Plugin<
  RunnerState<RandomProcessorResponse, RandomProcessorContext, RandomProcessorMetadata>
> {
  return blockRunnerPlugin<
    RandomProcessorResponse,
    RandomProcessorContext,
    RandomProcessorMetadata
  >({
    pluginKey: randomProcessorKey,
    unitProcessor: randomProcessor,
    decorationFactory: randomProcessorDecorationFactory,
    widgetFactory: randomProcessorWidgetFactory,
    initialContextState: {
      ...DEFAULT_CONTEXT,
      ...initialContext,
    },
    options: {
      batchSize: 2, // Process 2 at a time to show parallel processing
      maxRetries: 3,
      backoffBase: 2000, // 2 second base for backoff
    },
  });
}
