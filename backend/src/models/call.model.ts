// src/models/call.model.ts - Database model for call recordings
import { pool } from '../config/database';
import { logger } from '../utils/logger';

export interface CallRecording {
  id: number;
  call_sid: string;
  phone_number: string;
  recording_url: string;
  duration: number;
  created_at: string;
  updated_at: string;
}

export const createCallRecording = async (
  callSid: string,
  phoneNumber: string,
  recordingUrl: string,
  duration: number
): Promise<CallRecording> => {
  try {
    const result = await pool.query(
      `INSERT INTO call_recordings (call_sid, phone_number, recording_url, duration, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (call_sid) DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         recording_url = EXCLUDED.recording_url,
         duration = EXCLUDED.duration,
         updated_at = NOW()
       RETURNING id, call_sid, phone_number, recording_url, duration, created_at, updated_at`,
      [callSid, phoneNumber, recordingUrl, duration]
    );

    logger.info('Call recording saved to database', {
      callSid,
      phoneNumber,
      recordingId: result.rows[0].id
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Error creating call recording', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const findCallRecordingByCallSid = async (callSid: string): Promise<CallRecording | null> => {
  try {
    const result = await pool.query(
      'SELECT id, call_sid, phone_number, recording_url, duration, created_at, updated_at FROM call_recordings WHERE call_sid = $1',
      [callSid]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error finding call recording by call SID', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const getCallRecordingsByPhoneNumber = async (phoneNumber: string): Promise<CallRecording[]> => {
  try {
    const result = await pool.query(
      'SELECT id, call_sid, phone_number, recording_url, duration, created_at, updated_at FROM call_recordings WHERE phone_number = $1 ORDER BY created_at DESC',
      [phoneNumber]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting call recordings by phone number', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const getAllCallRecordings = async (limit: number = 50, offset: number = 0): Promise<CallRecording[]> => {
  try {
    const result = await pool.query(
      'SELECT id, call_sid, phone_number, recording_url, duration, created_at, updated_at FROM call_recordings ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting all call recordings', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};
