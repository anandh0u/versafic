// src/routes/ai.routes.ts
import { Router } from 'express';
import { verifyToken } from '../middleware/jwt-auth';
import * as AIController from '../controllers/ai.controller';
import { rateLimitAI } from '../middleware/rate-limit';

const router = Router();

/**
 * POST /ai/chat
 * Send message to AI and get response
 * Requires: JWT authentication, rate limiting
 */
router.post('/chat', verifyToken, rateLimitAI, AIController.chat);

/**
 * GET /ai/chat/history
 * Get chat history for authenticated user
 * Query params: limit (default 20, max 100), offset (default 0)
 */
router.get('/chat/history', verifyToken, AIController.getHistory);

/**
 * GET /ai/chat/stats
 * Get chat statistics for authenticated user
 */
router.get('/chat/stats', verifyToken, AIController.getStats);

/**
 * DELETE /ai/chat/history
 * Clear all chat history for authenticated user
 */
router.delete('/chat/history', verifyToken, AIController.clearHistory);

/**
 * POST /ai/extract
 * Extract structured data from text
 * Requires: JWT authentication
 */
router.post('/extract', verifyToken, AIController.extractData);

/**
 * POST /ai/intent
 * Understand intent from customer message
 * Requires: JWT authentication
 */
router.post('/intent', verifyToken, AIController.understandIntent);

/**
 * POST /ai/customer-service-response
 * Generate professional customer service response
 * Requires: JWT authentication, rate limiting
 */
router.post('/customer-service-response', verifyToken, rateLimitAI, async (req, res, next) => {
  try {
    await AIController.chat(req, res, next);
  } catch (error) {
    next(error);
  }
});

export default router;
