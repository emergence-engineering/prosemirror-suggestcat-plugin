import {
  createActiveState,
  createIdleState,
  createProcessingUnit,
  createResultDecoration,
  TestContext,
  TestMetadata,
  TestResponse,
} from "./testHelpers";
import { UnitStatus } from "./types";
import {
  allUnitsFinished,
  calculateBackoff,
  getProgress,
  textToDocPos,
  updateUnit,
} from "./utils";

describe("calculateBackoff", () => {
  it("returns base value for retryCount 0", () => {
    expect(calculateBackoff(0, 1000)).toBe(1000);
  });

  it("calculates exponential backoff for retryCount 1", () => {
    // Math.pow(1000/1000, 1) * 1000 = 1 * 1000 = 1000
    expect(calculateBackoff(1, 1000)).toBe(1000);
  });

  it("calculates exponential backoff for retryCount 2", () => {
    // Math.pow(1000/1000, 2) * 1000 = 1 * 1000 = 1000
    expect(calculateBackoff(2, 1000)).toBe(1000);
  });

  it("calculates exponential backoff with different base", () => {
    // Math.pow(2000/1000, 2) * 1000 = 4 * 1000 = 4000
    expect(calculateBackoff(2, 2000)).toBe(4000);
  });

  it("calculates exponential backoff for retryCount 3 with base 2000", () => {
    // Math.pow(2000/1000, 3) * 1000 = 8 * 1000 = 8000
    expect(calculateBackoff(3, 2000)).toBe(8000);
  });
});

describe("textToDocPos", () => {
  it("returns docPos for first segment", () => {
    const mapping = [
      { from: 0, docPos: 10 },
      { from: 5, docPos: 20 },
      { from: 10, docPos: 30 },
    ];
    expect(textToDocPos(2, mapping)).toBe(12); // 10 + (2 - 0) = 12
  });

  it("returns docPos for middle segment", () => {
    const mapping = [
      { from: 0, docPos: 10 },
      { from: 5, docPos: 20 },
      { from: 10, docPos: 30 },
    ];
    expect(textToDocPos(7, mapping)).toBe(22); // 20 + (7 - 5) = 22
  });

  it("returns docPos for last segment", () => {
    const mapping = [
      { from: 0, docPos: 10 },
      { from: 5, docPos: 20 },
      { from: 10, docPos: 30 },
    ];
    expect(textToDocPos(12, mapping)).toBe(32); // 30 + (12 - 10) = 32
  });

  it("returns first docPos for empty mapping array", () => {
    expect(textToDocPos(5, [])).toBe(0);
  });

  it("handles single entry mapping", () => {
    const mapping = [{ from: 0, docPos: 5 }];
    expect(textToDocPos(3, mapping)).toBe(8); // 5 + (3 - 0) = 8
  });

  it("handles exact boundary position", () => {
    const mapping = [
      { from: 0, docPos: 10 },
      { from: 5, docPos: 20 },
    ];
    expect(textToDocPos(5, mapping)).toBe(20); // 20 + (5 - 5) = 20
  });
});

describe("allUnitsFinished", () => {
  it("returns true when all units are DONE", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.DONE }),
    ];
    expect(allUnitsFinished(units)).toBe(true);
  });

  it("returns true when all units are ERROR", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.ERROR }),
      createProcessingUnit({ status: UnitStatus.ERROR }),
    ];
    expect(allUnitsFinished(units)).toBe(true);
  });

  it("returns true when mixed DONE and ERROR", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.ERROR }),
      createProcessingUnit({ status: UnitStatus.DONE }),
    ];
    expect(allUnitsFinished(units)).toBe(true);
  });

  it("returns false when any unit is QUEUED", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.QUEUED }),
    ];
    expect(allUnitsFinished(units)).toBe(false);
  });

  it("returns false when any unit is PROCESSING", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.PROCESSING }),
    ];
    expect(allUnitsFinished(units)).toBe(false);
  });

  it("returns false when any unit is WAITING", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.WAITING }),
    ];
    expect(allUnitsFinished(units)).toBe(false);
  });

  it("returns false when any unit is BACKOFF", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.BACKOFF }),
    ];
    expect(allUnitsFinished(units)).toBe(false);
  });

  it("returns false when any unit is DIRTY", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.DIRTY }),
    ];
    expect(allUnitsFinished(units)).toBe(false);
  });

  it("returns true for empty array", () => {
    expect(allUnitsFinished([])).toBe(true);
  });
});

