import { TextSelection } from "prosemirror-state";

// Re-export common types from main types file
export {
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
} from "../types";

import type { TaskType, TaskParams } from "../types";

// Status enum for the state machine
export enum CompleteStatus {
  IDLE = "idle",
  PENDING = "pending",
  STREAMING = "streaming",
  PREVIEW = "preview",
  APPLYING = "applying",
}

// Plugin state interface
export interface CompleteV2State {
  status: CompleteStatus;
  taskType?: TaskType;
  params?: TaskParams;
  selection?: TextSelection;
  streamedResult: string;
  error?: string;
  enabled: boolean;
}

// Action types for state transitions
export enum CompleteActionType {
  START_TASK = "START_TASK",
  STREAM_UPDATE = "STREAM_UPDATE",
  STREAM_COMPLETE = "STREAM_COMPLETE",
  STREAM_ERROR = "STREAM_ERROR",
  ACCEPT_RESULT = "ACCEPT_RESULT",
  REJECT_RESULT = "REJECT_RESULT",
  CANCEL_TASK = "CANCEL_TASK",
  CLEAR_ERROR = "CLEAR_ERROR",
  SET_ENABLED = "SET_ENABLED",
}

// Action interfaces
export interface StartTaskAction {
  type: CompleteActionType.START_TASK;
  taskType: TaskType;
  params?: TaskParams;
  selection?: TextSelection;
}

export interface StreamUpdateAction {
  type: CompleteActionType.STREAM_UPDATE;
  result: string;
}

export interface StreamCompleteAction {
  type: CompleteActionType.STREAM_COMPLETE;
  result: string;
}

export interface StreamErrorAction {
  type: CompleteActionType.STREAM_ERROR;
  error: string;
}

export interface AcceptResultAction {
  type: CompleteActionType.ACCEPT_RESULT;
}

export interface RejectResultAction {
  type: CompleteActionType.REJECT_RESULT;
}

export interface CancelTaskAction {
  type: CompleteActionType.CANCEL_TASK;
}

export interface ClearErrorAction {
  type: CompleteActionType.CLEAR_ERROR;
}

export interface SetEnabledAction {
  type: CompleteActionType.SET_ENABLED;
  enabled: boolean;
}

// Union type for all actions
export type CompleteAction =
  | StartTaskAction
  | StreamUpdateAction
  | StreamCompleteAction
  | StreamErrorAction
  | AcceptResultAction
  | RejectResultAction
  | CancelTaskAction
  | ClearErrorAction
  | SetEnabledAction;

// Plugin configuration options
export interface CompleteV2Options {
  maxSelection: number;
  apiEndpoint?: string;
  model?: string;
}

// Default options (uses centralized defaults from api module)
export const defaultCompleteV2Options: CompleteV2Options = {
  maxSelection: 1000,
};
