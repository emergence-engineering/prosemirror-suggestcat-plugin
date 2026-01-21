// Long sentence found in text
export interface LongSentence {
  from: number; // text position
  to: number; // text position
  wordCount: number;
  severity: "warning" | "error";
}

// Response type - array of long sentences
export type SentenceLengthResponse = LongSentence[];

// Context state - length thresholds
export interface SentenceLengthContext {
  warningThreshold: number; // words to trigger warning (default: 25)
  errorThreshold: number; // words to trigger error (default: 40)
}

// Unit metadata - no metadata needed
export type SentenceLengthMetadata = Record<string, never>;
