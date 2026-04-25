import { logger } from "./logger";
import { metrics } from "./metrics";
import { EventEmitter } from "events";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface JobOptions {
  priority?: number | undefined;
  maxRetries?: number | undefined;
  retryDelayMs?: number | undefined;
  timeoutMs?: number | undefined;
}

interface Job<T = unknown> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  priority: number;
  retries: number;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  result?: unknown;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

type JobHandler<T = unknown> = (data: T) => Promise<unknown>;

export class JobQueue extends EventEmitter {
  private queue: Job[] = [];
  private processing: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler> = new Map();
  private readonly concurrency: number;
  private isRunning: boolean = true;
  private jobCounter: number = 0;

  constructor(concurrency: number = 3) {
    super();
    this.concurrency = concurrency;
  }

  registerHandler<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
    logger.info("Job handler registered", { type });
  }

  async addJob<T>(type: string, data: T, options: JobOptions = {}): Promise<string> {
    const id = `job_${++this.jobCounter}_${Date.now()}`;
    const job: Job<T> = {
      id,
      type,
      data,
      status: "queued",
      priority: options.priority ?? 0,
      retries: 0,
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
      timeoutMs: options.timeoutMs ?? 30000,
      createdAt: Date.now(),
    };

    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);

    metrics.incrementCounter("jobs.queued");
    metrics.incrementCounter(`jobs.queued.${type}`);
    metrics.setGauge("jobs.queue_size", this.queue.length);

    logger.debug("Job queued", { jobId: id, type, priority: job.priority });
    this.emit("job:queued", { jobId: id, type });

    this.processNext();
    return id;
  }

  private processNext(): void {
    if (!this.isRunning) return;
    if (this.processing.size >= this.concurrency) return;
    if (this.queue.length === 0) return;

    const job = this.queue.shift();
    if (!job) return;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = "failed";
      job.error = `No handler registered for job type: ${job.type}`;
      logger.error("No job handler found", new Error(job.error), { jobId: job.id, type: job.type });
      this.emit("job:failed", { jobId: job.id, error: job.error });
      return;
    }

    job.status = "processing";
    const startedAt = Date.now();
    job.startedAt = startedAt;
    this.processing.set(job.id, job);

    metrics.setGauge("jobs.processing", this.processing.size);
    metrics.setGauge("jobs.queue_size", this.queue.length);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Job timeout")), job.timeoutMs);
    });

    Promise.race([handler(job.data), timeoutPromise])
      .then((result) => {
        const completedAt = Date.now();
        job.status = "completed";
        job.result = result;
        job.completedAt = completedAt;

        const duration = completedAt - startedAt;
        metrics.incrementCounter("jobs.completed");
        metrics.incrementCounter(`jobs.completed.${job.type}`);
        metrics.recordHistogram(`jobs.duration_ms.${job.type}`, duration);

        logger.debug("Job completed", { jobId: job.id, type: job.type, duration: `${duration}ms` });
        this.emit("job:completed", { jobId: job.id, result });
      })
      .catch((error: unknown) => {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (job.retries < job.maxRetries) {
          job.retries++;
          job.status = "queued";
          const delay = job.retryDelayMs * Math.pow(2, job.retries - 1);

          logger.warn("Job failed, scheduling retry", {
            jobId: job.id,
            type: job.type,
            retry: job.retries,
            maxRetries: job.maxRetries,
            delayMs: delay,
            error: errorMsg,
          });

          metrics.incrementCounter("jobs.retries");

          setTimeout(() => {
            this.queue.push(job);
            this.queue.sort((a, b) => b.priority - a.priority);
            metrics.setGauge("jobs.queue_size", this.queue.length);
            this.processNext();
          }, delay);
        } else {
          job.status = "failed";
          job.error = errorMsg;
          job.completedAt = Date.now();

          metrics.incrementCounter("jobs.failed");
          metrics.incrementCounter(`jobs.failed.${job.type}`);

          logger.error(
            "Job permanently failed",
            error instanceof Error ? error : new Error(errorMsg),
            { jobId: job.id, type: job.type, retries: job.retries },
          );
          this.emit("job:failed", { jobId: job.id, error: errorMsg });
        }
      })
      .finally(() => {
        this.processing.delete(job.id);
        metrics.setGauge("jobs.processing", this.processing.size);
        this.processNext();
      });
  }

  getStats(): {
    queueSize: number;
    processing: number;
    concurrency: number;
  } {
    return {
      queueSize: this.queue.length,
      processing: this.processing.size,
      concurrency: this.concurrency,
    };
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    logger.info("Job queue shutting down", {
      pendingJobs: this.queue.length,
      processingJobs: this.processing.size,
    });
    while (this.processing.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    logger.info("Job queue shutdown complete");
  }
}

// Singleton voice/AI processing queues
export const voiceJobQueue = new JobQueue(3);
export const aiJobQueue = new JobQueue(5);
