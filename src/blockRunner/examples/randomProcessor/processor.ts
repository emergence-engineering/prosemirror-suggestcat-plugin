import { EditorView } from "prosemirror-view";
import { ProcessingUnit, UnitProcessorResult } from "../../types";
import {
  RandomProcessorContext,
  RandomProcessorMetadata,
  RandomProcessorResponse,
} from "./types";

// Default configuration
const DEFAULT_MIN_DELAY = 500;
const DEFAULT_MAX_DELAY = 3000;
const DEFAULT_ERROR_RATE = 0.3; // 30% chance of error

// Random delay between min and max
function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Sleep for a given time
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Create processor with context access
export const createRandomProcessor = (
  getContext: () => RandomProcessorContext,
) => {
  return async (
    _view: EditorView,
    unit: ProcessingUnit<RandomProcessorMetadata>,
  ): Promise<UnitProcessorResult<RandomProcessorResponse>> => {
    const context = getContext();
    const minDelay = context.minDelay ?? DEFAULT_MIN_DELAY;
    const maxDelay = context.maxDelay ?? DEFAULT_MAX_DELAY;
    const errorRate = context.errorRate ?? DEFAULT_ERROR_RATE;

    // Simulate processing time
    const processingTime = randomDelay(minDelay, maxDelay);
    await sleep(processingTime);

    // Randomly decide if this should fail
    const shouldFail = Math.random() < errorRate;

    if (shouldFail) {
      return {
        error: new Error(
          `Random error after ${processingTime}ms (attempt ${unit.metadata.attempt})`
        ),
      };
    }

    return {
      data: {
        processingTime,
        success: true,
        message: `Processed "${unit.text.slice(0, 20)}..." in ${processingTime}ms`,
      },
    };
  };
};

// Default processor using default config
export const randomProcessor = async (
  _view: EditorView,
  unit: ProcessingUnit<RandomProcessorMetadata>,
): Promise<UnitProcessorResult<RandomProcessorResponse>> => {
  // Simulate processing time
  const processingTime = randomDelay(DEFAULT_MIN_DELAY, DEFAULT_MAX_DELAY);
  await sleep(processingTime);

  // Randomly decide if this should fail
  const shouldFail = Math.random() < DEFAULT_ERROR_RATE;

  if (shouldFail) {
    return {
      error: new Error(
        `Random error after ${processingTime}ms (attempt ${unit.metadata.attempt})`
      ),
    };
  }

  return {
    data: {
      processingTime,
      success: true,
      message: `Processed "${unit.text.slice(0, 20)}..." in ${processingTime}ms`,
    },
  };
};
