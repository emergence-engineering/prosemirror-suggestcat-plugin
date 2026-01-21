// Link match found in text
export interface LinkMatch {
  url: string;
  from: number; // text position
  to: number; // text position
}

// Response type - array of detected links
export type LinkDetectorResponse = LinkMatch[];

// Context state - no state needed for link detection
export type LinkDetectorContext = Record<string, never>;

// Unit metadata - no metadata needed
export type LinkDetectorMetadata = Record<string, never>;
