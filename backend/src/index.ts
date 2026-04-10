import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import type { Server } from "http";
import type { Socket } from "net";

// Import configuration and utilities
import { validateEnv } from "./utils/env";
import { logger } from "./utils/logger";
import { pool, initializeDatabase, shutdownDatabase, validateTwilioWebhookConfig } from "./config/database";
import { errorHandler } from "./middleware/error-handler";
// Import security middleware
import { generalLimiter, validateRequestSize, rateLimitAI } from "./middleware/rate-limit";
// Import request context middleware
import { requestContextMiddleware } from "./middleware/request-context";
// Import metrics
import { metrics } from "./utils/metrics";

// Import routes
import authRoutes from "./routes/auth.routes";
import setupRoutes from "./routes/setup.routes";
import aiRoutes from "./routes/ai.routes";
import customerServiceRoutes from "./routes/customer-service.routes";
import voiceRoutes from "./routes/voice.routes";
import businessRoutes from "./routes/business.routes";
import callRoutes from "./modules/call/call.routes";
import observabilityRoutes from "./routes/observability.routes";
import billingRoutes from "./routes/billing.routes";

// Validate environment variables
try {
  validateEnv();
  validateTwilioWebhookConfig();
} catch (error) {
  process.exit(1);
}

export const app = express();
const PORT = process.env.PORT || 5000;
let initializationPromise: Promise<void> | null = null;

// Middleware - Security headers
app.use(helmet({
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: "deny"
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// Enforce HTTPS in production
if (process.env.NODE_ENV === "production") {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/health" || req.path.startsWith("/ops/")) {
      return next();
    }

    const forwardedProto = req.get("x-forwarded-proto");
    if (!req.secure && forwardedProto !== "https") {
      return res.redirect(`https://${req.get("host")}${req.url}`);
    }
    next();
  });
}

// Middleware - CORS
const allowedOrigins = (
  process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173"
).split(",").map((o) => o.trim());

const isAllowedDevOrigin = (origin: string): boolean => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const isAllowedHostedOrigin = (origin: string): boolean => {
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "https:" && (hostname.endsWith(".vercel.app") || hostname.endsWith(".onrender.com"));
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin) || isAllowedDevOrigin(origin) || isAllowedHostedOrigin(origin)) {
        return callback(null, true);
      }

      logger.warn("Rejected CORS origin", { origin });
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
    maxAge: 86400
  })
);

// Middleware - Body parser and security
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(validateRequestSize);

// Request context middleware (generates requestId, tracks timing)
app.use(requestContextMiddleware);

// Rate limiting middleware
app.use(generalLimiter);

// Metrics tracking middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    metrics.trackApiRequest(req.method, req.path, res.statusCode, duration);
  });
  next();
});

// Observability endpoints (health, metrics, status) - no auth required
app.use("/ops", observabilityRoutes);

