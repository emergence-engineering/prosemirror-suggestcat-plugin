/**
 * Auto-complete plugin types
 *
 * This module defines the state machine statuses, state interface,
 * action types, and configuration options for the auto-complete plugin.
 */

// State machine statuses
export enum AutoCompleteStatus {
  IDLE = "idle", // Waiting for user input
  DEBOUNCING = "debouncing", // Timer running after user typed
  PENDING = "pending", // API request started
  STREAMING = "streaming", // Receiving chunks
  SHOWING = "showing", // Complete suggestion displayed
}

// Plugin state interface
export interface AutoCompleteState {
  status: AutoCompleteStatus;
  enabled: boolean;
  suggestion: string; // Ghost text content
  cursorPos: number; // Position for ghost text
  error?: string;
}

// Action types for state transitions
export enum AutoCompleteActionType {
  SET_ENABLED = "SET_ENABLED",
  START_DEBOUNCE = "START_DEBOUNCE",
  START_REQUEST = "START_REQUEST",
  STREAM_UPDATE = "STREAM_UPDATE",
  STREAM_COMPLETE = "STREAM_COMPLETE",
  STREAM_ERROR = "STREAM_ERROR",
  DISMISS = "DISMISS",
  ACCEPT = "ACCEPT",
}

// Action interfaces - prefixed with AutoComplete to avoid export conflicts
export interface AutoCompleteSetEnabledAction {
  type: AutoCompleteActionType.SET_ENABLED;
  enabled: boolean;
}

export interface AutoCompleteStartDebounceAction {
  type: AutoCompleteActionType.START_DEBOUNCE;
  cursorPos: number;
}

export interface AutoCompleteStartRequestAction {
  type: AutoCompleteActionType.START_REQUEST;
}

export interface AutoCompleteStreamUpdateAction {
  type: AutoCompleteActionType.STREAM_UPDATE;
  suggestion: string;
}

export interface AutoCompleteStreamCompleteAction {
  type: AutoCompleteActionType.STREAM_COMPLETE;
  suggestion: string;
}

export interface AutoCompleteStreamErrorAction {
  type: AutoCompleteActionType.STREAM_ERROR;
  error: string;
}

export interface AutoCompleteDismissAction {
  type: AutoCompleteActionType.DISMISS;
}

export interface AutoCompleteAcceptAction {
  type: AutoCompleteActionType.ACCEPT;
}

// Union type for all actions
export type AutoCompleteAction =
  | AutoCompleteSetEnabledAction
  | AutoCompleteStartDebounceAction
  | AutoCompleteStartRequestAction
  | AutoCompleteStreamUpdateAction
  | AutoCompleteStreamCompleteAction
  | AutoCompleteStreamErrorAction
  | AutoCompleteDismissAction
  | AutoCompleteAcceptAction;

// Plugin configuration options
export interface AutoCompleteOptions {
  debounceMs: number; // Default: 500
  maxContextLength: number; // Default: 2000
  apiEndpoint?: string;
  model?: string;
  ghostTextClass?: string; // Default: "autoCompleteGhostText"
}

// Default options
export const defaultAutoCompleteOptions: AutoCompleteOptions = {
  debounceMs: 500,
  maxContextLength: 2000,
  ghostTextClass: "autoCompleteGhostText",
};
