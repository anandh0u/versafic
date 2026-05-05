import express from 'express';
import * as msg91Controller from '../controllers/msg91.controller';
import { verifyToken } from '../middleware/jwt-auth';

const router = express.Router();

/**
 * GET /sms/status
 * Check if MSG91 SMS service is configured and ready
 */
router.get('/status', msg91Controller.checkStatus);

/**
 * GET /sms/config
 * Frontend-facing MSG91 configuration summary
 */
router.get('/config', msg91Controller.getConfig);

/**
 * POST /sms/delivery-report
 * MSG91 delivery status webhook
 */
router.post('/delivery-report', msg91Controller.deliveryReport);

/**
 * POST /sms/send
 * Send SMS message
 * Body: { phoneNumber: string, message: string (1-160 chars) }
 */
router.post('/send', msg91Controller.sendSMS);

/**
 * POST /sms/otp
 * Send OTP via SMS
 * Body: { phoneNumber: string, otp: string (6 digits), businessName?: string }
 */
router.post('/otp', msg91Controller.sendOTP);

/**
 * POST /sms/verify
 * Send verification message
 * Body: { phoneNumber: string, businessName: string }
 */
router.post('/verify', msg91Controller.sendVerification);

/**
 * POST /sms/bulk
 * Send bulk SMS to multiple recipients
 * Body: { phoneNumbers: string[], message: string (1-160 chars) }
 */
router.post('/bulk', msg91Controller.sendBulkSMS);

/**
 * POST /sms/test
 * Send a test SMS (demo/testing endpoint with auth & rate limiting)
 * Body: { phoneNumber: string, message?: string }
 */
router.post('/test', verifyToken, msg91Controller.sendTestSMS);

export default router;
