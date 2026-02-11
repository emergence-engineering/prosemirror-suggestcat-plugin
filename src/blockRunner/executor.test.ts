import {
  createActiveState,
  createIdleState,
  createProcessingUnit,
  createRunnerOptions,
  mockDateNow,
  TestContext,
  TestMetadata,
  TestResponse,
} from "./testHelpers";
import { hasUnitsToProcess, _selectNextUnitForTesting } from "./executor";
import { UnitStatus } from "./types";

describe("hasUnitsToProcess", () => {
  it("returns false for IDLE state", () => {
    const state = createIdleState<TestResponse, TestContext, TestMetadata>();
    expect(hasUnitsToProcess(state)).toBe(false);
  });

  it("returns true when any unit is QUEUED", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.QUEUED }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    expect(hasUnitsToProcess(state)).toBe(true);
  });

  it("returns true when any unit is WAITING", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.WAITING }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    expect(hasUnitsToProcess(state)).toBe(true);
  });

  it("returns true when any unit is BACKOFF", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.BACKOFF }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    expect(hasUnitsToProcess(state)).toBe(true);
  });

  it("returns true when any unit is DIRTY", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.DIRTY }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    expect(hasUnitsToProcess(state)).toBe(true);
  });

  it("returns true when any unit is PROCESSING", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.PROCESSING }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    expect(hasUnitsToProcess(state)).toBe(true);
  });

  it("returns false when all units are DONE", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.DONE }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    expect(hasUnitsToProcess(state)).toBe(false);
  });

  it("returns false when all units are ERROR", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.ERROR }),
      createProcessingUnit({ status: UnitStatus.ERROR }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    expect(hasUnitsToProcess(state)).toBe(false);
  });

  it("returns false when all units are DONE or ERROR", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.ERROR }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    expect(hasUnitsToProcess(state)).toBe(false);
  });

  it("returns false for empty units array", () => {
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: [],
    });
    expect(hasUnitsToProcess(state)).toBe(false);
  });
});

