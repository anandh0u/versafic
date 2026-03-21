/**
 * Customer Service Routes
 * API endpoints for voice and text-based customer service
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getCustomerServiceManager } from '../utils/customer-service';
import {
  createInteraction,
  getSessionInteractions,
  getInteractionsByPhone,
  getResolvedInteractions,
  getSentimentStats,
  getResolutionRate
} from '../models/customer-interactions';
import { sendSuccess, sendError } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();
const manager = getCustomerServiceManager();

/**
 * POST /customer-service/start
 * Start a new customer service session
 */
router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = manager.createSession();

    sendSuccess(res, { sessionId, message: 'Customer service session started' }, 'Session created', 201);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /customer-service/chat
 * Process customer message (voice or text)
 */
router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { audioBase64, textMessage, languageCode, sessionId } = req.body;

    if (!audioBase64 && !textMessage) {
      return sendError(res, 'Either audioBase64 or textMessage is required', 400);
    }

    const response = await manager.processCustomerRequest({
      audioBase64,
      textMessage,
      languageCode,
      sessionId
    });

    if (!response.success) {
      return sendError(res, response.error || 'Failed to process request', 500);
    }

    // Save interaction to database
    try {
      await createInteraction(
        response.sessionId,
        response.customerMessage,
        response.aiResponse,
        response.sentiment,
        response.isResolved,
        response.extractedData
      );
    } catch (dbError) {
      logger.error('Failed to save interaction to database', dbError instanceof Error ? dbError : new Error(String(dbError)));
      // Continue anyway - don't fail the request
    }

    sendSuccess(
      res,
      {
        sessionId: response.sessionId,
        customerMessage: response.customerMessage,
        aiResponse: response.aiResponse,
        audioResponse: response.audioResponse,
        extractedData: response.extractedData,
        sentiment: response.sentiment,
        isResolved: response.isResolved
      },
      'Message processed successfully',
      200
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /customer-service/history/:sessionId
 * Get conversation history for a session
 */
router.get('/history/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params as { sessionId: string };

    const history = manager.getSessionHistory(sessionId);
    const data = manager.getSessionData(sessionId);

    sendSuccess(
      res,
      {
        sessionId,
        conversationHistory: history,
        extractedData: data
      },
      'History retrieved',
      200
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return sendError(res, 'Session not found', 404);
    }
    next(error);
  }
});

/**
 * GET /customer-service/session/:sessionId
 * Get session data
 */
router.get('/session/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params as { sessionId: string };

    const data = manager.getSessionData(sessionId);

    sendSuccess(
      res,
      {
        sessionId,
        customerData: data
      },
      'Session data retrieved',
      200
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return sendError(res, 'Session not found', 404);
    }
    next(error);
  }
});

/**
 * POST /customer-service/end/:sessionId
 * End customer service session
 */
router.post('/end/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params as { sessionId: string };

    manager.endSession(sessionId);

    sendSuccess(
      res,
      { message: 'Session ended successfully', sessionId },
      'Session ended',
      200
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /customer-service/interactions/phone/:phone
 * Get customer interactions by phone number
 */
router.get('/interactions/phone/:phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.params as { phone: string };

    const interactions = await getInteractionsByPhone(phone);

    sendSuccess(
      res,
      {
        phone,
        count: interactions.length,
        interactions
      },
      'Interactions retrieved',
      200
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /customer-service/interactions/resolved
 * Get all resolved interactions
 */
router.get('/interactions/resolved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = '100' } = req.query as { limit?: string };

    const interactions = await getResolvedInteractions(parseInt(limit, 10));

    sendSuccess(
      res,
      {
        count: interactions.length,
        interactions
      },
      'Resolved interactions retrieved',
      200
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /customer-service/stats/sentiment
 * Get sentiment statistics
 */
router.get('/stats/sentiment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getSentimentStats();

    sendSuccess(
      res,
      { sentiment: stats },
      'Sentiment stats retrieved',
      200
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /customer-service/stats/resolution
 * Get resolution rate
 */
router.get('/stats/resolution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getResolutionRate();

    sendSuccess(
      res,
      { resolution: stats },
      'Resolution stats retrieved',
      200
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /customer-service/active-sessions
 * Get all active sessions (admin only)
 */
router.get('/active-sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = manager.getActiveSessions();

    sendSuccess(
      res,
      {
        count: sessions.length,
        sessionIds: sessions
      },
      'Active sessions retrieved',
      200
    );
  } catch (error) {
    next(error);
  }
});

export default router;
