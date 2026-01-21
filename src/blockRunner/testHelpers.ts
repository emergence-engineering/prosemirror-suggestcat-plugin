import { Decoration } from "prosemirror-view";
import {
  ProcessingUnit,
  ResultDecoration,
  ResultDecorationSpec,
  RunnerOptions,
  RunnerState,
  RunnerStateActive,
  RunnerStateIdle,
  RunnerStatus,
  UnitStatus,
} from "./types";

// Default test response type
export type TestResponse = { result: string };

// Default test context state
export type TestContext = { enabled: boolean };

// Default test unit metadata
export type TestMetadata = { label: string };

// Create a mock ProcessingUnit
export function createProcessingUnit<UnitMetadata = TestMetadata>(
  overrides: Partial<ProcessingUnit<UnitMetadata>> = {},
): ProcessingUnit<UnitMetadata> {
  return {
    id: overrides.id ?? {},
    status: overrides.status ?? UnitStatus.QUEUED,
    from: overrides.from ?? 0,
    to: overrides.to ?? 10,
    text: overrides.text ?? "test text",
    mapping: overrides.mapping ?? [{ from: 0, docPos: 1 }],
    metadata: overrides.metadata ?? ({ label: "test" } as UnitMetadata),
    retryCount: overrides.retryCount ?? 0,
    waitUntil: overrides.waitUntil ?? 0,
    response: overrides.response,
  };
}

// Create mock RunnerOptions
export function createRunnerOptions<
  ResponseType = TestResponse,
  ContextState = TestContext,
  UnitMetadata = TestMetadata,
>(
  overrides: Partial<RunnerOptions<ResponseType, ContextState, UnitMetadata>> = {},
): RunnerOptions<ResponseType, ContextState, UnitMetadata> {
  return {
    nodeTypes: overrides.nodeTypes ?? "paragraph",
    priorityFilter: overrides.priorityFilter ?? (() => true),
    visibilityFilter: overrides.visibilityFilter ?? (() => true),
    getGroupId: overrides.getGroupId ?? ((unit) => `group-${unit.from}`),
    batchSize: overrides.batchSize ?? 4,
    maxRetries: overrides.maxRetries ?? 3,
    backoffBase: overrides.backoffBase ?? 1000,
    dirtyHandling: overrides.dirtyHandling ?? {
      shouldRecalculate: true,
      debounceDelay: 300,
    },
    defaultMetadataFactory: overrides.defaultMetadataFactory,
    forceRerender: overrides.forceRerender ?? (() => {}),
    onUpdate: overrides.onUpdate,
  };
}

// Create a mock RunnerStateIdle
export function createIdleState<
  ResponseType = TestResponse,
  ContextState = TestContext,
  UnitMetadata = TestMetadata,
>(
  overrides: Partial<RunnerStateIdle<ResponseType, ContextState, UnitMetadata>> = {},
): RunnerStateIdle<ResponseType, ContextState, UnitMetadata> {
  return {
    status: RunnerStatus.IDLE,
    decorations: overrides.decorations ?? [],
    selected: overrides.selected,
    contextState: overrides.contextState ?? ({ enabled: true } as ContextState),
    options: overrides.options ?? createRunnerOptions<ResponseType, ContextState, UnitMetadata>(),
  };
}

// Create a mock RunnerStateActive
export function createActiveState<
  ResponseType = TestResponse,
  ContextState = TestContext,
  UnitMetadata = TestMetadata,
>(
  overrides: Partial<RunnerStateActive<ResponseType, ContextState, UnitMetadata>> = {},
): RunnerStateActive<ResponseType, ContextState, UnitMetadata> {
  return {
    status: RunnerStatus.ACTIVE,
    unitsInProgress: overrides.unitsInProgress ?? [createProcessingUnit<UnitMetadata>()],
    decorations: overrides.decorations ?? [],
    selected: overrides.selected,
    contextState: overrides.contextState ?? ({ enabled: true } as ContextState),
    options: overrides.options ?? createRunnerOptions<ResponseType, ContextState, UnitMetadata>(),
  };
}

// Create a mock ResultDecoration
export function createResultDecoration<ResponseType = TestResponse>(
  from: number,
  to: number,
  response: ResponseType,
  specOverrides: Partial<ResultDecorationSpec<ResponseType>> = {},
): ResultDecoration<ResponseType> {
  const spec: ResultDecorationSpec<ResponseType> = {
    id: specOverrides.id ?? {},
    unitId: specOverrides.unitId ?? {},
    originalText: specOverrides.originalText ?? "original",
    response,
    ...specOverrides,
  };

  return Decoration.inline(from, to, { class: "test-decoration" }, spec) as ResultDecoration<ResponseType>;
}

// Mock Date.now() utility
export function mockDateNow(timestamp: number): () => void {
  const originalDateNow = Date.now;
  Date.now = () => timestamp;
  return () => {
    Date.now = originalDateNow;
  };
}

// Create a state (either idle or active)
export function createState<
  ResponseType = TestResponse,
  ContextState = TestContext,
  UnitMetadata = TestMetadata,
>(
  type: "idle" | "active",
  overrides: Partial<RunnerState<ResponseType, ContextState, UnitMetadata>> = {},
): RunnerState<ResponseType, ContextState, UnitMetadata> {
  if (type === "idle") {
    return createIdleState<ResponseType, ContextState, UnitMetadata>(
      overrides as Partial<RunnerStateIdle<ResponseType, ContextState, UnitMetadata>>,
    );
  }
  return createActiveState<ResponseType, ContextState, UnitMetadata>(
    overrides as Partial<RunnerStateActive<ResponseType, ContextState, UnitMetadata>>,
  );
}
