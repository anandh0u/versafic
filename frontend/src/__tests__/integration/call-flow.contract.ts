/**
 * Call contract reference.
 *
 * This file documents the outbound-call API contract the frontend is built against.
 * It is intentionally not an executable test suite.
 */

export const CALL_FLOW_CONTRACT = {
  outboundCall: {
    endpoint: 'POST /call/outbound',
    request: {
      phone_number: '+919876543210',
      purpose: 'support_call',
    },
    requirements: [
      'Recipient must be a registered user.',
      'call_consent must be true and call_opt_out must be false.',
      'Max 2 outbound calls per day per business owner.',
      '24-hour cooldown per recipient phone number.',
      'Wallet must have 20 credits available for the one-minute call window.',
    ],
    success: {
      status: 'success',
      data: {
        callSid: 'CA1234567890ABCDEF',
        to: '+919876543210',
        purpose: 'support_call',
        script: 'Short support-oriented AI call script',
        balance_credits: 480,
      },
    },
  },

  blockedStates: {
    noConsent: '403 Recipient has not consented to AI calls or has opted out',
    insufficientCredits: '402 Insufficient credits for outbound calling',
    dailyLimit: '429 Daily outbound call limit reached for this business',
    cooldown: '429 Cooldown active. Wait 24 hours before calling this number again',
  },

  callSafety: {
    intro: 'Hello, this is an AI assistant from [app name].',
    stopPrompt: 'You can say STOP to avoid future calls.',
    refundRule: 'Failed or missed call attempts should refund the reserved call credits.',
    missedCallHandling: 'Incoming missed calls can trigger a callback only when the recipient is registered and consented.',
  },

  scriptGeneration: {
    purposes: [
      'enquiry_follow_up',
      'missed_call_callback',
      'support_call',
      'booking_confirmation',
    ],
    rules: [
      'Use OpenAI for short, respectful scripts.',
      'Keep scripts under 80 words.',
      'Do not cold sell or run promotions.',
      'Fall back to a safe template if the model call fails.',
    ],
  },

  recordingLifecycle: {
    expectations: [
      'Twilio status and recording callbacks update call_sessions.',
      'STOP opt-out is persisted on the recipient user record.',
      'Recording URLs and durations are stored for downstream transcription.',
      'Missed inbound calls can create a callback request trail without double-charging.',
    ],
  },
};
