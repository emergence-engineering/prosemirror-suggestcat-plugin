import { Decoration, EditorView } from "prosemirror-view";

// Runner status - whether the runner is actively processing
export enum RunnerStatus {
  IDLE = "IDLE",
  ACTIVE = "ACTIVE",
}

// Unit status lifecycle
export enum UnitStatus {
  DIRTY = "DIRTY", // Text changed, needs re-run
  WAITING = "WAITING", // Queued but not yet selected
  QUEUED = "QUEUED", // Selected, ready to process
  PROCESSING = "PROCESSING", // Currently running
  DONE = "DONE", // Successfully completed
  BACKOFF = "BACKOFF", // Failed, waiting before retry
  ERROR = "ERROR", // Max retries exceeded
}

// Action types for state mutations
export enum ActionType {
  INIT = "INIT",
  FINISH = "FINISH",
  CLEAR = "CLEAR",
  RESUME = "RESUME",
  UNIT_STARTED = "UNIT_STARTED",
  UNIT_SUCCESS = "UNIT_SUCCESS",
  UNIT_ERROR = "UNIT_ERROR",
  UPDATE_CONTEXT = "UPDATE_CONTEXT",
  REMOVE_DECORATION = "REMOVE_DECORATION",
  SELECT_DECORATION = "SELECT_DECORATION",
  DESELECT_DECORATION = "DESELECT_DECORATION",
}

// Text mapping for position translation (block runner specific)
export interface BlockRunnerTextMapping {
  from: number; // Position in text
  docPos: number; // Position in document
}

// Processing unit - a block of text to be processed
export interface ProcessingUnit<UnitMetadata = unknown> {
  id: object; // Unique identifier (use {} for uniqueness)
  status: UnitStatus;
  from: number; // Start position in document
  to: number; // End position in document
  text: string; // Text content to process
  mapping: BlockRunnerTextMapping[]; // Maps text positions to doc positions
  metadata: UnitMetadata; // Custom data per implementation
  retryCount: number; // Failed attempts
  waitUntil: number; // Backoff deadline (ms timestamp)
  response?: unknown; // Result (only when DONE)
}

// Decoration spec for result decorations
export interface ResultDecorationSpec<ResponseType = unknown> {
  id: object; // Unique decoration ID
  unitId: object; // Which unit created it
  originalText: string; // Full text being highlighted
  response: ResponseType; // Analysis result
  [key: string]: unknown; // Allow custom fields
}

// Result decoration extends ProseMirror's Decoration
export interface ResultDecoration<ResponseType = unknown> extends Decoration {
  spec: ResultDecorationSpec<ResponseType>;
}

// Runner options - configuration for the runner
export interface RunnerOptions<
  ResponseType = unknown,
  ContextState = unknown,
  UnitMetadata = unknown,
> {
  // Node selection - which node types to process
  nodeTypes: string | string[]; // Node types to process (default: "paragraph")

  // Filtering & Prioritization
  priorityFilter: (
    unit: ProcessingUnit<UnitMetadata>,
    contextState: ContextState,
  ) => boolean;
  visibilityFilter: (
    decoration: ResultDecoration<ResponseType>,
    contextState: ContextState,
  ) => boolean;
  getGroupId: (unit: ProcessingUnit<UnitMetadata>) => string;

  // Execution Control
  batchSize: number; // Parallel workers (default: 4)
  maxRetries: number; // Retry limit (default: 3)
  backoffBase: number; // Initial retry delay ms (default: 1000)

  // Dirty handling configuration
  dirtyHandling: DirtyHandlingOptions;

  // Metadata factory for new units (used when splits create new nodes)
  defaultMetadataFactory?: (range: UnitRange) => UnitMetadata;

  // UI Callbacks
  forceRerender: () => void; // Trigger UI update
  onUpdate?: (
    state: RunnerState<ResponseType, ContextState, UnitMetadata>,
  ) => void; // State change callback
}

// Dirty handling options - extracted for partial typing
export interface DirtyHandlingOptions {
  shouldRecalculate: boolean; // Reprocess on text change
  debounceDelay: number; // Delay before reprocessing (ms)
  skipDirtyOnSelfChange: boolean; // Skip dirty marking when plugin triggers doc change (default: true)
}

// Partial runner options - allows partial dirtyHandling
export type PartialRunnerOptions<ResponseType, ContextState, UnitMetadata> =
  Omit<Partial<RunnerOptions<ResponseType, ContextState, UnitMetadata>>, 'dirtyHandling'> & {
    dirtyHandling?: Partial<DirtyHandlingOptions>;
  };

// Runner state when idle
export interface RunnerStateIdle<
  ResponseType = unknown,
  ContextState = unknown,
  UnitMetadata = unknown,
