// src/middleware/rate-limit.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { ErrorCode } from '../types';

/**
 * Get user identifier for rate limiting
 * Uses user ID from JWT if available, otherwise IP address
 */
const getUserIdentifier = (req: any): string => {
  if (req.userId) {
    return `user-${req.userId}`;
  }
  return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
};

/**
 * General API limiter: 100 requests per 15 minutes per IP/user
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  keyGenerator: (req: any) => getUserIdentifier(req),
  handler: (req: any, res: Response) => {
    logger.warn('General rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: req.userId
    });

    res.status(429).json({
      status: 'error',
      statusCode: 429,
      errorCode: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests. Please try again later.',
      retryAfter: req.rateLimit?.resetTime,
      timestamp: new Date().toISOString()
    });
  },
  skip: (req: any) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/ops/health';
  }
});

/**
 * AI endpoint limiter: 10 requests per minute per user
 * This prevents credit exhaustion attacks
 */
export const rateLimitAI = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each user to 10 requests per minute
  keyGenerator: (req: any) => {
    if (!req.userId) {
      return req.ip || 'unknown';
    }
    return `ai-user-${req.userId}`;
  },
  handler: (req: any, res: Response) => {
    const userId = req.userId;
    logger.warn('AI rate limit exceeded', {
      userId,
      path: req.path,
      ip: req.ip
    });

    res.status(429).json({
      status: 'error',
      statusCode: 429,
      errorCode: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Too many AI requests. You can make up to 10 requests per minute. Please wait before trying again.',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth endpoint limiter: 5 attempts per 5 minutes per email
 * Prevents brute force attacks on login/register
 */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit per IP to 5 requests per windowMs
  keyGenerator: (req: any) => {
    // Try to extract email from body, otherwise use IP
    const email = (req.body?.email || req.body?.email_address || '').toLowerCase().trim();
    if (email) {
      return `auth-${email}`;
    }
    return `auth-${req.ip}`;
  },
  handler: (req: any, res: Response) => {
    const email = (req.body?.email || req.body?.email_address || 'unknown').toString();
    logger.warn('Auth rate limit exceeded', {
      email,
      path: req.path,
      ip: req.ip,
      attempt: req.rateLimit?.current || 0
    });

    res.status(429).json({
      status: 'error',
      statusCode: 429,
      errorCode: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Too many login attempts. Please wait 5 minutes before trying again.',
      retryAfter: 300,
      timestamp: new Date().toISOString()
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
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
