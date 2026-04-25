import { logger } from "./logger";

interface MetricEntry {
  count: number;
  total: number;
  min: number;
  max: number;
  lastValue: number;
  lastUpdated: number;
}

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, MetricEntry> = new Map();
  private gauges: Map<string, number> = new Map();

  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  recordHistogram(name: string, value: number): void {
    const existing = this.histograms.get(name);
    if (existing) {
      existing.count++;
      existing.total += value;
      existing.min = Math.min(existing.min, value);
      existing.max = Math.max(existing.max, value);
      existing.lastValue = value;
      existing.lastUpdated = Date.now();
    } else {
      this.histograms.set(name, {
        count: 1,
        total: value,
        min: value,
        max: value,
        lastValue: value,
        lastUpdated: Date.now(),
      });
    }
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getSnapshot(): {
    counters: Record<string, number>;
    histograms: Record<string, MetricEntry & { avg: number }>;
    gauges: Record<string, number>;
    timestamp: string;
  } {
    const histograms: Record<string, MetricEntry & { avg: number }> = {};
    for (const [key, val] of this.histograms.entries()) {
      histograms[key] = {
        ...val,
        avg: val.count > 0 ? val.total / val.count : 0,
      };
    }

    const counters: Record<string, number> = {};
    for (const [key, val] of this.counters.entries()) {
      counters[key] = val;
    }

    const gauges: Record<string, number> = {};
    for (const [key, val] of this.gauges.entries()) {
      gauges[key] = val;
    }

    return { counters, histograms, gauges, timestamp: new Date().toISOString() };
  }

  // -------------------------------------------------------------------
  // Convenience methods for common application metrics
  // -------------------------------------------------------------------

  trackApiRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
  ): void {
    this.incrementCounter("api.requests.total");
    this.incrementCounter(`api.requests.${method.toLowerCase()}`);
    this.recordHistogram("api.latency_ms", durationMs);
    if (statusCode >= 400) {
      this.incrementCounter("api.errors.total");
      this.incrementCounter(`api.errors.${statusCode}`);
    }
  }

  trackAIRequest(
    provider: string,
    type: string,
    durationMs: number,
    tokens: number,
    cached: boolean = false,
  ): void {
    this.incrementCounter("ai.requests.total");
    this.incrementCounter(`ai.requests.${provider}`);
    this.incrementCounter(`ai.requests.type.${type}`);
    this.recordHistogram(`ai.latency_ms.${provider}`, durationMs);
    this.incrementCounter("ai.tokens.total", tokens);
    if (cached) this.incrementCounter("ai.cache.hits");
  }

  trackDBQuery(operation: string, durationMs: number): void {
    this.incrementCounter("db.queries.total");
    this.incrementCounter(`db.queries.${operation}`);
    this.recordHistogram("db.latency_ms", durationMs);
  }

  trackCallEvent(event: string): void {
    this.incrementCounter("calls.events.total");
    this.incrementCounter(`calls.events.${event}`);
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    logger.info("Metrics reset");
  }
}

export const metrics = new MetricsCollector();
