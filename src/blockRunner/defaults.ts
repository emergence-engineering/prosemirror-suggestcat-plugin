import {
  PartialRunnerOptions,
  ProcessingUnit,
  ResultDecoration,
  RunnerOptions,
} from "./types";

// Default runner options
export const defaultRunnerOptions: RunnerOptions = {
  // Default: process paragraphs
  nodeTypes: "paragraph",

  // Default: all units are priority
  priorityFilter: () => true,

  // Default: all decorations are visible
  visibilityFilter: () => true,

  // Default: all units in same group
  getGroupId: () => "default",

  // Execution control
  batchSize: 4,
  maxRetries: 3,
  backoffBase: 1000,

  // Dirty handling
  dirtyHandling: {
    shouldRecalculate: true,
    debounceDelay: 2000,
    skipDirtyOnSelfChange: true,
  },

  // UI callbacks (noop by default)
  forceRerender: () => undefined,
  onUpdate: undefined,
};

// Helper to merge options with defaults
export function mergeOptions<
  ResponseType = unknown,
  ContextState = unknown,
  UnitMetadata = unknown,
>(
  options: PartialRunnerOptions<ResponseType, ContextState, UnitMetadata>,
): RunnerOptions<ResponseType, ContextState, UnitMetadata> {
  return {
    ...defaultRunnerOptions,
    ...options,
    dirtyHandling: {
      ...defaultRunnerOptions.dirtyHandling,
      ...options.dirtyHandling,
    },
  } as RunnerOptions<ResponseType, ContextState, UnitMetadata>;
}
