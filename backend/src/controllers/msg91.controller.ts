import { Request, Response } from 'express';
import { msg91Service } from '../services/msg91.service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import { ErrorCode } from '../types';

const sendSuccess = (res: Response, message: string, data: Record<string, unknown> = {}) => {
  res.json({
    status: 'success',
    statusCode: 200,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Check MSG91 status
 */
export const checkStatus = async (req: Request, res: Response) => {
  try {
    const config = msg91Service.getConfigurationSummary();

    sendSuccess(
      res,
      config.configured ? 'MSG91 SMS service is configured' : 'MSG91 SMS service not configured',
      {
        ...config,
        msg91Ready: config.configured,
      }
    );
  } catch (error) {
    logger.error('MSG91 status check error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      status: 'error',
      message: 'Failed to check MSG91 status',
    });
  }
};

export const getConfig = async (req: Request, res: Response) => {
  try {
    sendSuccess(res, 'MSG91 configuration retrieved', msg91Service.getConfigurationSummary());
  } catch (error) {
    logger.error('MSG91 config check error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      status: 'error',
      statusCode: 500,
      message: 'Failed to check MSG91 configuration',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Send SMS message
 */
export const sendSMS = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, message } = req.body;

    // Validate input
    if (!phoneNumber || !message) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Phone number and message are required');
    }

    if (typeof phoneNumber !== 'string' || typeof message !== 'string') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Phone number and message must be strings');
    }

    if (message.length === 0 || message.length > 160) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Message must be between 1 and 160 characters');
    }

    if (!msg91Service.isReady()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'MSG91 SMS service not configured');
    }

    const result = await msg91Service.sendSMS(phoneNumber, message);

    if (result.success) {
      sendSuccess(res, 'SMS sent successfully', {
        messageId: result.messageId ?? null,
        phoneNumber,
        warning: result.warning ?? null,
      });
    } else {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, result.error || 'Failed to send SMS');
    }
  } catch (error) {
    logger.error('SMS send error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to send SMS',
      });
    }
  }
};

/**
 * Send OTP via SMS
 */
export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, otp, businessName } = req.body;

    // Validate input
    if (!phoneNumber || !otp) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Phone number and OTP are required');
    }

    if (typeof phoneNumber !== 'string' || typeof otp !== 'string') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Phone number and OTP must be strings');
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'OTP must be 6 digits');
    }

    if (!msg91Service.isReady()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'MSG91 SMS service not configured');
    }

    const result = await msg91Service.sendOTP(phoneNumber, otp, businessName);

    if (result.success) {
      sendSuccess(res, 'OTP sent successfully', {
        messageId: result.messageId ?? null,
        phoneNumber,
        warning: result.warning ?? null,
      });
    } else {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, result.error || 'Failed to send OTP');
    }
  } catch (error) {
    logger.error('OTP send error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to send OTP',
      });
    }
  }
};

/**
 * Send verification message
 */
export const sendVerification = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, businessName } = req.body;

    // Validate input
    if (!phoneNumber || !businessName) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Phone number and business name are required'
      );
    }

    if (typeof phoneNumber !== 'string' || typeof businessName !== 'string') {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Phone number and business name must be strings'
      );
    }

    if (!msg91Service.isReady()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'MSG91 SMS service not configured');
    }

    const result = await msg91Service.sendVerification(phoneNumber, businessName);

    if (result.success) {
      sendSuccess(res, 'Verification message sent successfully', {
        messageId: result.messageId ?? null,
        phoneNumber,
        warning: result.warning ?? null,
      });
    } else {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, result.error || 'Failed to send verification');
    }
  } catch (error) {
    logger.error('Verification send error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to send verification message',
      });
    }
  }
};

/**
 * MSG91 delivery report webhook.
 * Configure this URL in MSG91 SMS > Webhook to get delivery/rejected/failed reports.
 */
