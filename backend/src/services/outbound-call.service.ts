import twilio from 'twilio';
import * as OnboardingModel from '../models/onboarding.model';
import * as UserModel from '../models/user.model';
import { callSessionRepo } from '../repositories';
import type { CallSessionStatus } from '../repositories/call-session.repository';
import { getPublicUrl } from '../config/database';
import { walletService } from './wallet.service';
import { callScriptService } from './call-script.service';
import { getTwilioService } from './twilioService';
import { AppError } from '../middleware/error-handler';
import { ErrorCode } from '../types';
import { logger } from '../utils/logger';
import { normalizePhoneNumber } from '../utils/validators';

const APP_NAME = process.env.APP_NAME || 'Versafic';
const OUTBOUND_CALL_CREDITS = 20;
const ALLOWED_PURPOSES = [
  'enquiry_follow_up',
  'missed_call_callback',
  'support_call',
  'booking_confirmation',
] as const;

export type AllowedCallPurpose = (typeof ALLOWED_PURPOSES)[number];

export class OutboundCallService {
  private isAllowedPurpose(purpose: string): purpose is AllowedCallPurpose {
    return ALLOWED_PURPOSES.includes(purpose as AllowedCallPurpose);
  }

  private buildOutboundTwimlUrl(params: {
    ownerUserId: number;
    phoneNumber: string;
    purpose: AllowedCallPurpose;
    script: string;
  }): string {
    const query = new URLSearchParams({
      ownerUserId: String(params.ownerUserId),
      phoneNumber: params.phoneNumber,
      purpose: params.purpose,
      script: params.script,
    });

    return `${getPublicUrl('/call/outbound/twiml')}?${query.toString()}`;
  }

  async resolveOwnerForIncomingCall(toNumber: string) {
    return OnboardingModel.findBusinessByPhone(toNumber);
  }

  async initiateOutboundCall(params: {
    ownerUserId: number;
    phoneNumber: string;
    purpose: string;
    parentCallSid?: string;
    callbackRequested?: boolean;
  }) {
    const normalizedPhone = normalizePhoneNumber(params.phoneNumber);

    if (!this.isAllowedPurpose(params.purpose)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Purpose is not allowed for automated outbound calls');
    }

    const recipient = await UserModel.findUserByPhoneNumber(normalizedPhone);
    if (!recipient) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Outbound calling is allowed only for registered users');
    }

    if (!recipient.call_consent || recipient.call_opt_out) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Recipient has not consented to AI calls or has opted out');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await callSessionRepo.getRecentOutboundCountForDay(params.ownerUserId, startOfDay);
    if (todayCount >= 2) {
      throw new AppError(429, ErrorCode.FORBIDDEN, 'Daily outbound call limit reached for this business');
    }

    const latestOutbound = await callSessionRepo.getLatestOutboundSession(params.ownerUserId, normalizedPhone);
    if (latestOutbound && Date.now() - new Date(latestOutbound.created_at).getTime() < 24 * 60 * 60 * 1000) {
      throw new AppError(429, ErrorCode.FORBIDDEN, 'Cooldown active. Wait 24 hours before calling this number again');
    }

    const businessProfile = await OnboardingModel.findBusinessByUserId(params.ownerUserId);
    const businessName = businessProfile?.business_name || APP_NAME;
    const businessType = businessProfile?.business_type || 'AI customer support';
    const history = await callSessionRepo.getRecentPhoneInteractions(normalizedPhone, 5);

    const scriptParams: {
      businessName: string;
      businessType: string;
      purpose: AllowedCallPurpose;
      recipientName?: string;
      callHistory: string[];
    } = {
      businessName,
      businessType,
      purpose: params.purpose,
      callHistory: history.map((session) => {
        const createdAt = new Date(session.created_at).toISOString();
        return `${createdAt} - ${session.type || session.direction} - ${session.status}${session.purpose ? ` - ${session.purpose}` : ''}`;
      }),
    };

    if (recipient.name) {
      scriptParams.recipientName = recipient.name;
    }

    const script = await callScriptService.generateOutboundScript(scriptParams);

    const chargeReference = `OUTBOUND-${params.ownerUserId}-${Date.now()}`;
    const chargeResult = await walletService.deductCreditsForUsage(
      params.ownerUserId,
      'outbound_call',
      `Outbound AI call for ${params.purpose.replace(/_/g, ' ')}`,
      chargeReference,
      OUTBOUND_CALL_CREDITS
    );

    if (!chargeResult.success) {
      throw new AppError(
        402,
        ErrorCode.INSUFFICIENT_CREDITS,
        chargeResult.autopay?.requires_user_action
          ? 'Insufficient credits. A compliant autopay checkout has been created and is awaiting user confirmation.'
          : 'Insufficient credits for outbound calling'
      );
    }

    let callCreditsReserved = true;

