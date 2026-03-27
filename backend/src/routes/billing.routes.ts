/**
 * Billing Routes
 * API endpoints for billing, payments, and wallet management
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/jwt-auth';
import {
  getPlans,
  createOrder,
  verifyPayment,
  getWallet,
  deductCredits,
  checkBalance,
  getAutopayStatus,
  enableAutopay,
  disableAutopay,
  triggerAutopay
} from '../controllers/billing.controller';

const router = Router();

// Public route - get available plans
router.get('/plans', getPlans);

// Protected routes - require authentication
router.post('/create-order', verifyToken, createOrder);
router.post('/verify-payment', verifyToken, verifyPayment);
router.get('/wallet', verifyToken, getWallet);
router.post('/deduct', verifyToken, deductCredits);
router.get('/check-balance', verifyToken, checkBalance);
router.get('/autopay/status', verifyToken, getAutopayStatus);
router.post('/autopay/enable', verifyToken, enableAutopay);
router.post('/autopay/disable', verifyToken, disableAutopay);
router.post('/autopay/trigger', verifyToken, triggerAutopay);

export default router;
