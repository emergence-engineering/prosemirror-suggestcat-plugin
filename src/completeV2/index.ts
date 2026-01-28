// Types
export {
  CompleteStatus,
  CompleteActionType,
  type CompleteV2State,
  type CompleteAction,
  type CompleteV2Options,
  type StartTaskAction,
  type StreamUpdateAction,
  type StreamCompleteAction,
  type StreamErrorAction,
  type AcceptResultAction,
  type RejectResultAction,
  type CancelTaskAction,
  type ClearErrorAction,
  type SetEnabledAction,
  defaultCompleteV2Options,
  // Re-exported from main types
  AiPromptsWithoutParam,
  AiPromptsWithParam,
  MoodParamType,
  TranslationTargetLanguage,
  type MoodParams,
  type TranslationParams,
  type HintParams,
  type CustomParams,
  type TaskParams,
  type TaskType,
} from "./types";

// Plugin
export { completePluginV2, completeV2Key } from "./plugin";

// Actions
export {
  startTask,
  acceptResult,
  rejectResult,
  cancelTask,
  setEnabled,
  clearError,
  getCompleteState,
} from "./actions";

// Streaming utilities (for advanced use cases)
export { cancelActiveRequest, hasActiveRequest } from "./streaming";
