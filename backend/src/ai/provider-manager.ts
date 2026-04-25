import { logger } from "../utils/logger";
import { metrics } from "../utils/metrics";

export interface AIProviderConfig {
  name: string;
  priority: number;
  maxConsecutiveFailures: number;
  cooldownMs: number;
}

export interface AIProviderHealth {
  name: string;
  isHealthy: boolean;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  totalRequests: number;
  totalFailures: number;
}

export interface AIProviderResult {
  text: string;
  provider: string;
  model?: string | undefined;
  tokensUsed?: number | undefined;
  latencyMs: number;
  cached?: boolean | undefined;
}

type AIProviderFunction = (
  input: string,
  context?: Record<string, unknown>,
) => Promise<{
  text: string;
  model?: string | undefined;
  tokensUsed?: number | undefined;
}>;

interface ProviderEntry {
  config: AIProviderConfig;
  handler: AIProviderFunction;
  health: AIProviderHealth;
}

export class AIProviderManager {
  private providers: Map<string, ProviderEntry> = new Map();

  registerProvider(
    config: AIProviderConfig,
    handler: AIProviderFunction,
  ): void {
    this.providers.set(config.name, {
      config,
      handler,
      health: {
        name: config.name,
        isHealthy: true,
        consecutiveFailures: 0,
        lastFailureTime: null,
        totalRequests: 0,
        totalFailures: 0,
      },
    });
    logger.info("AI provider registered", {
      provider: config.name,
      priority: config.priority,
    });
  }

  private getAvailableProviders(): ProviderEntry[] {
    const now = Date.now();
    const available: ProviderEntry[] = [];

    for (const entry of this.providers.values()) {
      if (entry.health.isHealthy) {
        available.push(entry);
      } else if (
        entry.health.lastFailureTime !== null &&
        now - entry.health.lastFailureTime > entry.config.cooldownMs
      ) {
        // Cooldown period passed, allow retry
        entry.health.isHealthy = true;
        entry.health.consecutiveFailures = 0;
        logger.info("AI provider recovered from cooldown", {
          provider: entry.config.name,
        });
        available.push(entry);
      }
    }

    return available.sort((a, b) => a.config.priority - b.config.priority);
  }

  async execute(
    operationType: string,
    input: string,
    context?: Record<string, unknown>,
  ): Promise<AIProviderResult> {
    const available = this.getAvailableProviders();

    if (available.length === 0) {
      throw new Error(
        "No AI providers available - all providers are in cooldown",
      );
    }

    let lastError: Error | null = null;

    for (const entry of available) {
      const startTime = Date.now();
      entry.health.totalRequests++;

      try {
        const result = await entry.handler(input, context);
        const latencyMs = Date.now() - startTime;

        // Reset failure count on success
        entry.health.consecutiveFailures = 0;
        entry.health.isHealthy = true;

        metrics.trackAIRequest(
          entry.config.name,
          operationType,
          latencyMs,
          result.tokensUsed ?? 0,
        );

        return {
          text: result.text,
          provider: entry.config.name,
          model: result.model,
          tokensUsed: result.tokensUsed,
          latencyMs,
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        lastError =
          error instanceof Error ? error : new Error(String(error));

        entry.health.consecutiveFailures++;
        entry.health.totalFailures++;
        entry.health.lastFailureTime = Date.now();

        if (
          entry.health.consecutiveFailures >=
          entry.config.maxConsecutiveFailures
        ) {
          entry.health.isHealthy = false;
          logger.warn("AI provider circuit breaker tripped", {
            provider: entry.config.name,
            failures: entry.health.consecutiveFailures,
            cooldownMs: entry.config.cooldownMs,
          });
        }

        metrics.incrementCounter(
          `ai.provider.${entry.config.name}.failures`,
        );
        logger.warn("AI provider failed, trying next", {
          provider: entry.config.name,
          error: lastError.message,
          latencyMs,
        });
      }
    }

    throw new Error(
      `All AI providers failed. Last error: ${lastError?.message}`,
    );
  }

  getHealthStatus(): AIProviderHealth[] {
    return Array.from(this.providers.values()).map((e) => ({ ...e.health }));
  }

  resetProvider(name: string): void {
    const entry = this.providers.get(name);
    if (entry) {
      entry.health.isHealthy = true;
      entry.health.consecutiveFailures = 0;
      entry.health.lastFailureTime = null;
      logger.info("AI provider manually reset", { provider: name });
    }
  }
}

export const providerManager = new AIProviderManager();
