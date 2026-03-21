import { BaseRepository } from "./base.repository";
import { Pool } from "pg";
import { logger } from "../utils/logger";

export interface CallSession {
  id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  status: string;
  direction: string;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  recording_url?: string;
  recording_sid?: string;
  transcript?: string;
  ai_response?: string;
  metadata: Record<string, any>;
  retry_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export type CallSessionStatus = 
  | "initiated" 
  | "ringing" 
  | "in-progress" 
  | "recording" 
  | "processing" 
  | "completed" 
  | "failed" 
  | "no-answer";

export class CallSessionRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(callSid: string, fromNumber: string, toNumber: string, direction: string = "inbound"): Promise<CallSession> {
    const result = await this.queryOne<CallSession>(
      `INSERT INTO call_sessions (call_sid, from_number, to_number, direction, status)
       VALUES ($1, $2, $3, $4, 'initiated')
       RETURNING *`,
      [callSid, fromNumber, toNumber, direction]
    );
    if (!result) throw new Error("Failed to create call session");
    logger.info("Call session created", { callSid, fromNumber, direction });
    return result;
  }

  async findByCallSid(callSid: string): Promise<CallSession | null> {
    return this.queryOne<CallSession>(
      "SELECT * FROM call_sessions WHERE call_sid = $1",
      [callSid]
    );
  }

  async updateStatus(callSid: string, status: CallSessionStatus, metadata?: Record<string, any>): Promise<CallSession | null> {
    const updates: string[] = ["status = $2", "updated_at = NOW()"];
    const values: any[] = [callSid, status];
    let paramIndex = 3;

    if (status === "in-progress") {
      updates.push(`answered_at = NOW()`);
    }
    if (status === "completed" || status === "failed") {
      updates.push(`ended_at = NOW()`);
    }
    if (metadata) {
      updates.push(`metadata = metadata || $${paramIndex}::jsonb`);
      values.push(JSON.stringify(metadata));
      paramIndex++;
    }

    return this.queryOne<CallSession>(
      `UPDATE call_sessions SET ${updates.join(", ")} WHERE call_sid = $1 RETURNING *`,
      values
    );
  }

  async setRecording(callSid: string, recordingUrl: string, recordingSid: string, duration: number): Promise<CallSession | null> {
    return this.queryOne<CallSession>(
      `UPDATE call_sessions 
       SET recording_url = $2, recording_sid = $3, duration_seconds = $4, status = 'processing', updated_at = NOW()
       WHERE call_sid = $1 RETURNING *`,
      [callSid, recordingUrl, recordingSid, duration]
    );
  }

  async setTranscriptAndResponse(callSid: string, transcript: string, aiResponse: string): Promise<CallSession | null> {
    return this.queryOne<CallSession>(
      `UPDATE call_sessions 
       SET transcript = $2, ai_response = $3, status = 'completed', updated_at = NOW()
       WHERE call_sid = $1 RETURNING *`,
      [callSid, transcript, aiResponse]
    );
  }

  async incrementRetry(callSid: string, error: string): Promise<CallSession | null> {
    return this.queryOne<CallSession>(
      `UPDATE call_sessions 
       SET retry_count = retry_count + 1, last_error = $2, updated_at = NOW()
       WHERE call_sid = $1 RETURNING *`,
      [callSid, error]
    );
  }

  async getActiveSessions(): Promise<CallSession[]> {
    return this.queryMany<CallSession>(
      `SELECT * FROM call_sessions 
       WHERE status NOT IN ('completed', 'failed') 
       ORDER BY started_at DESC`
    );
  }

  async getSessionsByPhone(phoneNumber: string, limit: number = 50): Promise<CallSession[]> {
    return this.queryMany<CallSession>(
      `SELECT * FROM call_sessions 
       WHERE from_number = $1 
       ORDER BY started_at DESC 
       LIMIT $2`,
      [phoneNumber, limit]
    );
  }

  async getSessionStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    failed: number;
    avgDuration: number;
  }> {
    const result = await this.queryOne<any>(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status NOT IN ('completed', 'failed') THEN 1 END) as active,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COALESCE(AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL), 0) as avg_duration
       FROM call_sessions`
    );

    return {
      total: parseInt(result?.total ?? 0, 10),
      active: parseInt(result?.active ?? 0, 10),
      completed: parseInt(result?.completed ?? 0, 10),
      failed: parseInt(result?.failed ?? 0, 10),
      avgDuration: parseFloat(result?.avg_duration ?? 0)
    };
  }
}