    try {
      const twilioService = getTwilioService();
      const call = await twilioService.createOutboundCall({
        to: normalizedPhone,
        twimlUrl: this.buildOutboundTwimlUrl({
          ownerUserId: params.ownerUserId,
          phoneNumber: normalizedPhone,
          purpose: params.purpose,
          script,
        }),
        statusCallbackUrl: getPublicUrl('/call/status'),
        recordingStatusCallbackUrl: getPublicUrl('/call/recording'),
        timeLimitSeconds: 60,
      });

      callCreditsReserved = false;

      await callSessionRepo.createDetailed({
        callSid: call.sid,
        userId: params.ownerUserId,
        phoneNumber: normalizedPhone,
        type: 'outgoing',
        purpose: params.purpose,
        fromNumber: twilioService.getPhoneNumber(),
        toNumber: normalizedPhone,
        direction: 'outbound',
        status: 'initiated',
        costCredits: OUTBOUND_CALL_CREDITS,
        parentCallSid: params.parentCallSid ?? null,
        callbackRequested: params.callbackRequested ?? false,
        metadata: {
          script,
          business_name: businessName,
          recipient_user_id: recipient.id,
        },
      });

      return {
        callSid: call.sid,
        to: normalizedPhone,
        purpose: params.purpose,
        script,
        balance_credits: chargeResult.remaining,
      };
    } catch (error) {
      if (callCreditsReserved) {
        await walletService.refundCredits(
          params.ownerUserId,
          OUTBOUND_CALL_CREDITS,
          chargeReference,
          'Refunded outbound call credits after call initiation failed.'
        );
      }

      throw error;
    }
  }

  buildInitialOutboundTwiML(params?: {
    ownerUserId?: string;
    phoneNumber?: string;
    purpose?: string;
    script?: string;
  }): string {
    const twiml = new twilio.twiml.VoiceResponse();
    const actionQuery = new URLSearchParams();
    if (params?.ownerUserId) actionQuery.set('ownerUserId', params.ownerUserId);
    if (params?.phoneNumber) actionQuery.set('phoneNumber', params.phoneNumber);
    if (params?.purpose) actionQuery.set('purpose', params.purpose);
    if (params?.script) actionQuery.set('script', params.script);
    const actionPath = `${getPublicUrl('/call/outbound/respond')}${actionQuery.toString() ? `?${actionQuery.toString()}` : ''}`;

    twiml.say({ voice: 'alice', language: 'en-US' }, `Hello, this is an AI assistant from ${APP_NAME}.`);
    twiml.say({ voice: 'alice', language: 'en-US' }, 'You can say STOP to avoid future calls.');

    twiml.gather({
      input: ['speech'],
      speechTimeout: 'auto',
      action: actionPath,
      method: 'POST',
      hints: 'STOP',
      timeout: 5,
    });

    twiml.redirect({ method: 'POST' }, actionPath);
    return twiml.toString();
  }

  async buildOutboundResponseTwiML(params: {
    callSid: string;
    ownerUserId: number;
    phoneNumber: string;
    speechResult?: string;
    script: string;
  }): Promise<string> {
    const twiml = new twilio.twiml.VoiceResponse();
    const normalizedPhone = normalizePhoneNumber(params.phoneNumber);
    const speechResult = params.speechResult?.trim().toLowerCase() || '';

    if (speechResult.includes('stop')) {
      const recipient = await UserModel.findUserByPhoneNumber(normalizedPhone);
      if (recipient) {
        await UserModel.setUserCallOptOut(recipient.id, true);
      }

      await callSessionRepo.updateStatus(params.callSid, 'completed', {
        opted_out: true,
        speech_result: params.speechResult || '',
      });

      twiml.say({ voice: 'alice', language: 'en-US' }, 'We have updated your preferences. You will not receive future AI calls.');
      twiml.hangup();
      return twiml.toString();
    }

    await callSessionRepo.updateStatus(params.callSid, 'in-progress', {
      speech_result: params.speechResult || '',
    });

    twiml.say({ voice: 'alice', language: 'en-US' }, params.script);
    twiml.say({ voice: 'alice', language: 'en-US' }, 'Thank you for your time. Goodbye.');
    twiml.hangup();
    return twiml.toString();
  }

  async updateStatusFromTwilio(callSid: string, callStatus: string, payload: Record<string, unknown>) {
    const statusMap: Record<string, CallSessionStatus> = {
      initiated: 'initiated',
      ringing: 'ringing',
      answered: 'in-progress',
      completed: 'completed',
      busy: 'failed',
      failed: 'failed',
      'no-answer': 'no-answer',
      canceled: 'failed',
    };

    const mappedStatus = statusMap[callStatus] || 'failed';
    return callSessionRepo.updateStatus(callSid, mappedStatus, payload);
  }

  async triggerMissedCallCallback(params: {
    ownerUserId: number;
    phoneNumber: string;
    parentCallSid: string;
  }): Promise<void> {
    try {
      await this.initiateOutboundCall({
        ownerUserId: params.ownerUserId,
        phoneNumber: params.phoneNumber,
        purpose: 'missed_call_callback',
        parentCallSid: params.parentCallSid,
        callbackRequested: true,
      });

      await callSessionRepo.markCallbackRequested(params.parentCallSid);
    } catch (error) {
      logger.warn('Missed-call callback could not be triggered', {
        ownerUserId: params.ownerUserId,
        phoneNumber: params.phoneNumber,
        parentCallSid: params.parentCallSid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const outboundCallService = new OutboundCallService();
