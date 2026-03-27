# Outbound Call System - Complete Implementation Guide

## Overview

The outbound call system enables AI-powered businesses to safely call users with:
- **Consent verification** (call_consent = true, call_opt_out = false)
- **Rate limiting** (max 2 calls/day, 24h cooldown)
- **Dynamic script generation** (OpenAI-based personalization)
- **Compliance recording** (all calls recorded with consent)
- **Graceful opt-out** (users can say "STOP" to disable future calls)

## 1. Outbound Call Service

Located: `src/services/outbound-call.service.ts`

### Key Methods

#### initiateOutboundCall

```typescript
async initiateOutboundCall(params: {
  ownerUserId: number;        // Business making the call
  phoneNumber: string;         // Recipient phone
  purpose: string;             // 'enquiry_follow_up' | 'missed_call_**callback' | etc
  parentCallSid?: string;      // For callbacks
  callbackRequested?: boolean; // User requested callback
}): Promise<CallSessionInitiationResponse>
```

**Validation Sequence**:
1. ✓ Parse and normalize phone number
2. ✓ Verify purpose is allowed
3. ✓ Check recipient exists (findUserByPhoneNumber)
4. ✓ Verify call_consent = true
5. ✓ Verify call_opt_out = false
6. ✓ Count calls today < 2
7. ✓ 24h cooldown has elapsed
8. ✓ Get business profile
9. ✓ Generate script
10. ✓ Initiate Twilio call
11. ✓ Store call session

**Response**:
```typescript
{
  status: 'success',
  call_sid: 'CA1234567890abcdef',
  status: 'initiated',
  created_at: '2026-03-28T10:30:00Z'
}
```

### Error Scenarios

| Status | Code | Message | Action |
|--------|------|---------|--------|
| 404 | NOT_FOUND | Recipient not found | Verify phone is registered |
| 403 | FORBIDDEN | Call not consented | User must enable call consent |
| 403 | FORBIDDEN | User opted out | User must opt back in |
| 429 | FORBIDDEN | Daily limit reached | Wait until tomorrow |
| 429 | FORBIDDEN | Cooldown active | Wait 24 hours |
| 503 | UNAVAILABLE | Twilio down | Retry later |

---

## 2. Call Script Generation

Located: `src/services/call-script.service.ts`

### Dynamic Script Generation

Uses OpenAI to create personalized, short scripts based on:
- Business name/type
- Call purpose
- User history
- Recipient name (if available)

### Prompt Template

```typescript
System Prompt:
"You write short, respectful outbound call scripts for customer support. 
Do not cold sell. 
Do not add an introduction because it is handled separately. 
Keep the script under 80 words and compliant."

User Input JSON:
{
  "businessName": "Acme Insurance",
  "businessType": "Insurance",
  "purpose": "Support_call",
  "recipientName": "John",
  "pastInteractions": [
    "Called about term life on 2026-03-15",
    "Interested in coverage options"
  ],
  "constraints": [
    "Service-oriented only",
    "No cold sales",
    "Ask for simple response"
  ]
}
```

### Fallback Scripts

If OpenAI fails, use templated fallbacks:

```typescript
switch (purpose) {
  case 'missed_call_callback':
    return `We noticed your missed call. We are calling back from 
            ${businessName} to help with your request.`;
  
  case 'booking_confirmation':
    return `We are calling to confirm your booking and answer 
            any quick questions.`;
  
  case 'support_call':
    return `We're reaching out to follow up on your support 
            request and help resolve the issue.`;
  
  case 'enquiry_follow_up':
    return `We're calling to follow up on your enquiry about 
            ${businessType} and guide you with next steps.`;
}
```

### Best Practices

✓ Keep under 80 words
✓ Start with validation greeting (handled separately)
✓ Reference user history
✓ Ask for simple response (yes/no)
✓ No hard selling
✓ Professional, friendly tone

---

## 3. TwiML (Twilio Markup Language) Flow

### Endpoint: POST /call/outbound/twiml

This endpoint is called by Twilio while the call is active.