export const deliveryReport = async (req: Request, res: Response) => {
  try {
    const rawData = req.body?.data;
    let reports: unknown = req.body;

    if (typeof rawData === 'string') {
      try {
        reports = JSON.parse(rawData);
      } catch {
        reports = rawData;
      }
    }

    logger.info('MSG91 delivery report received', {
      reports,
    });

    sendSuccess(res, 'MSG91 delivery report received', {
      received: true,
    });
  } catch (error) {
    logger.error('MSG91 delivery report error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      status: 'error',
      message: 'Failed to process MSG91 delivery report',
    });
  }
};

/**
 * Send bulk SMS
 */
export const sendBulkSMS = async (req: Request, res: Response) => {
  try {
    const { phoneNumbers, message } = req.body;

    // Validate input
    if (!Array.isArray(phoneNumbers) || !message) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Phone numbers array and message are required');
    }

    if (phoneNumbers.length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Phone numbers array cannot be empty');
    }

    if (typeof message !== 'string' || message.length === 0 || message.length > 160) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Message must be between 1 and 160 characters');
    }

    if (!msg91Service.isReady()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'MSG91 SMS service not configured');
    }

    const result = await msg91Service.sendBulkSMS(phoneNumbers, message);

    sendSuccess(res, `Bulk SMS sent: ${result.sent} successful, ${result.failed} failed`, {
      sent: result.sent,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Bulk SMS send error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to send bulk SMS',
      });
    }
  }
};

const smsDemoGuard = new Map<string, { count: number; windowStart: number; lastSentAt: number }>();
const smsDemoWindowMs = 60 * 60 * 1000;
const smsDemoMinIntervalMs = 60 * 1000;
const smsDemoMaxPerWindow = 5;

const enforceSmsDemoGuard = (userId: string) => {
  const now = Date.now();
  const current = smsDemoGuard.get(userId);

  if (!current || now - current.windowStart >= smsDemoWindowMs) {
    smsDemoGuard.set(userId, { count: 0, windowStart: now, lastSentAt: 0 });
  }

  const next = smsDemoGuard.get(userId)!;
  if (next.lastSentAt && now - next.lastSentAt < smsDemoMinIntervalMs) {
    throw new AppError(429, ErrorCode.FORBIDDEN, 'Please wait a minute before sending another test SMS.');
  }

  if (next.count >= smsDemoMaxPerWindow) {
    throw new AppError(429, ErrorCode.FORBIDDEN, 'Test SMS limit reached for this hour.');
  }

  next.count += 1;
  next.lastSentAt = now;
  smsDemoGuard.set(userId, next);
};

/**
 * Send test SMS (demo endpoint with auth & rate limiting)
 */
export const sendTestSMS = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Sign in to send a test SMS.');
    }

    enforceSmsDemoGuard(String(user.id));

    const { phoneNumber, message } = req.body;

    if (!phoneNumber) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Phone number is required');
    }

    if (typeof phoneNumber !== 'string') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Phone number must be a string');
    }

    const msg = typeof message === 'string' && message.trim() ? message : 'Test SMS from Versafic';

    if (msg.length > 160) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Message must be 160 characters or less');
    }

    if (!msg91Service.isReady()) {
      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'MSG91 SMS service not configured');
    }

    const result = await msg91Service.sendSMS(phoneNumber, msg);

    if (result.success) {
      sendSuccess(res, 'Test SMS sent successfully', {
        provider: 'MSG91',
        messageId: result.messageId ?? null,
        phoneNumber,
        message: msg,
      });
      logger.info('Test SMS sent', { userId: user.id, phoneNumber });
    } else {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, result.error || 'Failed to send test SMS');
    }
  } catch (error) {
    logger.error('Test SMS send error', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        statusCode: error.statusCode,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        status: 'error',
        statusCode: 500,
        message: 'Failed to send test SMS',
        timestamp: new Date().toISOString(),
      });
    }
  }
};
