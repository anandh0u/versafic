import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { randomUUID } from "crypto";

export interface RequestContext {
  requestId: string;
  startTime: number;
  userId?: number;
  path: string;
  method: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) || randomUUID();
  const startTime = Date.now();

  const context: RequestContext = {
    requestId,
    startTime,
    path: req.path,
    method: req.method,
  };

  req.context = context;
  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    logger.info("Request completed", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.context?.userId,
    });
  });

  next();
}
