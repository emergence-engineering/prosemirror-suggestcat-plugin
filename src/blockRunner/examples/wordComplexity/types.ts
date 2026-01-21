// Complex word found in text
export interface ComplexWord {
  word: string;
  from: number; // text position
  to: number; // text position
  syllables: number;
  complexity: "moderate" | "high";
}

// Response type - array of complex words
export type WordComplexityResponse = ComplexWord[];

// Context state - complexity thresholds
export interface WordComplexityContext {
  moderateThreshold: number; // syllables to trigger moderate (default: 3)
  highThreshold: number; // syllables to trigger high (default: 4)
}

// Unit metadata - no metadata needed
export type WordComplexityMetadata = Record<string, never>;
