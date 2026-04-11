import twilio from 'twilio';
import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/jwt-auth';
import * as CallModel from '../../models/call.model';
import { callSessionRepo } from '../../repositories';
import type { CallSession, CallSessionStatus } from '../../repositories/call-session.repository';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';
import { ErrorCode } from '../../types';
import { getTwilioService } from '../../services/twilioService';
import { walletService } from '../../services/wallet.service';
import { outboundCallService } from '../../services/outbound-call.service';
import { normalizePhoneNumber } from '../../utils/validators';
import { getPublicUrl } from '../../config/database';
import { getOptionalEnv } from '../../utils/env';

const CALL_CREDIT_COST = 20;
const APP_NAME = process.env.APP_NAME || 'Versafic';
const EXOTEL_NUMBER = getOptionalEnv('EXOTEL_NUMBER');
const EXOTEL_API_BASE_URL = getOptionalEnv('EXOTEL_API_BASE_URL');

const getPrimaryProviderConfig = () => {
  if (EXOTEL_NUMBER) {
    return {
      configured: true,
      provider: 'exotel',
      ai_number: EXOTEL_NUMBER,
      call_credit_cost: CALL_CREDIT_COST,
      account_mode: 'live',
      demo_mode: false,
      cooldown_enabled: false,
      daily_limit_enabled: false,
      app_name: APP_NAME,
      intro_message: `Hello, this is an AI assistant from ${APP_NAME}.`,
      trial_guidance: 'The AI number is connected through Exotel.',
      webhooks: {
        incoming: getPublicUrl('/exotel/incoming'),
        status: getPublicUrl('/exotel/status'),
        recording: getPublicUrl('/exotel/recording'),
      },
      auto_sync_enabled: false,
      provider_base_url: EXOTEL_API_BASE_URL || null,
    };
  }

  const twilioConfig = getTwilioService().getConfigurationSummary();
  const demoModeEnabled = outboundCallService.isDemoModeEnabled();

  return {
    configured: true,
    provider: 'twilio',
    ai_number: twilioConfig.phoneNumber,
    call_credit_cost: CALL_CREDIT_COST,
    account_mode: twilioConfig.accountMode,
    demo_mode: demoModeEnabled,
    cooldown_enabled: !demoModeEnabled,
    daily_limit_enabled: !demoModeEnabled,
    app_name: APP_NAME,
    intro_message: `Hello, this is an AI assistant from ${APP_NAME}.`,
    trial_guidance:
      twilioConfig.accountMode === 'trial'
        ? demoModeEnabled
          ? 'Use verified customer numbers while the account is on trial. Demo mode removes the repeat-call cooldown and daily outbound cap.'
          : 'Use verified customer numbers while the account is on trial.'
        : 'The calling system is configured for live usage.',
    webhooks: twilioConfig.webhooks,
    auto_sync_enabled: twilioConfig.autoSyncEnabled,
  };
};

const buildSimpleTwiml = (message: string): string => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: 'alice', language: 'en-US' }, message);
  twiml.hangup();
  return twiml.toString();
};

const buildPublicRequestUrl = (req: Request): string => {
  const [path = req.originalUrl, query = ''] = req.originalUrl.split('?');
  const publicUrl = getPublicUrl(path);

  return query ? `${publicUrl}?${query}` : publicUrl;
};

const validateTwilioRequest = (req: Request): void => {
  const signature = req.get('X-Twilio-Signature');
  if (!signature) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing Twilio signature');
    }

    logger.warn('Allowing unsigned Twilio webhook outside production', {
      path: req.originalUrl,
    });
    return;
  }

  const twilioService = getTwilioService();
  const isValid = twilioService.validateRequestSignature(
    buildPublicRequestUrl(req),
    req.body,
    signature
  );

  if (!isValid) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid Twilio signature');
  }
};

const isFinalFailedCallStatus = (status: string): status is Extract<CallSessionStatus, 'failed' | 'no-answer'> =>
  status === 'failed' || status === 'no-answer';