### TwiML Response Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- 1. Greeting: Mandatory AI intro -->
  <Say voice="alice">
    Hello, this is an AI assistant from Acme Insurance
  </Say>
  
  <!-- 2. Pause for natural response -->
  <Pause length="1"/>
  
  <!-- 3. Generated Script -->
  <Say voice="alice">
    We are calling from Acme Insurance to follow up on your enquiry 
    about insurance coverage.
  </Say>
  
  <!-- 4. Collect Keypress (for "STOP" = 0) -->
  <Gather
    timeout="5"
    numDigits="1"
    action="https://yourdomain.com/call/outbound/respond?callSid=CA123"
    method="POST"
  >
    <Say voice="alice">
      You can press 0 to stop future calls.
    </Say>
  </Gather>
  
  <!-- 5. Endpoint: If user pressed 0 -->
  <Redirect method="POST">
    https://yourdomain.com/call/outbound/respond?callSid=CA123&Digits=0
  </Redirect>
  
  <!-- 6. Hangup -->
  <Hangup/>
</Response>
```

### Implementation Example

```typescript
export const renderOutboundTwiML = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { ownerUserId, phoneNumber, purpose, script } = req.query;
  
  const twiml = new twilio.twiml.VoiceResponse();
  
  // 1. Greeting
  twiml.say(
    { voice: 'alice', language: 'en-US' },
    'Hello, this is an AI assistant from Versafic'
  );
  
  twiml.pause({ length: 1 });
  
  // 2. Generated script
  twiml.say(
    { voice: 'alice', language: 'en-US' },
    decodeURIComponent(script)
  );
  
  // 3. Collect keypress for "STOP" (0 = stop)
  const respondUrl = new URL(
    `${getPublicUrl('/call/outbound/respond')}`
  );
  respondUrl.searchParams.set('callSid', req.body.CallSid);
  
  twiml.gather({
    timeout: 5,
    numDigits: 1,
    action: respondUrl.toString(),
    method: 'POST'
  });
  
  // Re-gather if no input
  twiml.redirect(respondUrl.toString());
  
  twiml.hangup();
  
  res.type('text/xml');
  res.send(twiml.toString());
};
```

---

## 4. Call Response Handler

### Endpoint: POST /call/outbound/respond

Handles user responses (keypresses, speech).

```typescript
export const handleOutboundResponse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const callSid = req.query.callSid as string;
  const digits = req.body.Digits; // User pressed digit
  const speechResult = req.body.SpeechResult; // User spoke
  
  // Normalize input
  const userInput = (
    digits || 
    speechResult || 
    ''
  ).toLowerCase();
  
  // Check for STOP (digit 0 or word "stop")
  if (userInput === '0' || userInput.includes('stop')) {
    // User wants to opt out
    const callSession = await callSessionRepo.findByCallSid(callSid);
    if (callSession?.user_id) {
      // Set call_opt_out = true
      await UserModel.updateUserCallOptOut(callSession.user_id, true);
      
      // Confirm via voice
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(
        { voice: 'alice' },
        "You've been added to our do-not-call list. You will not receive future calls."
      );
      twiml.hangup();
      
      res.type('text/xml');
      res.send(twiml.toString());
    }
  } else {
    // Let call continue naturally
    res.type('text/xml');
    res.send('<Response><Hangup/></Response>');
  }
};
```

---

## 5. Call Status Webhook

### Endpoint: POST /call/status

Twilio sends call state changes (ringing → in-progress → completed).

```typescript
export const handleCallStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  validateTwilioRequest(req);
  
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus; // 'ringing' | 'in-progress' | 'completed' | 'failed'
  const duration = req.body.CallDuration || 0;
  
  // Update call session
  await callSessionRepo.updateStatus({
    callSid,
    status: mapTwilioStatus(callStatus),
    endedAt: ['completed', 'failed'].includes(callStatus) ? new Date() : null,
    durationSeconds: duration ? parseInt(duration) : 0
  });
  
  // Log event
  logger.info('Call status updated', { callSid, status: callStatus, duration });
  
  res.status(204).send(); // ACK to Twilio
};

