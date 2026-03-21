import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { metrics } from "../utils/metrics";
import { aiResponseCache } from "../ai/response-cache";
import { voiceJobQueue, aiJobQueue } from "../utils/job-queue";
import { logger } from "../utils/logger";

const router = Router();

router.get("/health", async (_req: Request, res: Response) => {
  const startTime = Date.now();

  let dbHealthy = false;
  try {
    await pool.query("SELECT 1");
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  const status = dbHealthy ? "healthy" : "degraded";
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime)}s`,
    database: dbHealthy ? "connected" : "disconnected",
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    },
    responseTime: `${Date.now() - startTime}ms`,
  });
});

router.get("/metrics", (_req: Request, res: Response) => {
  res.json(metrics.getSnapshot());
});

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const dbPool = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };

    res.json({
      timestamp: new Date().toISOString(),
      database: {
        pool: dbPool,
      },
      cache: {
        ai: aiResponseCache.getStats(),
      },
      queues: {
        voice: voiceJobQueue.getStats(),
        ai: aiJobQueue.getStats(),
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        uptime: `${Math.floor(process.uptime())}s`,
      },
    });
  } catch (error) {
    logger.error(
      "Failed to get system status",
      error instanceof Error ? error : new Error(String(error)),
    );
    res.status(500).json({ error: "Failed to retrieve status" });
  }
});

export default router;
