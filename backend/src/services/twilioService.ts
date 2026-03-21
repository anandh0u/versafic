// src/services/twilioService.ts - Twilio service for call handling
import twilio from 'twilio';
import { getOptionalEnv } from '../utils/env';
import { logger } from '../utils/logger';
import { getPublicUrl } from '../config/database';

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