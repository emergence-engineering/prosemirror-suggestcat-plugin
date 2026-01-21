import type { EditorView } from "prosemirror-view";
import type { ProcessingUnit, UnitProcessorResult } from "../../../src/blockRunner/types";

// Test metadata type
export interface TestMetadata {
  label?: string;
}

// Test response type
export interface TestResponse {
  message: string;
  timestamp: number;
}

// Generate a unique key for a unit
export function getUnitKey(unit: ProcessingUnit<TestMetadata>): string {
  return `${unit.from}-${unit.to}-${unit.text.substring(0, 20)}`;
}

// Pending unit with its resolve function
export interface PendingUnit {
  unit: ProcessingUnit<TestMetadata>;
  resolve: (result: UnitProcessorResult<TestResponse>) => void;
}

// Controls exposed to tests for managing the mock processor
export interface MockProcessorControls {
  pendingUnits: Map<string, PendingUnit>;
  processingCalls: number;
}

// Create mock processor controls
export function createMockProcessorControls(): MockProcessorControls {
  return {
    pendingUnits: new Map(),
    processingCalls: 0,
  };
}

// Create a mock processor that doesn't auto-resolve
// Tests control when/how units complete via the controls object
export function createMockProcessor(controls: MockProcessorControls) {
  return async (
    _view: EditorView,
    unit: ProcessingUnit<TestMetadata>,
  ): Promise<UnitProcessorResult<TestResponse>> => {
    controls.processingCalls++;
    const key = getUnitKey(unit);

    return new Promise((resolve) => {
      controls.pendingUnits.set(key, { unit, resolve });
    });
  };
}

// Helper to resolve a pending unit with success
export function resolveUnit(
  controls: MockProcessorControls,
  key: string,
  message: string = "success",
): boolean {
  const pending = controls.pendingUnits.get(key);
  if (!pending) return false;

  pending.resolve({
    data: {
      message,
      timestamp: Date.now(),
    },
  });
  controls.pendingUnits.delete(key);
  return true;
}

// Helper to reject a pending unit with error
export function rejectUnit(
  controls: MockProcessorControls,
  key: string,
  errorMessage: string = "test error",
): boolean {
  const pending = controls.pendingUnits.get(key);
  if (!pending) return false;

  pending.resolve({
    error: new Error(errorMessage),
  });
  controls.pendingUnits.delete(key);
  return true;
}

// Helper to resolve all pending units
export function resolveAllPending(
  controls: MockProcessorControls,
  message: string = "batch resolved",
): number {
  let count = 0;
  for (const [key, pending] of controls.pendingUnits) {
    pending.resolve({
      data: {
        message,
        timestamp: Date.now(),
      },
    });
    controls.pendingUnits.delete(key);
    count++;
  }
  return count;
}

// Helper to get all pending unit keys
export function getPendingKeys(controls: MockProcessorControls): string[] {
  return Array.from(controls.pendingUnits.keys());
}