describe("getProgress", () => {
  it("returns zeros with decoration count for IDLE state", () => {
    const decorations = [
      createResultDecoration(0, 5, { result: "test1" }),
      createResultDecoration(10, 15, { result: "test2" }),
    ];
    const state = createIdleState<TestResponse, TestContext, TestMetadata>({
      decorations,
    });

    const progress = getProgress(state);
    expect(progress).toEqual({
      completed: 0,
      total: 0,
      decorations: 2,
    });
  });

  it("calculates completed/total for ACTIVE state", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.ERROR }),
      createProcessingUnit({ status: UnitStatus.PROCESSING }),
      createProcessingUnit({ status: UnitStatus.QUEUED }),
    ];
    const decorations = [createResultDecoration(0, 5, { result: "test" })];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
      decorations,
    });

    const progress = getProgress(state);
    expect(progress).toEqual({
      completed: 2, // DONE + ERROR
      total: 4,
      decorations: 1,
    });
  });

  it("handles empty units in ACTIVE state", () => {
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: [],
      decorations: [],
    });

    const progress = getProgress(state);
    expect(progress).toEqual({
      completed: 0,
      total: 0,
      decorations: 0,
    });
  });
});

describe("updateUnit", () => {
  it("updates target unit while preserving others", () => {
    const unitId1 = {};
    const unitId2 = {};
    const units = [
      createProcessingUnit({ id: unitId1, status: UnitStatus.QUEUED, text: "first" }),
      createProcessingUnit({ id: unitId2, status: UnitStatus.QUEUED, text: "second" }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });

    const newState = updateUnit(state, unitId1, { status: UnitStatus.PROCESSING });

    expect(newState.unitsInProgress[0].status).toBe(UnitStatus.PROCESSING);
    expect(newState.unitsInProgress[0].text).toBe("first");
    expect(newState.unitsInProgress[1].status).toBe(UnitStatus.QUEUED);
    expect(newState.unitsInProgress[1].text).toBe("second");
  });

  it("returns unchanged state for non-existent ID", () => {
    const unitId = {};
    const units = [createProcessingUnit({ id: unitId, status: UnitStatus.QUEUED })];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });

    const nonExistentId = {};
    const newState = updateUnit(state, nonExistentId, { status: UnitStatus.PROCESSING });

    expect(newState.unitsInProgress[0].status).toBe(UnitStatus.QUEUED);
  });

  it("can update multiple fields at once", () => {
    const unitId = {};
    const units = [
      createProcessingUnit({ id: unitId, status: UnitStatus.QUEUED, retryCount: 0, waitUntil: 0 }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });

    const newState = updateUnit(state, unitId, {
      status: UnitStatus.BACKOFF,
      retryCount: 2,
      waitUntil: 5000,
    });

    expect(newState.unitsInProgress[0].status).toBe(UnitStatus.BACKOFF);
    expect(newState.unitsInProgress[0].retryCount).toBe(2);
    expect(newState.unitsInProgress[0].waitUntil).toBe(5000);
  });

  it("sorts units by waitUntil when waitUntil is updated", () => {
    const unitId1 = {};
    const unitId2 = {};
    const unitId3 = {};
    const units = [
      createProcessingUnit({ id: unitId1, waitUntil: 1000, text: "first" }),
      createProcessingUnit({ id: unitId2, waitUntil: 2000, text: "second" }),
      createProcessingUnit({ id: unitId3, waitUntil: 3000, text: "third" }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });

    // Update first unit to have highest waitUntil - should move to end
    const newState = updateUnit(state, unitId1, { waitUntil: 5000 });

    expect(newState.unitsInProgress[0].text).toBe("second"); // waitUntil: 2000
    expect(newState.unitsInProgress[1].text).toBe("third");  // waitUntil: 3000
    expect(newState.unitsInProgress[2].text).toBe("first");  // waitUntil: 5000
  });

  it("does not sort when updating fields other than waitUntil", () => {
    const unitId1 = {};
    const unitId2 = {};
    const units = [
      createProcessingUnit({ id: unitId1, waitUntil: 5000, text: "first" }),
      createProcessingUnit({ id: unitId2, waitUntil: 1000, text: "second" }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });

    // Update status only - should not trigger sort
    const newState = updateUnit(state, unitId1, { status: UnitStatus.PROCESSING });

    expect(newState.unitsInProgress[0].text).toBe("first");  // Order preserved
    expect(newState.unitsInProgress[1].text).toBe("second");
  });
});
