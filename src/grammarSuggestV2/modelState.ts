export interface ModelStateManager {
  getCurrentModel(): string | undefined;
  handleSuccess(): void;
  handleFailure(): void;
}

export interface ModelStateConfig {
  primaryModel?: string;
  fallbackModel?: string;
  failureThreshold: number;
}

export function createModelStateManager(
  config: ModelStateConfig,
): ModelStateManager {
  const { primaryModel, fallbackModel, failureThreshold } = config;
  let consecutiveFailures = 0;

  return {
    getCurrentModel(): string | undefined {
      if (
        fallbackModel &&
        failureThreshold > 0 &&
        consecutiveFailures >= failureThreshold
      ) {
        return fallbackModel;
      }
      return primaryModel;
    },

    handleSuccess(): void {
      // Reset failure count on success with primary model
      consecutiveFailures = 0;
    },

    handleFailure(): void {
      // Only increment if fallback is configured
      if (fallbackModel) {
        consecutiveFailures++;
      }
    },
  };
}
