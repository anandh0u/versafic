import { pool } from "../../config/database";
import { BaseRepository } from "../../repositories/base.repository";
import { normalizePhoneNumber } from "../../utils/validators";

export interface ExotelBusiness {
  id: string;
  name: string;
  ai_prompt: string | null;
  phone_number: string | null;
}

export interface ExotelCallSession {
  id: string;
  session_id: string | null;
  call_sid: string | null;
  customer_number: string | null;
  business_id: string | null;
  status: string;
  direction: string;
  type: string;
  provider: string;
  provider_status: string | null;
  route_source: string | null;
  from_number: string;
  to_number: string;
  phone_number: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  provider_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CreateExotelSessionInput {
  sessionId: string;
  callSid?: string | null;
  userId?: number | null;
  customerNumber: string;
  businessId: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  direction: "inbound" | "outbound";
  type: "incoming" | "outgoing";
  routeSource: "session" | "mapping" | "default";
  providerStatus?: string | null;
  metadata?: Record<string, unknown>;
  providerPayload?: Record<string, unknown>;
}

interface UpdateExotelSessionInput {
  callSid?: string | null;
  businessId?: string | null;
  customerNumber?: string | null;
  status?: string;
  providerStatus?: string | null;
  routeSource?: string | null;
  recordingUrl?: string | null;
  durationSeconds?: number | null;
  metadata?: Record<string, unknown>;
  providerPayload?: Record<string, unknown>;
  lastError?: string | null;
}

export interface CustomerBusinessMappingRecord {
  customer_phone: string;
  business_id: string;
  last_interaction: string;
  business_name: string;
  ai_prompt: string | null;
  phone_number: string | null;
}

class ExotelRepository extends BaseRepository {
  constructor() {
    super(pool);
  }

  async findBusinessById(businessId: string): Promise<ExotelBusiness | null> {
    return this.queryOne<ExotelBusiness>(
      `SELECT
         id,
         COALESCE(NULLIF(name, ''), business_name, owner_name, email, 'Business') AS name,
         ai_prompt,
         COALESCE(NULLIF(phone_number, ''), phone) AS phone_number
       FROM businesses
       WHERE id = $1
       LIMIT 1`,
      [businessId]
    );
  }

  async findBusinessByEmail(email: string): Promise<ExotelBusiness | null> {
    return this.queryOne<ExotelBusiness>(
      `SELECT
         id,
         COALESCE(NULLIF(name, ''), business_name, owner_name, email, 'Business') AS name,
         ai_prompt,
         COALESCE(NULLIF(phone_number, ''), phone) AS phone_number
       FROM businesses
       WHERE LOWER(COALESCE(email, '')) = LOWER($1)
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [email]
    );
  }

  async createSession(input: CreateExotelSessionInput): Promise<ExotelCallSession> {
    const result = await this.queryOne<ExotelCallSession>(
      `INSERT INTO call_sessions (
         session_id,
         call_sid,
         user_id,
         customer_number,
         business_id,
         status,
         direction,
         type,
         from_number,
         to_number,
         phone_number,
         provider,
         provider_status,
         route_source,
         metadata,
         provider_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'exotel', $12, $13, $14::jsonb, $15::jsonb)
       RETURNING *`,
      [
        input.sessionId,
        input.callSid ?? null,
        input.userId ?? null,
        input.customerNumber,
        input.businessId,
        input.status,
        input.direction,
        input.type,
        input.fromNumber,
        input.toNumber,
        input.customerNumber,
        input.providerStatus ?? null,
        input.routeSource,
        JSON.stringify(input.metadata || {}),
        JSON.stringify(input.providerPayload || {}),
      ]
    );

    if (!result) {
      throw new Error("Failed to create Exotel session");
    }

    return result;
  }

  async findSessionBySessionId(sessionId: string): Promise<ExotelCallSession | null> {
    return this.queryOne<ExotelCallSession>(
      `SELECT * FROM call_sessions WHERE session_id = $1 AND provider = 'exotel' LIMIT 1`,
      [sessionId]
    );
  }

  async findSessionByCallId(callId: string): Promise<ExotelCallSession | null> {
    return this.queryOne<ExotelCallSession>(
      `SELECT * FROM call_sessions WHERE call_sid = $1 AND provider = 'exotel' LIMIT 1`,
      [callId]
    );
  }

  async updateSessionBySessionId(sessionId: string, input: UpdateExotelSessionInput): Promise<ExotelCallSession | null> {
    return this.updateSession("session_id", sessionId, input);
  }

  async updateSessionByCallId(callId: string, input: UpdateExotelSessionInput): Promise<ExotelCallSession | null> {
    return this.updateSession("call_sid", callId, input);
  }

  private async updateSession(
    lookupColumn: "session_id" | "call_sid",
    lookupValue: string,
    input: UpdateExotelSessionInput
  ): Promise<ExotelCallSession | null> {
    const updates: string[] = ["updated_at = NOW()"];
    const values: Array<string | number | null> = [lookupValue];
    let index = 2;

    if (input.callSid !== undefined) {
      updates.push(`call_sid = $${index++}`);
      values.push(input.callSid);
    }

    if (input.businessId !== undefined) {
      updates.push(`business_id = $${index++}`);
      values.push(input.businessId);
    }

    if (input.customerNumber !== undefined) {
      updates.push(`customer_number = $${index++}`);
      values.push(input.customerNumber);
      updates.push(`phone_number = $${index++}`);
      values.push(input.customerNumber);
    }

    if (input.status !== undefined) {
      updates.push(`status = $${index++}`);
      values.push(input.status);

      if (input.status === "active") {
        updates.push("answered_at = COALESCE(answered_at, NOW())");
      }

      if (["completed", "failed", "no-answer"].includes(input.status)) {
        updates.push("ended_at = COALESCE(ended_at, NOW())");
      }
    }

    if (input.providerStatus !== undefined) {
      updates.push(`provider_status = $${index++}`);
      values.push(input.providerStatus);
    }

    if (input.routeSource !== undefined) {
      updates.push(`route_source = $${index++}`);
      values.push(input.routeSource);
    }

    if (input.recordingUrl !== undefined) {
      updates.push(`recording_url = $${index++}`);
      values.push(input.recordingUrl);
    }

    if (input.durationSeconds !== undefined) {
      updates.push(`duration_seconds = $${index++}`);
      values.push(input.durationSeconds);
    }

    if (input.lastError !== undefined) {
      updates.push(`last_error = $${index++}`);
      values.push(input.lastError);
    }

    if (input.metadata) {
      updates.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${index++}::jsonb`);
      values.push(JSON.stringify(input.metadata));
    }

