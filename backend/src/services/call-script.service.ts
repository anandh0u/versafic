import OpenAI from 'openai';
import { logger } from '../utils/logger';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const OUTBOUND_SCRIPT_MODEL = process.env.OPENAI_OUTBOUND_MODEL || 'gpt-4o-mini';

type CallPurpose =
  | 'enquiry_follow_up'
  | 'missed_call_callback'
  | 'support_call'
  | 'booking_confirmation';

export class CallScriptService {
  private fallbackScript(params: {
    businessName: string;
    businessType: string;
    purpose: CallPurpose;
    recipientName?: string;
  }): string {
    const greetingName = params.recipientName ? ` ${params.recipientName}` : '';

    switch (params.purpose) {
      case 'missed_call_callback':
        return `We noticed your missed call${greetingName}. We are calling back from ${params.businessName} to help with your request and connect you to the right support path.`;
      case 'booking_confirmation':
        return `We are calling from ${params.businessName} to confirm your booking details, make sure everything looks correct, and answer any quick questions you may have.`;
      case 'support_call':
        return `We are reaching out from ${params.businessName} to follow up on your support request, share the latest update, and help you resolve the issue quickly.`;
      case 'enquiry_follow_up':
      default:
        return `We are calling from ${params.businessName} to follow up on your enquiry, understand what you need, and guide you with the next best step for ${params.businessType}.`;
    }
  }

  async generateOutboundScript(params: {
    businessName: string;
    businessType: string;
    purpose: CallPurpose;
    recipientName?: string;
    callHistory: string[];
  }): Promise<string> {
    if (!openai) {
      return this.fallbackScript(params);
    }

    try {
      const response = await openai.chat.completions.create({
        model: OUTBOUND_SCRIPT_MODEL,
        temperature: 0.4,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content: 'You write short, respectful outbound call scripts for customer support. Do not cold sell. Do not add an introduction because it is handled separately. Keep the script under 80 words and compliant.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              businessName: params.businessName,
              businessType: params.businessType,
              purpose: params.purpose,
              recipientName: params.recipientName || null,
              pastInteractions: params.callHistory,
              constraints: [
                'Purpose must remain service-oriented.',
                'No promotion or cold-calling language.',
                'Ask for a simple response or confirmation.',
              ],
            }),
          },
        ],
      });

      const script = response.choices[0]?.message?.content?.trim();
      if (!script) {
        return this.fallbackScript(params);
      }

      return script;
    } catch (error) {
      logger.warn('Failed to generate outbound script with OpenAI, using fallback template', {
        error: error instanceof Error ? error.message : String(error),
        purpose: params.purpose,
      });

      return this.fallbackScript(params);
    }
  }
}

export const callScriptService = new CallScriptService();