// Legacy health endpoint (backward compatible)
app.get("/health", async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    client.release();

    res.status(200).json({
      status: "success",
      message: "System is healthy",
      database: "connected",
      timestamp: result.rows[0].now
    });
  } catch (error) {
    logger.error("Health check failed", error instanceof Error ? error : new Error(String(error)));

    res.status(503).json({
      status: "error",
      message: "Database is not responding",
      database: "disconnected",
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use("/auth", authRoutes);
app.use("/setup", setupRoutes);
app.use("/ai", rateLimitAI, aiRoutes);
app.use("/customer-service", generalLimiter, customerServiceRoutes);
app.use("/voice", generalLimiter, voiceRoutes);
app.use("/business", generalLimiter, businessRoutes);
app.use("/call", generalLimiter, callRoutes);
app.use("/billing", generalLimiter, billingRoutes);

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    status: "success",
    message: "Versafic Backend API",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    statusCode: 404,
    message: "Route not found",
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export const initializeApp = async (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await initializeDatabase();
      logger.info("Database initialized successfully");

      const shouldBootstrapRuntimeTables =
        process.env.RUN_RUNTIME_TABLE_BOOTSTRAP === "true" || process.env.NODE_ENV !== "production";

      if (shouldBootstrapRuntimeTables) {
        try {
          const { conversationService } = await import("./services/conversation.service");
          await conversationService.initializeTable();
        } catch (convError) {
          logger.warn("Conversation table init failed (non-critical)", {
            error: convError instanceof Error ? convError.message : String(convError)
          });
        }
      } else {
        logger.info("Skipping runtime table bootstrap in production");
      }

      try {
        const { getTwilioService } = await import("./services/twilioService");
        const syncResult = await getTwilioService().syncIncomingVoiceWebhookIfEnabled();
        logger.info("Twilio incoming webhook sync checked", syncResult);
      } catch (twilioError) {
        logger.warn("Twilio webhook sync skipped", {
          error: twilioError instanceof Error ? twilioError.message : String(twilioError)
        });
      }
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
};

const attachGracefulShutdown = (server: Server) => {
  const activeConnections = new Set<Socket>();
  let isShuttingDown = false;

  server.on("connection", (socket: Socket) => {
    activeConnections.add(socket);
    socket.on("close", () => {
      activeConnections.delete(socket);
    });
  });

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info(`Received ${signal} signal, starting graceful shutdown...`);

    const forceShutdownTimer = setTimeout(() => {
      logger.error("Force shutdown after 30s timeout");
      for (const socket of activeConnections) {
        socket.destroy();
      }
      process.exit(1);
    }, 30000);
    forceShutdownTimer.unref();

    const destroyLingeringConnectionsTimer = setTimeout(() => {
      logger.warn("Force closing lingering HTTP connections");
      server.closeAllConnections?.();
      for (const socket of activeConnections) {
        socket.destroy();
      }
    }, 10000);
    destroyLingeringConnectionsTimer.unref();

    server.close(async (serverError) => {
      logger.info("HTTP server closed");
      clearTimeout(forceShutdownTimer);
      clearTimeout(destroyLingeringConnectionsTimer);

      try {
        const { voiceJobQueue, aiJobQueue } = await import("./utils/job-queue");
        await Promise.all([voiceJobQueue.shutdown(), aiJobQueue.shutdown()]);
        logger.info("Job queues shutdown completed");
      } catch (error) {
        logger.error("Error during job queue shutdown", error instanceof Error ? error : new Error(String(error)));
      }

      try {
        await shutdownDatabase();
        logger.info("Database shutdown completed");
      } catch (error) {
        logger.error("Error during database shutdown", error instanceof Error ? error : new Error(String(error)));
      }

      logger.info("Graceful shutdown completed");
      process.exit(serverError ? 1 : 0);
    });

    server.closeIdleConnections?.();
    for (const socket of activeConnections) {
      socket.end();
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

// Initialize server
export const startServer = async () => {
  try {
    await initializeApp();

    const server = app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`📍 Health: http://localhost:${PORT}/health`);
      logger.info(`📊 Metrics: http://localhost:${PORT}/ops/metrics`);
      logger.info(`📋 Status: http://localhost:${PORT}/ops/status`);
      logger.info(`🔐 Auth: http://localhost:${PORT}/auth`);
      logger.info(`🤖 AI: http://localhost:${PORT}/ai`);
      logger.info(`🎤 Voice: http://localhost:${PORT}/voice`);
      logger.info(`🏢 Business: http://localhost:${PORT}/business`);
    });

    attachGracefulShutdown(server);
  } catch (error) {
    logger.error("Failed to start server", error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
};

// Process-level error handlers
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any) => {
  const rejectionError = reason instanceof Error ? reason : new Error(String(reason));
  logger.error("Unhandled Rejection", rejectionError);
  process.exit(1);
});

process.on("warning", (warning: any) => {
  logger.warn("Process warning", {
    name: warning.name,
    message: warning.message
  });
});

export default app;

// Start the server only when running as the main process
if (require.main === module) {
  void startServer();
}
