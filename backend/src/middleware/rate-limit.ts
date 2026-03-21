// src/middleware/rate-limit.ts
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ErrorCode } from '../types';

interface RateLimitRequest extends Request {
  rateLimit?: {
    resetTime?: Date;
  };
}

// Higher limits in development for testing
const isDev = process.env.NODE_ENV !== 'production';

/**
 * General API rate limiter
 * Production: 100 requests per 15 minutes per IP
 * Development: 1000 requests per 15 minutes
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 100,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return ipKeyGenerator(ip);
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    const resetTime = (req as RateLimitRequest).rateLimit?.resetTime || new Date(Date.now() + 15 * 60 * 1000);
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      errorCode: ErrorCode.SERVICE_UNAVAILABLE,
      message: 'Too many requests, please try again later',
      retryAfter: resetTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * AI Chat rate limiter
 * Production: 30 requests per hour per user
 * Development: 500 requests per hour
 */
const rateLimitAIInstance = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IPv6-safe IP
    if ((req as any).user?.id) {
      return `user-${(req as any).user.id}`;
    }
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return ipKeyGenerator(ip);
  },
  handler: (req: Request, res: Response) => {
    logger.warn('AI rate limit exceeded', {
      userId: (req as any).user?.id,
      ip: req.ip
    });

    const resetTime = (req as RateLimitRequest).rateLimit?.resetTime || new Date(Date.now() + 60 * 60 * 1000);
    return res.status(429).json({
      status: 'error',
      statusCode: 429,
      errorCode: ErrorCode.SERVICE_UNAVAILABLE,
      message: 'You have exceeded the AI chat limit. Maximum 30 messages per hour.',
      retryAfter: resetTime,
      timestamp: new Date().toISOString()
    });
  }
});

export const rateLimitAI = rateLimitAIInstance;

/**
 * Auth endpoint rate limiter
 * Production: 5 attempts per 15 minutes
 * Development: 100 attempts per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Rate limit by email if provided, otherwise by IPv6-safe IP
    if (req.body?.email) {
      return req.body.email.toLowerCase();
    }
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return ipKeyGenerator(ip);
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      email: req.body?.email,
      ip: req.ip
    });

    res.status(429).json({
      status: 'error',
      statusCode: 429,
      errorCode: ErrorCode.SERVICE_UNAVAILABLE,
      message: 'Too many login attempts. Please try again in 15 minutes.',
      timestamp: new Date().toISOString()
    });
  }
});

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