> {
  status: RunnerStatus.IDLE;
  unitsInProgress?: ProcessingUnit<UnitMetadata>[]; // Preserved when paused via FINISH
  decorations: ResultDecoration<ResponseType>[];
  selected: object | undefined;
  contextState: ContextState;
  options: RunnerOptions<ResponseType, ContextState, UnitMetadata>;
}

// Runner state when active
export interface RunnerStateActive<
  ResponseType = unknown,
  ContextState = unknown,
  UnitMetadata = unknown,
> {
  status: RunnerStatus.ACTIVE;
  unitsInProgress: ProcessingUnit<UnitMetadata>[];
  decorations: ResultDecoration<ResponseType>[];
  selected: object | undefined;
  contextState: ContextState;
  options: RunnerOptions<ResponseType, ContextState, UnitMetadata>;
}

// Combined runner state type
export type RunnerState<
  ResponseType = unknown,
  ContextState = unknown,
  UnitMetadata = unknown,
> =
  | RunnerStateIdle<ResponseType, ContextState, UnitMetadata>
  | RunnerStateActive<ResponseType, ContextState, UnitMetadata>;

// Metadata specification for INIT action
export interface MetadataSpec<UnitMetadata = unknown> {
  single?: UnitMetadata;
  array?: UnitMetadata[];
  factory?: (unit: ProcessingUnit<UnitMetadata>) => UnitMetadata;
}

// Action payloads
export interface InitAction<UnitMetadata = unknown> {
  type: ActionType.INIT;
  onlySelection?: boolean;
  metadata: MetadataSpec<UnitMetadata>;
}

export interface FinishAction {
  type: ActionType.FINISH;
}

export interface ClearAction {
  type: ActionType.CLEAR;
}

export interface UnitStartedAction {
  type: ActionType.UNIT_STARTED;
  unitId: object;
}

export interface UnitSuccessAction<ResponseType = unknown> {
  type: ActionType.UNIT_SUCCESS;
  unitId: object;
  response: ResponseType;
}

export interface UnitErrorAction {
  type: ActionType.UNIT_ERROR;
  unitId: object;
  error: Error;
}

export interface UpdateContextAction<ContextState = unknown> {
  type: ActionType.UPDATE_CONTEXT;
  contextState: ContextState;
}

export interface RemoveDecorationAction {
  type: ActionType.REMOVE_DECORATION;
  id: object;
}

export interface SelectDecorationAction {
  type: ActionType.SELECT_DECORATION;
  id: object;
}

export interface DeselectDecorationAction {
  type: ActionType.DESELECT_DECORATION;
}

export interface ResumeAction {
  type: ActionType.RESUME;
}

// Union of all action types
export type Action<
  ResponseType = unknown,
  ContextState = unknown,
  UnitMetadata = unknown,
> =
  | InitAction<UnitMetadata>
  | FinishAction
  | ClearAction
  | ResumeAction
  | UnitStartedAction
  | UnitSuccessAction<ResponseType>
  | UnitErrorAction
  | UpdateContextAction<ContextState>
  | RemoveDecorationAction
  | SelectDecorationAction
  | DeselectDecorationAction;

// Unit processor function type
export interface UnitProcessorResult<ResponseType = unknown> {
  data?: ResponseType;
  error?: Error;
}

export type UnitProcessor<ResponseType = unknown, UnitMetadata = unknown> = (
  view: EditorView,
  unit: ProcessingUnit<UnitMetadata>,
) => Promise<UnitProcessorResult<ResponseType>>;

// Decoration factory - converts response to decorations
export type DecorationFactory<ResponseType = unknown, UnitMetadata = unknown> = (
  response: ResponseType,
  unit: ProcessingUnit<UnitMetadata>,
) => ResultDecoration<ResponseType>[];

// Decoration transformer - transforms decorations (e.g., highlight selected)
export type DecorationTransformer<
  ResponseType = unknown,
  ContextState = unknown,
  UnitMetadata = unknown,
> = (
  decorations: ResultDecoration<ResponseType>[],
  state: RunnerState<ResponseType, ContextState, UnitMetadata>,
) => ResultDecoration<ResponseType>[];

// Widget factory - creates loading/error widgets for units
export type WidgetFactory<UnitMetadata = unknown> = (
  unit: ProcessingUnit<UnitMetadata>,
) => Decoration | undefined;

// Extracted text with mapping
export interface ExtractedText {
  text: string;
  mapping: BlockRunnerTextMapping[];
}

// Unit range info
export interface UnitRange extends ExtractedText {
  from: number;
  to: number;
}

// Progress info
export interface ProgressInfo {
  completed: number;
  total: number;
  decorations: number;
}
