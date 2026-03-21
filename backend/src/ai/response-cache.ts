import { logger } from "../utils/logger";
import { metrics } from "../utils/metrics";
import { createHash } from "crypto";

interface CachedResponse {
  text: string;
  provider: string;
  model?: string | undefined;
  tokensUsed?: number | undefined;
  cachedAt: number;
}

export class AIResponseCache {
  private cache: Map<string, CachedResponse> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 500, ttlMinutes: number = 30) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  private generateKey(
    type: string,
    input: string,
    context?: Record<string, unknown>,
  ): string {
    const raw = JSON.stringify({
      type,
      input: input.trim().toLowerCase(),
      context: context ?? {},
    });
    return createHash("sha256").update(raw).digest("hex");
  }

  get(
    type: string,
    input: string,
    context?: Record<string, unknown>,
  ): CachedResponse | null {
    const key = this.generateKey(type, input, context);
    const entry = this.cache.get(key);

    if (!entry) {
      metrics.incrementCounter("ai.cache.misses");
      return null;
    }

    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(key);
      metrics.incrementCounter("ai.cache.expired");
      return null;
    }

    metrics.incrementCounter("ai.cache.hits");
    logger.debug("AI cache hit", { type, keyPrefix: key.substring(0, 8) });
    return entry;
  }

  set(
    type: string,
    input: string,
    response: Omit<CachedResponse, "cachedAt">,
    context?: Record<string, unknown>,
  ): void {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        metrics.incrementCounter("ai.cache.evictions");
      }
    }

    const key = this.generateKey(type, input, context);
    this.cache.set(key, { ...response, cachedAt: Date.now() });
  }

  invalidate(
    type: string,
    input: string,
    context?: Record<string, unknown>,
  ): void {
    const key = this.generateKey(type, input, context);
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    logger.info("AI response cache cleared");
  }

  getStats(): { size: number; maxSize: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMinutes: this.ttlMs / 60000,
    };
  }
}

export const aiResponseCache = new AIResponseCache();
