// Random processing result
export interface RandomResult {
  processingTime: number; // How long it took (ms)
  success: boolean;
  message: string;
}

// Response type - the random result
export type RandomProcessorResponse = RandomResult;

// Context state - configuration
export interface RandomProcessorContext {
  minDelay: number; // Minimum processing time (ms)
  maxDelay: number; // Maximum processing time (ms)
  errorRate: number; // Probability of error (0-1)
}

// Unit metadata - tracks attempts
export interface RandomProcessorMetadata {
  attempt: number;
}
