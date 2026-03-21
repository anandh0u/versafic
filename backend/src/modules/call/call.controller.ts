// src/modules/call/call.controller.ts - Controller for Twilio call handling
import { Request, Response, NextFunction } from 'express';
import * as CallModel from '../../models/call.model';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';
import { ErrorCode } from '../../types';

export const handleIncomingCall = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Incoming call received from Twilio', {
      from: req.body.From,
      to: req.body.To,
      callSid: req.body.CallSid,
      timestamp: new Date().toISOString()
    });

    // Lazy import to avoid initialization issues
    const { getTwilioService } = await import('../../services/twilioService');
    const twilioService = getTwilioService();

    // Validate Twilio request (optional but recommended for production)
    const signature = req.get('X-Twilio-Signature');
    if (signature) {
      const isValid = twilioService.validateRequestSignature(
        `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        req.body,
        signature
      );

      if (!isValid) {
        logger.warn('Invalid Twilio signature detected', { signature });
        return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid Twilio signature'));
      }
    }

    // Generate TwiML response
    logger.debug('Generating TwiML response for incoming call', {
      callSid: req.body.CallSid
    });

    const twiml = twilioService.generateIncomingCallTwiML();

    // Set proper content type for TwiML
    res.set('Content-Type', 'text/xml');
    res.send(twiml);

  } catch (error) {
    logger.error('Error handling incoming call', error instanceof Error ? error : new Error(String(error)));
    next(error);
  }
};

export const handleRecording = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      RecordingUrl,
      RecordingDuration,
      RecordingSid,
      CallSid,
      From,
      To
    } = req.body;

    // Log all recording details
    logger.info('Recording callback received from Twilio', {
      recordingUrl: RecordingUrl,
      recordingDuration: RecordingDuration,
      recordingSid: RecordingSid,
      callSid: CallSid,
      from: From,
      to: To,
      timestamp: new Date().toISOString()
    });

    // Validate required fields
    if (!RecordingUrl || !RecordingDuration || !CallSid || !From) {
      logger.warn('Missing required recording data in callback', {
        body: req.body,
        missingFields: {
          RecordingUrl: !RecordingUrl,
          RecordingDuration: !RecordingDuration,
          CallSid: !CallSid,
          From: !From
        }
      });
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Missing required recording data'));
    }

    // Save recording to database
    logger.debug('Saving call recording to database', {
      callSid: CallSid,
      phoneNumber: From,
      recordingUrl: RecordingUrl,
      duration: RecordingDuration
    });

    const recording = await CallModel.createCallRecording(
      CallSid,
      From,
      RecordingUrl,
      parseInt(RecordingDuration, 10)
    );

    logger.info('Call recording saved to database successfully', {
      recordingId: recording.id,
      callSid: CallSid,
      phoneNumber: From,
      recordingUrl: RecordingUrl,
      duration: RecordingDuration
    });

    // Process the recording for AI (placeholder for future implementation)
    await processCallRecording(RecordingUrl, recording);

    // Lazy import to avoid initialization issues
    const { getTwilioService } = await import('../../services/twilioService');
    const twilioService = getTwilioService();
    const twiml = twilioService.generateRecordingCompleteTwiML();

    res.set('Content-Type', 'text/xml');
    res.send(twiml);

  } catch (error) {
    logger.error('Error handling recording callback', error instanceof Error ? error : new Error(String(error)));
    next(error);
  }
};

/**
 * Placeholder function for future AI processing of call recordings
 * This will integrate with Sarvam AI for speech-to-text and OpenAI for response generation
 */
async function processCallRecording(recordingUrl: string, recording: any): Promise<void> {
  try {
    logger.info('Processing call recording for AI', {
      recordingId: recording.id,
      recordingUrl,
      callSid: recording.call_sid
    });

    // TODO: Implement AI processing pipeline
    // 1. Send recording to Sarvam AI for speech-to-text
    // 2. Process the transcription with OpenAI
    // 3. Generate appropriate response
    // 4. Store the results in database
    // 5. Optionally send SMS response to caller

    logger.info('Call recording processing completed (placeholder)', {
      recordingId: recording.id
    });

  } catch (error) {
    logger.error('Error processing call recording', error instanceof Error ? error : new Error(String(error)), {
      recordingId: recording.id
    });
    // Don't throw error here - we don't want to break the call flow
  }
}

// Additional helper endpoints for managing recordings

export const getCallRecordings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phoneNumber, limit = '50', offset = '0' } = req.query;

    let recordings;
    if (phoneNumber) {
      recordings = await CallModel.getCallRecordingsByPhoneNumber(phoneNumber as string);
    } else {
      recordings = await CallModel.getAllCallRecordings(
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );
    }

    res.status(200).json({
      status: 'success',
      message: 'Call recordings retrieved',
      data: recordings,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting call recordings', error instanceof Error ? error : new Error(String(error)));
    next(error);
  }
};

export const getCallRecordingByCallSid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { callSid } = req.params;

    if (!callSid || typeof callSid !== 'string') {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Call SID is required'));
    }

    const recording = await CallModel.findCallRecordingByCallSid(callSid);

    if (!recording) {
      return next(new AppError(404, ErrorCode.NOT_FOUND, 'Call recording not found'));
    }

    res.status(200).json({
      status: 'success',
      message: 'Call recording retrieved',
      data: recording,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting call recording by call SID', error instanceof Error ? error : new Error(String(error)));
    next(error);
  }
};