describe("_selectNextUnitForTesting (selectNextUnit)", () => {
  it("returns undefined for IDLE state", () => {
    const state = createIdleState<TestResponse, TestContext, TestMetadata>();
    const options = createRunnerOptions<
      TestResponse,
      TestContext,
      TestMetadata
    >();
    expect(_selectNextUnitForTesting(state, options)).toBeUndefined();
  });

  it("returns undefined when no units exist", () => {
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: [],
    });
    const options = createRunnerOptions<
      TestResponse,
      TestContext,
      TestMetadata
    >();
    expect(_selectNextUnitForTesting(state, options)).toBeUndefined();
  });

  it("returns undefined when all units are DONE", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.DONE }),
      createProcessingUnit({ status: UnitStatus.DONE }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    const options = createRunnerOptions<
      TestResponse,
      TestContext,
      TestMetadata
    >();
    expect(_selectNextUnitForTesting(state, options)).toBeUndefined();
  });

  it("returns undefined when all units are ERROR", () => {
    const units = [
      createProcessingUnit({ status: UnitStatus.ERROR }),
      createProcessingUnit({ status: UnitStatus.ERROR }),
    ];
    const state = createActiveState<TestResponse, TestContext, TestMetadata>({
      unitsInProgress: units,
    });
    const options = createRunnerOptions<
      TestResponse,
      TestContext,
      TestMetadata
    >();
    expect(_selectNextUnitForTesting(state, options)).toBeUndefined();
  });

  it("returns ready QUEUED unit with waitUntil <= now", () => {
    const restoreDate = mockDateNow(1000);
    try {
      const queuedUnit = createProcessingUnit({
        status: UnitStatus.QUEUED,
        waitUntil: 500,
      });
      const units = [queuedUnit];
      const state = createActiveState<TestResponse, TestContext, TestMetadata>({
        unitsInProgress: units,
      });
      const options = createRunnerOptions<
        TestResponse,
        TestContext,
        TestMetadata
      >();

      const result = _selectNextUnitForTesting(state, options);
      expect(result).toBe(queuedUnit);
    } finally {
      restoreDate();
    }
  });

  it("returns ready BACKOFF unit with waitUntil <= now", () => {
    const restoreDate = mockDateNow(1000);
    try {
      const backoffUnit = createProcessingUnit({
        status: UnitStatus.BACKOFF,
        waitUntil: 500,
      });
      const units = [backoffUnit];
      const state = createActiveState<TestResponse, TestContext, TestMetadata>({
        unitsInProgress: units,
      });
      const options = createRunnerOptions<
        TestResponse,
        TestContext,
        TestMetadata
      >();

      const result = _selectNextUnitForTesting(state, options);
      expect(result).toBe(backoffUnit);
    } finally {
      restoreDate();
    }
  });

  it("returns ready DIRTY unit with waitUntil <= now", () => {
    const restoreDate = mockDateNow(1000);
    try {
      const dirtyUnit = createProcessingUnit({
        status: UnitStatus.DIRTY,
        waitUntil: 500,
      });
      const units = [dirtyUnit];
      const state = createActiveState<TestResponse, TestContext, TestMetadata>({
        unitsInProgress: units,
      });
      const options = createRunnerOptions<
        TestResponse,
        TestContext,
        TestMetadata
      >();

      const result = _selectNextUnitForTesting(state, options);
      expect(result).toBe(dirtyUnit);
    } finally {
      restoreDate();
    }
  });

  it("prioritizes units matching priority filter", () => {
    const restoreDate = mockDateNow(1000);
    try {
      const lowPriorityUnit = createProcessingUnit({
        status: UnitStatus.QUEUED,
        waitUntil: 0,
        metadata: { label: "low" },
      });
      const highPriorityUnit = createProcessingUnit({
        status: UnitStatus.QUEUED,
        waitUntil: 0,
        metadata: { label: "high" },
      });
      const units = [lowPriorityUnit, highPriorityUnit];
      const state = createActiveState<TestResponse, TestContext, TestMetadata>({
        unitsInProgress: units,
      });
      const options = createRunnerOptions<
        TestResponse,
        TestContext,
        TestMetadata
      >({
        priorityFilter: (unit) => unit.metadata.label === "high",
      });

      const result = _selectNextUnitForTesting(state, options);
      expect(result).toBe(highPriorityUnit);
    } finally {
      restoreDate();
    }
  });

  it("returns any ready unit when no priority match", () => {
    const restoreDate = mockDateNow(1000);
    try {
      const unit1 = createProcessingUnit({
        status: UnitStatus.QUEUED,
        waitUntil: 0,
        metadata: { label: "first" },
      });
      const unit2 = createProcessingUnit({
        status: UnitStatus.QUEUED,
        waitUntil: 0,
        metadata: { label: "second" },
      });
      const units = [unit1, unit2];
      const state = createActiveState<TestResponse, TestContext, TestMetadata>({
        unitsInProgress: units,
      });
      const options = createRunnerOptions<
        TestResponse,
        TestContext,
        TestMetadata
      >({
        priorityFilter: () => false, // No priority match
      });

      const result = _selectNextUnitForTesting(state, options);
      expect(result).toBe(unit1); // First ready unit
    } finally {
      restoreDate();
    }
  });

  it("returns blocking unit when no ready units available", () => {
    const restoreDate = mockDateNow(1000);
    try {
      const blockingUnit = createProcessingUnit({
        status: UnitStatus.BACKOFF,
        waitUntil: 2000, // In the future
      });
      const units = [blockingUnit];
      const state = createActiveState<TestResponse, TestContext, TestMetadata>({
        unitsInProgress: units,
      });
      const options = createRunnerOptions<
        TestResponse,
        TestContext,
        TestMetadata
      >();

      const result = _selectNextUnitForTesting(state, options);
      expect(result).toBe(blockingUnit);
    } finally {
      restoreDate();
    }
  });

  it("prefers ready unit over blocking unit", () => {
    const restoreDate = mockDateNow(1000);
    try {
      const blockingUnit = createProcessingUnit({
        status: UnitStatus.BACKOFF,
        waitUntil: 2000, // In the future
        metadata: { label: "blocking" },
      });
      const readyUnit = createProcessingUnit({
        status: UnitStatus.QUEUED,
        waitUntil: 0, // Ready now
        metadata: { label: "ready" },
      });
      const units = [blockingUnit, readyUnit];
      const state = createActiveState<TestResponse, TestContext, TestMetadata>({
        unitsInProgress: units,
      });
      const options = createRunnerOptions<
        TestResponse,
        TestContext,
        TestMetadata
      >();

      const result = _selectNextUnitForTesting(state, options);
      expect(result).toBe(readyUnit);
    } finally {
      restoreDate();
    }
  });

  it("does not select PROCESSING units", () => {
    const restoreDate = mockDateNow(1000);
    try {
      const processingUnit = createProcessingUnit({
        status: UnitStatus.PROCESSING,
        waitUntil: 0,
      });
      const units = [processingUnit];
      const state = createActiveState<TestResponse, TestContext, TestMetadata>({
        unitsInProgress: units,
      });
      const options = createRunnerOptions<
        TestResponse,
        TestContext,
        TestMetadata
      >();

      const result = _selectNextUnitForTesting(state, options);
      expect(result).toBeUndefined();
    } finally {
      restoreDate();
    }
  });

  it("does not select WAITING units", () => {
    const restoreDate = mockDateNow(1000);
    try {
      const waitingUnit = createProcessingUnit({
        status: UnitStatus.WAITING,
        waitUntil: 0,
      });
      const units = [waitingUnit];
      const state = createActiveState<TestResponse, TestContext, TestMetadata>({
        unitsInProgress: units,
      });
      const options = createRunnerOptions<
        TestResponse,
        TestContext,
        TestMetadata
      >();

      const result = _selectNextUnitForTesting(state, options);
      expect(result).toBeUndefined();
    } finally {
      restoreDate();
    }
  });
});
