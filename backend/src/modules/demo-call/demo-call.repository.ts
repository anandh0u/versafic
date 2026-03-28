import { Pool } from 'pg';
import { BaseRepository } from '../../repositories/base.repository';

export type DemoCallSessionType = 'incoming' | 'outbound';
export type DemoCallSessionStatus = 'completed' | 'blocked';

export interface DemoCallSessionRecord {
  id: string;
  user_id: number;
  from_number: string;
  to_number: string;
  type: DemoCallSessionType;
  message: string;
  status: DemoCallSessionStatus;
  created_at: string;
}

export class DemoCallRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(params: {
    userId: number;
    fromNumber: string;
    toNumber: string;
    type: DemoCallSessionType;
    message: string;
    status: DemoCallSessionStatus;
  }): Promise<DemoCallSessionRecord> {
    const result = await this.queryOne<DemoCallSessionRecord>(
      `INSERT INTO demo_call_sessions (
         user_id,
         from_number,
         to_number,
         type,
         message,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.userId,
        params.fromNumber,
        params.toNumber,
        params.type,
        params.message,
        params.status,
      ]
    );

    if (!result) {
      throw new Error('Failed to create demo call session');
    }

    return result;
  }

  async listByUser(userId: number, limit: number = 12): Promise<DemoCallSessionRecord[]> {
    return this.queryMany<DemoCallSessionRecord>(
      `SELECT *
       FROM demo_call_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  }
}
