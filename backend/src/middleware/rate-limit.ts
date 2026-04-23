// src/middleware/rate-limit.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../utils/logger';
import { ErrorCode } from '../types';

const passthroughLimiter: RequestHandler = (_req, _res, next) => next();

/**
 * Runtime rate limits are intentionally disabled.
 * Earlier product decisions removed request throttling because it was blocking
 * normal auth, config checks, and dashboard activity in production.
 */
export const generalLimiter: RequestHandler = passthroughLimiter;
export const rateLimitAI: RequestHandler = passthroughLimiter;
export const authLimiter: RequestHandler = passthroughLimiter;

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
