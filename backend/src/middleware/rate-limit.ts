// src/middleware/rate-limit.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../utils/logger';
import { ErrorCode } from '../types';

/**
 * All request throttling is intentionally disabled for the live demo flow.
 * We keep these middleware exports so existing route wiring stays compatible.
 */
export const generalLimiter: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};

export const rateLimitAI: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};

/**
 * Auth endpoint limiter intentionally disabled for the live demo flow.
 * We keep the exported middleware so existing route wiring stays compatible.
 */
export const authLimiter: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};

/**
 * Request size limiter
 * Prevents large payload attacks
 */
export const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
  const maxSize = 1024 * 100; // 100KB max

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (contentLength > maxSize) {
    logger.warn('Request size exceeded', {
      contentLength,
      maxSize,
      path: req.path
    });

    return res.status(413).json({
      status: 'error',
      statusCode: 413,
      errorCode: ErrorCode.VALIDATION_ERROR,
      message: 'Request payload too large',
      timestamp: new Date().toISOString()
    });
  }

  next();
};
