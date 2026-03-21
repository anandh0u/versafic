import { callSessionRepo, CallSessionRepository } from "../repositories";
import type { CallSession, CallSessionStatus } from "../repositories/call-session.repository";
import { logger } from "../utils/logger";
import { metrics } from "../utils/metrics";

interface RecordingCallbackData {
  callSid: string;
  recordingSid: string;
  recordingUrl: string;
  recordingDuration: number;
}

export class CallSessionService {
  constructor(private repo: CallSessionRepository = callSessionRepo) {}

  async initiateSession(callSid: string, from: string, to: string, direction: string = "inbound"): Promise<CallSession> {
    logger.info("Initiating call session", { callSid, from, to, direction });
    metrics.trackCallEvent("initiated");
    metrics.setGauge("calls.active", (await this.repo.getActiveSessions()).length);

    try {
      const session = await this.repo.create(callSid, from, to, direction);
      logger.info("Call session created", { callSid, sessionId: session.id });
      return session;
    } catch (error) {
      logger.error("Failed to create call session", error instanceof Error ? error : new Error(String(error)), { callSid });
      throw error;
    }
  }

  async updateSessionStatus(callSid: string, status: CallSessionStatus, metadata?: Record<string, unknown>): Promise<CallSession | null> {
    logger.info("Updating call session status", { callSid, status });
    metrics.trackCallEvent(status);

    const session = await this.repo.updateStatus(callSid, status, metadata);
    if (!session) {
      logger.warn("Call session not found for status update", { callSid, status });
    }
    return session;
  }

  async handleRecordingCallback(data: RecordingCallbackData, maxRetries: number = 3): Promise<CallSession | null> {
    const { callSid, recordingSid, recordingUrl, recordingDuration } = data;
    logger.info("Processing recording callback", { callSid, recordingSid, duration: recordingDuration });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const session = await this.repo.setRecording(callSid, recordingUrl, recordingSid, recordingDuration);
        if (session) {
          metrics.trackCallEvent("recording_received");
          logger.info("Recording saved successfully", { callSid, recordingSid, attempt });
          return session;
        }

        logger.warn("Session not found for recording", { callSid, attempt });
        return null;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await this.repo.incrementRetry(callSid, errorMsg);

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          logger.warn("Recording callback failed, retrying", {
            callSid,
            attempt,
            maxRetries,
            nextRetryMs: delay,
            error: errorMsg
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          metrics.trackCallEvent("recording_failed");
          logger.error("Recording callback permanently failed",
            error instanceof Error ? error : new Error(errorMsg),
            { callSid, attempts: attempt }
          );
          await this.updateSessionStatus(callSid, "failed");
          throw error;
        }
      }
    }
    return null;
  }

  async completeSession(callSid: string, transcript?: string, aiResponse?: string): Promise<CallSession | null> {
    logger.info("Completing call session", { callSid });

    if (transcript && aiResponse) {
      await this.repo.setTranscriptAndResponse(callSid, transcript, aiResponse);
    }

    const session = await this.repo.updateStatus(callSid, "completed");
    if (session) {
      metrics.trackCallEvent("completed");
      const duration = session.duration_seconds ?? 0;
      metrics.recordHistogram("calls.duration_seconds", duration);
      logger.info("Call session completed", { callSid, duration });
    }
    return session;
  }

  async failSession(callSid: string, error: string): Promise<CallSession | null> {
    logger.error("Call session failed", new Error(error), { callSid });
    metrics.trackCallEvent("failed");
    return this.repo.updateStatus(callSid, "failed", { error });
  }

  async getSession(callSid: string): Promise<CallSession | null> {
    return this.repo.findByCallSid(callSid);
  }

  async getActiveSessions(): Promise<CallSession[]> {
    return this.repo.getActiveSessions();
  }

  async getSessionHistory(phoneNumber: string, limit: number = 50): Promise<CallSession[]> {
    return this.repo.getSessionsByPhone(phoneNumber, limit);
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    failed: number;
    avgDuration: number;
  }> {
    return this.repo.getSessionStats();
  }
}

export const callSessionService = new CallSessionService();
