import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { DatabaseError } from "../utils/db-query";
import { ErrorCode } from "../types";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers["x-request-id"] || Math.random().toString(36).substring(7);

  // Handle AppError
  if (err instanceof AppError) {
    logger.warn("Application error", {
      requestId,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      message: err.message,
      path: req.path
    });

    res.status(err.statusCode).json({
      status: "error",
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      message: err.message,
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle DatabaseError
  if (err instanceof DatabaseError) {
    logger.error("Database error", err, {
      requestId,
      code: err.code,
      path: req.path
    });

    res.status(err.statusCode).json({
      status: "error",
      statusCode: err.statusCode,
      errorCode: err.code,
      message: err.message,
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && "body" in err) {
    logger.warn("JSON parsing error", { requestId, path: req.path });
    res.status(400).json({
      status: "error",
      statusCode: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
      message: "Invalid JSON in request body",
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle unexpected errors
  logger.error("Unhandled error", err, {
    requestId,
    path: req.path,
    method: req.method,
    stack: (err as any).stack
  });

  res.status(500).json({
    status: "error",
    statusCode: 500,
    errorCode: ErrorCode.INTERNAL_ERROR,
    message: "Internal server error",
    requestId,
    timestamp: new Date().toISOString()
  });
};

