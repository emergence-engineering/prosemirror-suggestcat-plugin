// Mock API for GrammarSuggestV2 E2E tests
// Intercepts fetch calls to provide controlled grammar responses

export interface GrammarMockResponse {
  text: string;
  result: {
    fixed: boolean;
    result: string;
  };
}

export interface MockRequest {
  text: string;
  timestamp: number;
}

export interface MockApiControls {
  // Queue of responses keyed by input text
  responses: Map<string, GrammarMockResponse>;
  // Default response for any unmatched text
  defaultResponse: GrammarMockResponse | null;
  // Error to send (if set)
  errorMessage: string | null;
  // Request tracking
  requests: MockRequest[];
  // Pending requests (for manual resolution)
  pendingRequests: Map<string, {
    resolve: (response: Response) => void;
    text: string;
  }>;
  // Whether to auto-resolve requests
  autoResolve: boolean;
  // Delay before responding (ms)
  responseDelay: number;
}

// Global mock controls
export const mockControls: MockApiControls = {
  responses: new Map(),
  defaultResponse: null,
  errorMessage: null,
  requests: [],
  pendingRequests: new Map(),
  autoResolve: true,
  responseDelay: 10,
};

// Reset mock state
export function resetMock(): void {
  mockControls.responses.clear();
  mockControls.defaultResponse = null;
  mockControls.errorMessage = null;
  mockControls.requests = [];
  mockControls.pendingRequests.clear();
  mockControls.autoResolve = true;
  mockControls.responseDelay = 10;
}

// Set a response for a specific input text
export function setResponse(text: string, result: { fixed: boolean; result: string }): void {
  mockControls.responses.set(text, { text, result });
}

// Set a default response for any unmatched text
export function setDefaultResponse(result: { fixed: boolean; result: string }): void {
  mockControls.defaultResponse = { text: "", result };
}

// Set an error to be returned
export function setError(error: string | null): void {
  mockControls.errorMessage = error;
}

// Get all requests made
export function getRequests(): MockRequest[] {
  return mockControls.requests;
}

// Get request count
export function getRequestCount(): number {
  return mockControls.requests.length;
}

// Get pending requests (texts waiting for resolution)
export function getPendingRequests(): string[] {
  return Array.from(mockControls.pendingRequests.keys());
}

// Resolve a specific pending request
export function resolveRequest(text: string): boolean {
  const pending = mockControls.pendingRequests.get(text);
  if (!pending) return false;

  const mockResponse = mockControls.responses.get(text) || mockControls.defaultResponse;
  const response = createMockResponse(mockResponse?.result ?? { fixed: false, result: text });

  pending.resolve(response);
  mockControls.pendingRequests.delete(text);
  return true;
}

// Resolve all pending requests
export function resolveAll(): void {
  for (const [text] of mockControls.pendingRequests) {
    resolveRequest(text);
  }
}

// Create a mock response - returns JSON array of strings (matching actual API)
function createMockResponse(result: { fixed: boolean; result: string }): Response {
  // The actual API returns a JSON array of strings (one per line)
  const lines = result.result.split("\n");
  return new Response(JSON.stringify(lines), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// Create a mock error response
function createMockErrorResponse(errorMessage: string): Response {
  return new Response(JSON.stringify({ error: { message: errorMessage } }), {
    status: 400,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// Install the mock fetch
export function installMockFetch(): void {
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    // Intercept POST requests that look like grammar API calls
    if (init?.method === "POST" && init?.body) {
      try {
        const body = JSON.parse(init.body as string);

        // Check if this is the expected API format (has modelParams with input)
        if (body.modelParams && Array.isArray(body.modelParams.input)) {
          // Extract text from the actual API format:
          // { model: "...", modelParams: { input: ["line1", "line2", ...] } }
          const requestText = body.modelParams.input.join("\n");

          mockControls.requests.push({
            text: requestText,
            timestamp: Date.now(),
          });

          // Return error if set
          if (mockControls.errorMessage) {
            const error = mockControls.errorMessage;
            mockControls.errorMessage = null;
            return createMockErrorResponse(error);
          }

          // Add delay
          if (mockControls.responseDelay > 0) {
            await new Promise((r) => setTimeout(r, mockControls.responseDelay));
          }

          // If not auto-resolving, add to pending
          if (!mockControls.autoResolve) {
            return new Promise((resolve) => {
              mockControls.pendingRequests.set(requestText, { resolve, text: requestText });
            });
          }

          // Look up response
          const mockResponse = mockControls.responses.get(requestText) || mockControls.defaultResponse;

          if (mockResponse) {
            return createMockResponse(mockResponse.result);
          }

          // Default: return text unchanged (no fixes)
          return createMockResponse({ fixed: false, result: requestText });
        }
      } catch {
        // Not JSON or not our format, pass through
      }
    }

    // Pass through other requests
    return originalFetch(input, init);
  };
}

// Uninstall mock (restore original fetch)
export function uninstallMockFetch(): void {
  // In a real implementation, we'd store and restore the original
  // For tests, the page reloads between tests anyway
}