function mapTwilioStatus(twilioStatus: string): string {
  switch (twilioStatus) {
    case 'queued': return 'queued';
    case 'ringing': return 'ringing';
    case 'in-progress': return 'in-progress';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'busy': return 'rejected';
    case 'no-answer': return 'no-answer';
    default: return 'unknown';
  }
}
```

---

## 6. Recording Webhook

### Endpoint: POST /call/recording

Twilio sends recording URL after call completes.

```typescript
export const handleRecording = async (
  req: Request,
  res: Response
): Promise<void> => {
  validateTwilioRequest(req);
  
  const callSid = req.body.CallSid;
  const recordingUrl = req.body.RecordingUrl;
  const recordingSid = req.body.RecordingSid;
  const recordingDuration = req.body.RecordingDuration;
  
  // Update call session with recording
  await callSessionRepo.updateRecording({
    callSid,
    recordingUrl,
    recordingSid,
    duration: parseInt(recordingDuration)
  });
  
  logger.info('Recording saved', {
    callSid,
    recordingUrl,
    duration: recordingDuration
  });
  
  res.status(204).send();
};
```

---

## 7. Call Session Model

### Database Operations

```typescript
interface CreateCallSessionParams {
  callSid: string;
  userId: number;
  phoneNumber: string;
  type: 'incoming' | 'outgoing';
  purpose: CallPurpose;
  costCredits: number;
  parentCallSid?: string;
  fromNumber?: string;
  toNumber?: string;
  direction?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

async createDetailed(params: CreateCallSessionParams): Promise<CallSession> {
  const result = await pool.query<CallSession>(
    `INSERT INTO call_sessions 
     (call_sid, user_id, phone_number, type, purpose, 
      cost_credits, parent_call_sid, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'initiated', NOW())
     RETURNING *`,
    [
      params.callSid,
      params.userId,
      params.phoneNumber,
      params.type,
      params.purpose,
      params.costCredits,
      params.parentCallSid || null
    ]
  );
  return result.rows[0]!;
}

async getRecentOutboundCountForDay(
  userId: number,
  startOfDay: Date
): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM call_sessions 
     WHERE user_id = $1 
     AND type = 'outgoing'
     AND created_at >= $2`,
    [userId, startOfDay]
  );
  return parseInt(result.rows[0]?.count || '0');
}

async getLatestOutboundSession(
  userId: number,
  phoneNumber: string
): Promise<CallSession | null> {
  const result = await pool.query<CallSession>(
    `SELECT * FROM call_sessions 
     WHERE user_id = $1 
     AND phone_number = $2 
     AND type = 'outgoing'
     ORDER BY created_at DESC 
     LIMIT 1`,
    [userId, phoneNumber]
  );
  return result.rows[0] || null;
}

async getRecentPhoneInteractions(
  phoneNumber: string,
  limit: number = 5
): Promise<string[]> {
  const result = await pool.query<{ purpose: string }>(
    `SELECT purpose FROM call_sessions 
     WHERE phone_number = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [phoneNumber, limit]
  );
  return result.rows.map(row => row.purpose);
}
```

---

## 8. Rate Limiting Logic

### Enforce Limits in Service

```typescript
async initiateOutboundCall(params: {
  ownerUserId: number;
  phoneNumber: string;
  purpose: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check daily limit
  const todayCount = await callSessionRepo.getRecentOutboundCountForDay(
    params.ownerUserId,
    today
  );
  
  if (todayCount >= 2) {
    throw new AppError(
      429,
      ErrorCode.FORBIDDEN,
      'Daily outbound call limit reached (max 2 calls/day)'
    );
  }
  
  // Check 24h cooldown
  const latestOutbound = await callSessionRepo.getLatestOutboundSession(
    params.ownerUserId,
    normalizedPhone
  );
  
  if (latestOutbound) {
    const lastCallTime = new Date(latestOutbound.created_at).getTime();
    const timeSinceLastCall = Date.now() - lastCallTime;
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (timeSinceLastCall < oneDayMs) {
      throw new AppError(
        429,
        ErrorCode.FORBIDDEN,
        'Cooldown active. Wait 24 hours before calling this number again'
      );
    }
  }
  
  // All checks passed, proceed with call
  // ...
}
```

---

## 9. Twilio Service Integration

### TwiML Voice Response

```typescript
class TwilioService {
  generateIncomingCallTwiML(): string {
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Route to AI voice processing
    twiml.connect();
    
    const stream = twiml.stream({
      url: `wss://stream.twilio.com/...`
    });
    
    return twiml.toString();
  }
  
  initiateOutboundCall(params: {
    fromNumber: string;
    toNumber: string;
    twimlUrl: string;
  }): Promise<string> {
    return this.client.api.calls.create({
      from: params.fromNumber,
      to: params.toNumber,
      url: params.twimlUrl,
      record: true,
      recordingChannels: 'mono',
      statusCallback: `${getPublicUrl('/call/status')}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });
  }
  
  validateRequestSignature(
    url: string,
    params: Record<string, string>,
    signature: string
  ): boolean {
    const validator = twilio.webhooks.RequestValidator(
      process.env.TWILIO_AUTH_TOKEN || ''
    );
    return validator(url, params, signature);
  }
}
```

---

## 10. Frontend Integration

### Outbound Call Trigger

```typescript
// frontend/src/components/OutboundCallDemo.tsx
interface Props {
  onCallInitiated: (callSid: string) => void;
  onError: (error: string) => void;
}

export function OutboundCallDemo(props: Props) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [purpose, setPurpose] = useState<CallPurpose>('support_call');
  const [isLoading, setIsLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'completed'>('idle');
  
  const handleCall = async () => {
    if (!phoneNumber) {
      props.onError('Phone number required');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await fetch('/call/outbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          purpose
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setCallStatus('calling');
        props.onCallInitiated(data.data.call_sid);
        
        // Poll status
        pollCallStatus(data.data.call_sid);
      } else {
        props.onError(data.message);
      }
    } catch (error) {
      props.onError(error instanceof Error ? error.message : 'Call failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div>
      <input
        type="tel"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        placeholder="+919876543210"
      />
      
      <select
        value={purpose}
        onChange={(e) => setPurpose(e.target.value as CallPurpose)}
      >
        <option value="enquiry_follow_up">Follow-up Enquiry</option>
        <option value="missed_call_callback">Missed Call Callback</option>
        <option value="support_call">Support Call</option>
        <option value="booking_confirmation">Booking Confirmation</option>
      </select>
      
      <button
        onClick={handleCall}
        disabled={isLoading}
      >
        {isLoading ? 'Calling...' : 'Trigger AI Call'}
      </button>
      
      {callStatus === 'calling' && <p>Call in progress...</p>}
    </div>
  );
}
```

---

## 11. Consent Management

### User Updates

```typescript
// Update call consent
async updateUserCallConsent(
  userId: number,
  callConsent: boolean,
  phoneNumber?: string
) {
  await pool.query(
    `UPDATE users 
     SET call_consent = $1, 
         phone_number = COALESCE($3, phone_number),
         updated_at = NOW()
     WHERE id = $2`,
    [callConsent, userId, phoneNumber || null]
  );
}

// Update opt-out status (user said STOP)
async updateUserCallOptOut(userId: number, optOut: boolean) {
  await pool.query(
    `UPDATE users 
     SET call_opt_out = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [optOut, userId]
  );
}
```

---

## 12. Testing Checklist

- [ ] Consent verification (reject if call_consent = false)
- [ ] Opt-out verification (reject if call_opt_out = true)
- [ ] Daily limit (reject if > 2 calls today)
- [ ] Cooldown (reject if < 24h since last call)
- [ ] Script generation (verify OpenAI fallback)
- [ ] TwiML rendering (verify Twilio validation)
- [ ] Status webhooks (verify all states updated)
- [ ] Recording storage (verify URL saved)
- [ ] Opt-out handler (verify "STOP" detection)
- [ ] Cost deduction (verify credits charged correctly)

---

## 13. Error Handling

| Scenario | Status | Message|
|----------|--------|---------|
| No consent | 403 | "Recipient has not consented..." |
| Opted out | 403 | "Recipient has opted out..." |
| Daily limit | 429 | "Daily limit reached..." |
| Cooldown active | 429 | "Cooldown active. Wait..." |
| User not found | 404 | "Outbound only for registered..." |
| Invalid purpose | 400 | "Purpose not allowed..." |
| Twilio down | 503 | "Call service unavailable..." |

---

## 14. Deployment Notes

1. **Environment Variables**:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER` (business number)
   - `PUBLIC_URL` (for Twilio webhooks)

2. **Webhook URLs** must be:
   - HTTPS (Twilio requirement)
   - Globally accessible (whitelist Twilio IPs)
   - Fast responding (< 2s)

3. **Recording Retention**:
   - Default: 7 days
   - Change in Twilio console
   - Implement cleanup jobs if needed

4. **Cost Tracking**:
   - Twilio charges per call + recording
   - Map to user credits in cost_credits field
   - Review monthly Twilio bill

---

**Version**: 1.0  
**Last Updated**: March 28, 2026