    if (input.providerPayload) {
      updates.push(`provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $${index++}::jsonb`);
      values.push(JSON.stringify(input.providerPayload));
    }

    return this.queryOne<ExotelCallSession>(
      `UPDATE call_sessions
       SET ${updates.join(", ")}
       WHERE ${lookupColumn} = $1 AND provider = 'exotel'
       RETURNING *`,
      values
    );
  }

  async touchCustomerBusinessMapping(customerPhone: string, businessId: string): Promise<void> {
    const normalizedPhone = normalizePhoneNumber(customerPhone);
    await this.query(
      `INSERT INTO customer_business_mapping (customer_phone, business_id, last_interaction)
       VALUES ($1, $2, NOW())
       ON CONFLICT (customer_phone, business_id)
       DO UPDATE SET
         last_interaction = EXCLUDED.last_interaction,
         updated_at = NOW()`,
      [normalizedPhone, businessId]
    );
  }

  async findLatestCustomerBusinessMapping(customerPhone: string): Promise<CustomerBusinessMappingRecord | null> {
    const normalizedPhone = normalizePhoneNumber(customerPhone);
    return this.queryOne<CustomerBusinessMappingRecord>(
      `SELECT
         cbm.customer_phone,
         cbm.business_id,
         cbm.last_interaction,
         COALESCE(NULLIF(b.name, ''), b.business_name, b.owner_name, b.email, 'Business') AS business_name,
         b.ai_prompt,
         COALESCE(NULLIF(b.phone_number, ''), b.phone) AS phone_number
       FROM customer_business_mapping cbm
       INNER JOIN businesses b ON b.id = cbm.business_id
       WHERE cbm.customer_phone = $1
       ORDER BY cbm.last_interaction DESC
       LIMIT 1`,
      [normalizedPhone]
    );
  }

  async saveRecording(params: {
    callId: string;
    recordingUrl: string;
    businessId: string | null;
    customerNumber: string;
    durationSeconds: number;
  }): Promise<void> {
    await this.query(
      `INSERT INTO call_recordings (
         call_sid,
         call_id,
         phone_number,
         recording_url,
         duration,
         business_id
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (call_sid)
       DO UPDATE SET
         call_id = EXCLUDED.call_id,
         phone_number = EXCLUDED.phone_number,
         recording_url = EXCLUDED.recording_url,
         duration = EXCLUDED.duration,
         business_id = COALESCE(EXCLUDED.business_id, call_recordings.business_id),
         updated_at = NOW()`,
      [
        params.callId,
        params.callId,
        params.customerNumber,
        params.recordingUrl,
        params.durationSeconds,
        params.businessId,
      ]
    );
  }
}

export const exotelRepository = new ExotelRepository();