const maybeRefundCallCredits = async (session: CallSession | null, reason: string): Promise<void> => {
  if (!session?.user_id || !session.cost_credits || session.cost_credits <= 0) {
    return;
  }

  if (session.metadata?.credits_refunded) {
    return;
  }

  await walletService.refundCredits(
    session.user_id,
    session.cost_credits,
    `CALL-REFUND-${session.call_sid}`,
    reason
  );

  await callSessionRepo.updateStatus(session.call_sid, (session.status as CallSessionStatus) || 'failed', {
    credits_refunded: true,
    credit_refund_reason: reason,
  });
};

export const initiateOutboundCall = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required'));
    }

    const { phone_number, purpose } = req.body;
    if (!phone_number || !purpose) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'phone_number and purpose are required'));
    }

    const result = await outboundCallService.initiateOutboundCall({
      ownerUserId: Number(req.user.id),
      phoneNumber: String(phone_number),
      purpose: String(purpose),
    });

    res.status(201).json({
      status: 'success',
      message: 'Outbound AI call initiated successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const getCallConfig = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required'));
    }

    try {
      res.status(200).json({
        status: 'success',
        message: 'Call configuration retrieved',
        data: getPrimaryProviderConfig(),
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(200).json({
        status: 'success',
        message: 'Call configuration retrieved',
        data: {
          configured: false,
          provider: EXOTEL_NUMBER ? 'exotel' : 'twilio',
          ai_number: null,
          call_credit_cost: CALL_CREDIT_COST,
          account_mode: 'trial',
          demo_mode: true,
          cooldown_enabled: false,
          daily_limit_enabled: false,
          app_name: APP_NAME,
          intro_message: `Hello, this is an AI assistant from ${APP_NAME}.`,
          trial_guidance: 'Set the provider environment variables to enable live calling.',
          webhooks: {
            incoming: getPublicUrl(EXOTEL_NUMBER ? '/exotel/incoming' : '/call/incoming'),
            status: getPublicUrl(EXOTEL_NUMBER ? '/exotel/status' : '/call/status'),
            recording: getPublicUrl(EXOTEL_NUMBER ? '/exotel/recording' : '/call/recording'),
            outboundTwiml: getPublicUrl('/call/outbound/twiml'),
          },
          auto_sync_enabled: false,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
};

export const getPublicCallConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    try {
      res.status(200).json({
        status: 'success',
        message: 'Public call configuration retrieved',
        data: getPrimaryProviderConfig(),
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(200).json({
        status: 'success',
        message: 'Public call configuration retrieved',
        data: {
          configured: false,
          provider: EXOTEL_NUMBER ? 'exotel' : 'twilio',
          ai_number: null,
          call_credit_cost: CALL_CREDIT_COST,
          account_mode: 'trial',
          demo_mode: true,
          app_name: APP_NAME,
          intro_message: `Hello, this is an AI assistant from ${APP_NAME}.`,
          trial_guidance: 'The AI number is not configured yet.',
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
};

export const getCallSessions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required'));
    }

    const limit = Math.min(parseInt(String(req.query.limit || '12'), 10) || 12, 50);
    const sessions = await callSessionRepo.listByUser(Number(req.user.id), limit);

    res.status(200).json({
      status: 'success',
      message: 'Call sessions retrieved',
      data: {
        sessions,
        credit_cost: CALL_CREDIT_COST,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const handleIncomingCall = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    validateTwilioRequest(req);

    const fromNumber = String(req.body.From || '');
    const toNumber = String(req.body.To || '');
    const callSid = String(req.body.CallSid || '');

    if (!fromNumber || !toNumber || !callSid) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Missing required Twilio call fields'));
    }

    const businessProfile = await outboundCallService.resolveOwnerForIncomingCall(toNumber);
    if (!businessProfile) {
      res.set('Content-Type', 'text/xml');
      res.send(buildSimpleTwiml('This service is not configured for inbound calls yet.'));
      return;
    }

    const existingSession = await callSessionRepo.findByCallSid(callSid);
    const normalizedCaller = normalizePhoneNumber(fromNumber);

    if (!existingSession) {
      const chargeResult = await walletService.deductCreditsForUsage(
        businessProfile.user_id,
        'inbound_call',
        'Inbound AI support call',
        `INBOUND-${callSid}`,
        CALL_CREDIT_COST
      );

      if (!chargeResult.success) {
        res.set('Content-Type', 'text/xml');
        res.send(buildSimpleTwiml('This support line is temporarily unavailable because the business wallet does not have enough credits.'));
        return;
      }

      try {
        await callSessionRepo.createDetailed({
          callSid,
          userId: businessProfile.user_id,
          phoneNumber: normalizedCaller,
          type: 'incoming',
          purpose: 'support_call',
          fromNumber: normalizedCaller,
          toNumber,
          direction: 'inbound',
          status: 'initiated',
          costCredits: CALL_CREDIT_COST,
          metadata: {
            inbound_to: toNumber,
            business_name: businessProfile.business_name,
          },
        });
      } catch (sessionError) {
        await walletService.refundCredits(
          businessProfile.user_id,
          CALL_CREDIT_COST,
          `INBOUND-${callSid}`,
          'Refunded inbound call credits because the call session could not be created.'
        );
        throw sessionError;
      }
    }

    const twiml = getTwilioService().generateIncomingCallTwiML();
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Error handling incoming call', error instanceof Error ? error : new Error(String(error)));
    next(error);
  }
};

export const renderOutboundTwiML = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    validateTwilioRequest(req);
    const params: {
      ownerUserId?: string;
      phoneNumber?: string;
      purpose?: string;
      script?: string;
    } = {};

    if (typeof req.query.ownerUserId === 'string') {
      params.ownerUserId = req.query.ownerUserId;
    }

    if (typeof req.query.phoneNumber === 'string') {
      params.phoneNumber = req.query.phoneNumber;
    }

    if (typeof req.query.purpose === 'string') {
      params.purpose = req.query.purpose;
    }

    if (typeof req.query.script === 'string') {
      params.script = req.query.script;
    }

    const twiml = outboundCallService.buildInitialOutboundTwiML(params);
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (error) {
    next(error);
  }
};

export const handleOutboundResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    validateTwilioRequest(req);

    const callSid = String(req.body.CallSid || '');
    if (!callSid) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Call SID is required'));
    }

    const session = await callSessionRepo.findByCallSid(callSid);
    const fallbackScript = typeof req.query.script === 'string'
      ? req.query.script
      : 'We are following up on your request. Please contact the business if you need anything else.';
    const fallbackPhone = typeof req.query.phoneNumber === 'string' ? req.query.phoneNumber : '';
    const fallbackOwnerUserId = typeof req.query.ownerUserId === 'string' ? Number(req.query.ownerUserId) : 0;

    if ((!session || !session.user_id || !session.phone_number) && (!fallbackOwnerUserId || !fallbackPhone)) {
      return next(new AppError(404, ErrorCode.NOT_FOUND, 'Outbound call session not found'));
    }

    const script = String(session?.metadata?.script || fallbackScript);
    const twiml = await outboundCallService.buildOutboundResponseTwiML({
      callSid,
      ownerUserId: session?.user_id || fallbackOwnerUserId,
      phoneNumber: session?.phone_number || fallbackPhone,
      speechResult: typeof req.body.SpeechResult === 'string' ? req.body.SpeechResult : undefined,
      script,
    });

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (error) {
    next(error);
  }
};

export const handleCallStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    validateTwilioRequest(req);

    const callSid = String(req.body.CallSid || '');
    const callStatus = String(req.body.CallStatus || '');
    if (!callSid || !callStatus) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'CallSid and CallStatus are required'));
    }

    const session = await outboundCallService.updateStatusFromTwilio(callSid, callStatus, req.body);

    if (session && isFinalFailedCallStatus(session.status)) {
      await maybeRefundCallCredits(
        session,
        session.type === 'outgoing'
          ? 'Refunded outbound call credits because the call did not connect.'
          : 'Refunded inbound call credits because the customer did not complete the call.'
      );
    }

    if (
      session &&
      session.type === 'incoming' &&
      session.user_id &&
      session.phone_number &&
      !session.callback_requested &&
      isFinalFailedCallStatus(session.status)
    ) {
      await outboundCallService.triggerMissedCallCallback({
        ownerUserId: session.user_id,
        phoneNumber: session.phone_number,
        parentCallSid: session.call_sid,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Call status processed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const handleRecording = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    validateTwilioRequest(req);

    const recordingUrl = typeof req.body.RecordingUrl === 'string' ? req.body.RecordingUrl : '';
    const recordingDuration = parseInt(String(req.body.RecordingDuration || '0'), 10) || 0;
    const recordingSid = typeof req.body.RecordingSid === 'string' ? req.body.RecordingSid : '';
    const callSid = typeof req.body.CallSid === 'string' ? req.body.CallSid : '';
    const fromNumber = typeof req.body.From === 'string' ? req.body.From : '';
    const toNumber = typeof req.body.To === 'string' ? req.body.To : '';

    if (!callSid) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, 'Call SID is required for recording callbacks'));
    }

    const session = await callSessionRepo.findByCallSid(callSid);
    const effectivePhoneNumber = session?.phone_number
      || normalizePhoneNumber(session?.type === 'outgoing' ? toNumber : fromNumber);

    if (!recordingUrl || recordingDuration === 0) {
      if (session?.type === 'incoming' && session.user_id && effectivePhoneNumber && !session.callback_requested) {
        const updatedSession = await callSessionRepo.updateStatus(callSid, 'no-answer', {
          reason: 'missed_call_detected',
        });

        await maybeRefundCallCredits(
          updatedSession ?? session,
          'Refunded inbound call credits because no customer recording was captured.'
        );

        await outboundCallService.triggerMissedCallCallback({
          ownerUserId: session.user_id,
          phoneNumber: effectivePhoneNumber,
          parentCallSid: callSid,
        });
      }

      res.set('Content-Type', 'text/xml');
      res.send(buildSimpleTwiml('Thank you. We will follow up if needed.'));
      return;
    }

    if (recordingSid && session) {
      await callSessionRepo.setRecording(callSid, recordingUrl, recordingSid, recordingDuration);
    }

    const recording = await CallModel.createCallRecording(
      callSid,
      effectivePhoneNumber,
      recordingUrl,
      recordingDuration
    );

    await processCallRecording(recordingUrl, recording);

    const twiml = getTwilioService().generateRecordingCompleteTwiML();
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Error handling recording callback', error instanceof Error ? error : new Error(String(error)));
    next(error);
  }
};

async function processCallRecording(recordingUrl: string, recording: any): Promise<void> {
  try {
    const processedAt = new Date().toISOString();

    logger.info('Processing call recording for AI', {
      recordingId: recording.id,
      recordingUrl,
      callSid: recording.call_sid
    });

    await callSessionRepo.updateStatus(recording.call_sid, 'completed', {
      recording_processed: true,
      recording_processed_at: processedAt,
      recording_duration_seconds: recording.duration,
      recording_url: recordingUrl,
    });

    logger.info('Call recording processing completed', {
      recordingId: recording.id,
      callSid: recording.call_sid,
      processedAt,
    });
  } catch (error) {
    logger.error('Error processing call recording', error instanceof Error ? error : new Error(String(error)), {
      recordingId: recording.id
    });
  }
}

export const getCallRecordings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phoneNumber, limit = '50', offset = '0' } = req.query;

    const recordings = phoneNumber
      ? await CallModel.getCallRecordingsByPhoneNumber(phoneNumber as string)
      : await CallModel.getAllCallRecordings(
          parseInt(limit as string, 10),
          parseInt(offset as string, 10)
        );

    res.status(200).json({
      status: 'success',
      message: 'Call recordings retrieved',
      data: recordings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
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
    next(error);
  }
};
