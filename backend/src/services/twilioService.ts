// src/services/twilioService.ts - Twilio service for call handling
import twilio from 'twilio';
import { getOptionalEnv } from '../utils/env';
import { logger } from '../utils/logger';
import { getPublicUrl } from '../config/database';

type TwilioWebhookSyncResult = {
  status: 'synced' | 'already_configured' | 'skipped' | 'unavailable';
  incomingUrl: string;
  phoneNumber: string;
  reason?: string;
};

export class TwilioService {
  private client: twilio.Twilio;
  private accountSid: string;
  private authToken: string;
  private phoneNumber: string;

  constructor() {
    this.accountSid = getOptionalEnv('TWILIO_ACCOUNT_SID');
    this.authToken = getOptionalEnv('TWILIO_AUTH_TOKEN');
    this.phoneNumber = getOptionalEnv('TWILIO_PHONE_NUMBER');

    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      throw new Error('Twilio service not configured. Missing required environment variables.');
    }

    this.client = twilio(this.accountSid, this.authToken);

    logger.info('Twilio service initialized', {
      accountSid: this.accountSid.substring(0, 8) + '...',
      phoneNumber: this.phoneNumber
    });
  }

  getPhoneNumber(): string {
    return this.phoneNumber;
  }

  getConfigurationSummary(): {
    configured: boolean;
    accountMode: 'trial' | 'paid';
    phoneNumber: string;
    maskedAccountSid: string;
    publicBaseUrl: string;
    webhooks: {
      incoming: string;
      status: string;
      recording: string;
      outboundTwiml: string;
    };
    autoSyncEnabled: boolean;
  } {
    return {
      configured: true,
      accountMode: getOptionalEnv('TWILIO_ACCOUNT_MODE', 'trial') === 'paid' ? 'paid' : 'trial',
      phoneNumber: this.phoneNumber,
      maskedAccountSid: `${this.accountSid.substring(0, 8)}...`,
      publicBaseUrl: getPublicUrl(''),
      webhooks: {
        incoming: getPublicUrl('/call/incoming'),
        status: getPublicUrl('/call/status'),
        recording: getPublicUrl('/call/recording'),
        outboundTwiml: getPublicUrl('/call/outbound/twiml'),
      },
      autoSyncEnabled: getOptionalEnv('TWILIO_AUTO_SYNC_WEBHOOKS', 'false') === 'true',
    };
  }

  async syncIncomingVoiceWebhookIfEnabled(): Promise<TwilioWebhookSyncResult> {
    const incomingUrl = getPublicUrl('/call/incoming');

    if (getOptionalEnv('TWILIO_AUTO_SYNC_WEBHOOKS', 'false') !== 'true') {
      return {
        status: 'skipped',
        incomingUrl,
        phoneNumber: this.phoneNumber,
        reason: 'twilio_auto_sync_disabled',
      };
    }

    const numbers = await this.client.incomingPhoneNumbers.list({
      phoneNumber: this.phoneNumber,
      limit: 1,
    });
    const phoneNumber = numbers[0];

    if (!phoneNumber) {
      logger.warn('Twilio number was not found in IncomingPhoneNumbers inventory', {
        phoneNumber: this.phoneNumber,
      });

      return {
        status: 'unavailable',
        incomingUrl,
        phoneNumber: this.phoneNumber,
        reason: 'phone_number_not_found',
      };
    }

    const normalizedExistingVoiceUrl = (phoneNumber.voiceUrl || '').replace(/\/$/, '');
    const normalizedTargetVoiceUrl = incomingUrl.replace(/\/$/, '');

    if (normalizedExistingVoiceUrl === normalizedTargetVoiceUrl && phoneNumber.voiceMethod === 'POST') {
      logger.info('Twilio incoming voice webhook already configured', {
        phoneNumber: this.phoneNumber,
        incomingUrl,
      });

      return {
        status: 'already_configured',
        incomingUrl,
        phoneNumber: this.phoneNumber,
      };
    }

    await this.client.incomingPhoneNumbers(phoneNumber.sid).update({
      voiceUrl: incomingUrl,
      voiceMethod: 'POST',
    });

    logger.info('Twilio incoming voice webhook synced', {
      phoneNumber: this.phoneNumber,
      incomingUrl,
    });

    return {
      status: 'synced',
      incomingUrl,
      phoneNumber: this.phoneNumber,
    };
  }

  /**
   * Generate TwiML for incoming call handling
   */
  generateIncomingCallTwiML(): string {
    const twiml = new twilio.twiml.VoiceResponse();
    const recordingCallbackUrl = getPublicUrl('/call/recording');

    logger.debug('Generating incoming call TwiML', {
      recordingUrl: recordingCallbackUrl
    });

    // Greet the caller
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Hello, thank you for calling. Please tell us your request after the beep.');

    // Record the caller's speech
    twiml.record({
      action: recordingCallbackUrl,
      method: 'POST',
      maxLength: 30, // Maximum 30 seconds
      timeout: 3, // Wait 3 seconds for input
      transcribe: false, // We'll handle transcription separately
      playBeep: true
    });

    // If recording fails or times out
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'We could not record your message. Please try again later.');

    twiml.hangup();

    return twiml.toString();
  }

  /**
   * Generate TwiML for recording completion
   */
  generateRecordingCompleteTwiML(): string {
    const twiml = new twilio.twiml.VoiceResponse();

    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Thank you for your message. We will process your request and get back to you soon.');

    twiml.hangup();

    return twiml.toString();
  }

  /**
   * Validate Twilio request signature for webhook security
   */
  validateRequestSignature(
    url: string,
    params: Record<string, any>,
    signature: string
  ): boolean {
    try {
      const validator = twilio.validateRequest(
        this.authToken,
        signature,
        url,
        params
      );
      return validator;
    } catch (error) {
      logger.error('Twilio signature validation failed', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get call details from Twilio
   */
  async getCallDetails(callSid: string): Promise<any> {
    try {
      const call = await this.client.calls(callSid).fetch();
      return call;
    } catch (error) {
      logger.error('Failed to fetch call details from Twilio', error instanceof Error ? error : new Error(String(error)), {
        callSid
      });
      throw error;
    }
  }

  async createOutboundCall(params: {
    to: string;
    twimlUrl: string;
    statusCallbackUrl: string;
    recordingStatusCallbackUrl: string;
    machineDetection?: 'Enable' | 'DetectMessageEnd';
    timeLimitSeconds?: number;
  }): Promise<any> {
    try {
      const call = await this.client.calls.create({
        to: params.to,
        from: this.phoneNumber,
        url: params.twimlUrl,
        statusCallback: params.statusCallbackUrl,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: true,
        recordingStatusCallback: params.recordingStatusCallbackUrl,
        recordingStatusCallbackMethod: 'POST',
        machineDetection: params.machineDetection ?? 'Enable',
        timeLimit: params.timeLimitSeconds ?? 60,
      });

      logger.info('Outbound call initiated', {
        callSid: call.sid,
        to: params.to,
      });

      return call;
    } catch (error) {
      logger.error('Failed to initiate outbound call', error instanceof Error ? error : new Error(String(error)), {
        to: params.to
      });
      throw error;
    }
  }

  /**
   * Send SMS (for future use)
   */
  async sendSMS(to: string, message: string): Promise<any> {
    try {
      const sms = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });
      logger.info('SMS sent successfully', { to, messageId: sms.sid });
      return sms;
    } catch (error) {
      logger.error('Failed to send SMS', error instanceof Error ? error : new Error(String(error)), {
        to
      });
      throw error;
    }
  }

  /**
   * Get recording details from Twilio
   */
  async getRecordingDetails(recordingSid: string): Promise<any> {
    try {
      const recording = await this.client.recordings(recordingSid).fetch();
      return recording;
    } catch (error) {
      logger.error('Failed to fetch recording details from Twilio', error instanceof Error ? error : new Error(String(error)), {
        recordingSid
      });
      throw error;
    }
  }
}

// Export singleton instance - only create if Twilio is configured
let twilioServiceInstance: TwilioService | null = null;

export const getTwilioService = (): TwilioService => {
  if (!twilioServiceInstance) {
    try {
      twilioServiceInstance = new TwilioService();
    } catch (error) {
      logger.error('Twilio service initialization failed', error instanceof Error ? error : new Error(String(error)));
      throw new Error('Twilio service is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and PUBLIC_BASE_URL environment variables.');
    }
  }
  return twilioServiceInstance;
};

// For backward compatibility - create a proxy that throws if not configured
export const twilioService = new Proxy({} as TwilioService, {
  get(target, prop) {
    const service = getTwilioService();
    const value = (service as any)[prop];
    if (typeof value === 'function') {
      return value.bind(service);
    }
    return value;
  }
});
