// Mock API for CompleteV2 E2E tests
// Intercepts fetch calls to provide controlled responses

export interface MockRequest {
  task: string;
  params?: object;
  text: string;
  timestamp: number;
}

export interface MockApiControls {
  // Queue of chunks to send when streaming
  responseChunks: string[];
  // Error to send (if set)
  errorMessage: string | null;
  // Request tracking
  requests: MockRequest[];
  // Pending stream resolve function
  pendingResolve: ((value?: unknown) => void) | null;
  // Whether to auto-resolve streams
  autoResolve: boolean;
  // Delay between chunks (ms)
  chunkDelay: number;
}

// Global mock controls
export const mockControls: MockApiControls = {
  responseChunks: [],
  errorMessage: null,
  requests: [],
  pendingResolve: null,
  autoResolve: true,
  chunkDelay: 10,
};

// Reset mock state
export function resetMock(): void {
  mockControls.responseChunks = [];
  mockControls.errorMessage = null;
  mockControls.requests = [];
  mockControls.pendingResolve = null;
  mockControls.autoResolve = true;
  mockControls.chunkDelay = 10;
}

// Set response chunks to be streamed
export function setResponseChunks(chunks: string[]): void {
  mockControls.responseChunks = [...chunks];
}

// Set an error to be returned
export function setError(error: string | null): void {
  mockControls.errorMessage = error;
}

// Get all requests made
export function getRequests(): MockRequest[] {
  return mockControls.requests;
}

// Get the last request made
export function getLastRequest(): MockRequest | undefined {
  return mockControls.requests[mockControls.requests.length - 1];
}

// Get request count
export function getRequestCount(): number {
  return mockControls.requests.length;
}

// Resolve a pending stream (for manual control)
export function resolveStream(): void {
  if (mockControls.pendingResolve) {
    mockControls.pendingResolve();
    mockControls.pendingResolve = null;
  }
}

// Create a mock streaming response - streams raw text chunks
function createMockStreamResponse(chunks: string[]): Response {
  let chunkIndex = 0;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      if (chunkIndex < chunks.length) {
        // Stream raw text chunks (matching the actual API format)
        const chunk = chunks[chunkIndex];
        controller.enqueue(encoder.encode(chunk));
        chunkIndex++;

        // Add delay between chunks
        if (mockControls.chunkDelay > 0) {
          await new Promise((r) => setTimeout(r, mockControls.chunkDelay));
        }
      } else {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
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

    // Intercept POST requests that look like API calls
    if (init?.method === "POST" && init?.body) {
      try {
        const body = JSON.parse(init.body as string);

        // Check if this is the expected API format (has modelParams)
        if (body.modelParams) {
          // Extract task info from the actual API format:
          // { model: "...", modelParams: { input: ["text"], task: "Complete", params: {} } }
          const modelParams = body.modelParams;
          const task = modelParams.task ?? "unknown";
          const params = modelParams.params;
          const text = Array.isArray(modelParams.input) ? modelParams.input[0] : "";

          mockControls.requests.push({
            task,
            params,
            text,
            timestamp: Date.now(),
          });

          // Return error if set
          if (mockControls.errorMessage) {
            const error = mockControls.errorMessage;
            mockControls.errorMessage = null;
            return createMockErrorResponse(error);
          }

          // Return streaming response with queued chunks
          const chunks = mockControls.responseChunks;
          mockControls.responseChunks = [];

          if (chunks.length === 0) {
            // Default response if no chunks queued
            return createMockStreamResponse(["This is a ", "mock response ", "for testing."]);
          }

          // If not auto-resolving, wait for manual resolve
          if (!mockControls.autoResolve) {
            await new Promise((resolve) => {
              mockControls.pendingResolve = resolve;
            });
          }

          return createMockStreamResponse(chunks);
        }
      } catch {
        // Not JSON or not our format, pass through
      }
    }

    // Pass through other requests
    return originalFetch(input, init);
  };
}

// Uninstall mock (restore original fetch) - not typically needed in tests
export function uninstallMockFetch(): void {
  // In a real implementation, we'd store and restore the original
  // For tests, the page reloads between tests anyway
}
