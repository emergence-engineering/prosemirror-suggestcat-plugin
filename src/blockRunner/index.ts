// Types (using export type for isolatedModules compatibility)
export type {
  // Core types
  BlockRunnerTextMapping,
  ProcessingUnit,
  ResultDecorationSpec,
  ResultDecoration,
  RunnerOptions,
  RunnerStateIdle,
  RunnerStateActive,
  RunnerState,
  // Metadata
  MetadataSpec,
  // Actions
  InitAction,
  FinishAction,
  ClearAction,
  ResumeAction,
  UnitStartedAction,
  UnitSuccessAction,
  UnitErrorAction,
  UpdateContextAction,
  RemoveDecorationAction,
  SelectDecorationAction,
  DeselectDecorationAction,
  Action,
  // Processor types
  UnitProcessorResult,
  UnitProcessor,
  // Factory types
  DecorationFactory,
  DecorationTransformer,
  WidgetFactory,
  // Utility types
  ExtractedText,
  UnitRange,
  ProgressInfo,
} from "./types";

// Enums (runtime values, use regular export)
export {
  RunnerStatus,
  UnitStatus,
  ActionType,
} from "./types";

// Defaults
export { defaultRunnerOptions, mergeOptions } from "./defaults";

// Utils
export {
  extractTextWithMapping,
  textToDocPos,
  getUnitsInRange,
  remapPositions,
  calculateBackoff,
  getProgress,
  sleep,
  dispatchAction,
  getUnitById,
  updateUnit,
  allUnitsFinished,
  createUnitsFromDocument,
  pauseRunner,
  resumeRunner,
  canResume,
} from "./utils";

// State
export { handleAction, createInitialState } from "./state";

// Executor
export { executeParallel, hasUnitsToProcess } from "./executor";

// Plugin
export { blockRunnerPlugin, createBlockRunnerKey } from "./plugin";
export type { BlockRunnerPluginConfig } from "./plugin";

// Examples
export * from "./examples/linkDetector";
export * from "./examples/wordComplexity";
export * from "./examples/sentenceLength";
export * from "./examples/randomProcessor";
