// src/controllers/ai.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/jwt-auth';
import * as AIService from '../services/ai.service';
import { aiService } from '../ai/ai.service';
import { AppError } from '../middleware/error-handler';
import { ErrorCode } from '../types';
import { logger } from '../utils/logger';
import { hasXSSPatterns, hasSQLInjectionPatterns } from '../utils/validators';

/**
 * Send message to AI and get response
 * POST /ai/chat
 */
export const chat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'User not authenticated'));
    }

    const { message } = req.body;

    // Validation
    if (!message || typeof message !== 'string') {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Message is required and must be a string'));
    }

    if (message.trim().length === 0) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Message cannot be empty'));
    }

    if (message.length > 10000) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Message is too long (max 10,000 characters)'));
    }

    // Security checks
    if (hasXSSPatterns(message)) {
      logger.warn('XSS pattern detected in chat message', { userId: req.user.id });
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid message content'));
    }

    if (hasSQLInjectionPatterns(message)) {
      logger.warn('SQL injection pattern detected in chat message', { userId: req.user.id });
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid message content'));
    }

    logger.info('Processing chat request', { userId: req.user.id, messageLength: message.length });

    const aiResponse = await AIService.sendMessage(Number(req.user.id), message);

    res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: 'AI response generated successfully',
      data: {
        response: aiResponse.message,
        tokensUsed: aiResponse.tokensUsed,
        model: aiResponse.model
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Chat endpoint error', error instanceof Error ? error : new Error(errorMessage));

    if (errorMessage.includes('timeout') || errorMessage.includes('rate limit')) {
      return next(new AppError(429, ErrorCode.SERVICE_UNAVAILABLE, errorMessage));
    }

    next(new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to process chat request'));
  }
};

/**
 * Get chat history for user
 * GET /ai/chat/history
 */
export const getHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'User not authenticated'));
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await AIService.getChatHistory(Number(req.user.id), limit, offset);

    res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: 'Chat history retrieved',
      data: {
        messages: history,
        limit,
        offset,
        count: history.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('History endpoint error', error instanceof Error ? error : new Error(String(error)));
    next(new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to retrieve chat history'));
  }
};

/**
 * Get user chat statistics
 * GET /ai/chat/stats
 */
export const getStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'User not authenticated'));
    }

    const stats = await AIService.getUserStats(Number(req.user.id));

    res.status(200).json({
      status: 'success',
      message: 'Chat statistics retrieved',
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Stats endpoint error', error instanceof Error ? error : new Error(String(error)));
    next(new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to retrieve statistics'));
  }
};

/**
 * Clear user chat history
 * DELETE /ai/chat/history
 */
export const clearHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'User not authenticated'));
    }

    const success = await AIService.clearChatHistory(Number(req.user.id));

    if (!success) {
      return next(new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to clear chat history'));
    }

    res.status(200).json({
      status: 'success',
      message: 'Chat history cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Clear history endpoint error', error instanceof Error ? error : new Error(String(error)));
    next(new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to clear chat history'));
  }
};

/**
 * Extract structured data from text
 * POST /ai/extract
 */
export const extractData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Text is required and must be a string'));
    }

    logger.info('Extracting structured data');

    const result = await aiService.extractStructuredData(text);

    if (result.success && result.data) {
      res.status(200).json({
        status: 'success',
        message: 'Data extracted successfully',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, result.error || 'Failed to extract data'));
    }
  } catch (error) {
    logger.error('Extract data endpoint error', error instanceof Error ? error : new Error(String(error)));
    next(new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to extract data'));
  }
};

/**
 * Understand intent from message
 * POST /ai/intent
 */
export const understandIntent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Message is required and must be a string'));
    }

    logger.info('Understanding intent');

    const result = await aiService.understandIntent(message);

    if (result.success && result.intent) {
      res.status(200).json({
        status: 'success',
        message: 'Intent understood',
        data: { intent: result.intent },
        timestamp: new Date().toISOString()
      });
    } else {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, result.error || 'Failed to understand intent'));
    }
  } catch (error) {
    logger.error('Intent endpoint error', error instanceof Error ? error : new Error(String(error)));
    next(new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to understand intent'));
  }
};
