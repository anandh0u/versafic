import { voiceJobQueue } from "../utils/job-queue";
import { logger } from "../utils/logger";
import { metrics } from "../utils/metrics";
import { sarvamProvider } from "./providers/sarvam.provider";
import { aiService } from "./ai.service";
import { EventEmitter } from "events";

export interface VoiceProcessingRequest {
  audioUrl?: string | undefined;
  audioBase64?: string | undefined;
  language?: string | undefined;
  callSid?: string | undefined;
  userId?: number | undefined;
  businessId?: number | undefined;
}

export interface VoiceProcessingResult {
  transcript: string;
  intent: string;
  aiResponse: string;
  audioResponseBase64: string;
  processingTimeMs: number;
  provider: string;
}

type StatusCallback = (
  jobId: string,
  status: string,
  result?: VoiceProcessingResult | undefined,
  error?: string | undefined,
) => void;

class EnhancedVoiceService extends EventEmitter {
  private statusCallbacks: Map<string, StatusCallback> = new Map();

  constructor() {
    super();
    this.registerJobHandlers();
    this.setupEventForwarding();
  }

  private registerJobHandlers(): void {
    voiceJobQueue.registerHandler<VoiceProcessingRequest>("voice_processing", async (data) => {
      const startTime = Date.now();

      logger.info("Voice processing started", {
        callSid: data.callSid,
        language: data.language,
      });

      try {
        // Step 1: Speech-to-Text
        const transcript = await this.speechToText(data);

        // Step 2: AI Processing (intent + response)
        const aiResult = await this.processWithAI(transcript);

        // Step 3: Text-to-Speech (response)
        const audioResponse = await this.textToSpeech(aiResult.response, data.language);

        const processingTimeMs = Date.now() - startTime;

        metrics.recordHistogram("voice.processing_time_ms", processingTimeMs);
        metrics.incrementCounter("voice.completed");

        const result: VoiceProcessingResult = {
          transcript,
          intent: aiResult.intent,
          aiResponse: aiResult.response,
          audioResponseBase64: audioResponse,
          processingTimeMs,
          provider: "sarvam+openai",
        };

        return result;
      } catch (error) {
        metrics.incrementCounter("voice.failed");
        throw error;
      }
    });
  }

  private setupEventForwarding(): void {
    voiceJobQueue.on("job:completed", (event: { jobId: string; result: unknown }) => {
      const cb = this.statusCallbacks.get(event.jobId);
      if (cb) {
        cb(event.jobId, "completed", event.result as VoiceProcessingResult);
        this.statusCallbacks.delete(event.jobId);
      }
    });

    voiceJobQueue.on("job:failed", (event: { jobId: string; error: string }) => {
      const cb = this.statusCallbacks.get(event.jobId);
      if (cb) {
        cb(event.jobId, "failed", undefined, event.error);
        this.statusCallbacks.delete(event.jobId);
      }
    });
  }

  async processVoice(
    request: VoiceProcessingRequest,
    callback?: StatusCallback,
  ): Promise<string> {
    const jobId = await voiceJobQueue.addJob("voice_processing", request, {
      priority: request.callSid ? 10 : 1,
      maxRetries: 2,
      timeoutMs: 60000,
    });

    if (callback) {
      this.statusCallbacks.set(jobId, callback);
    }

    return jobId;
  }

  private async speechToText(data: VoiceProcessingRequest): Promise<string> {
    const audio = data.audioBase64 ?? data.audioUrl;
    if (!audio) {
      throw new Error("No audio data provided");
    }

    const result = await sarvamProvider.speechToText(audio, data.language ?? "hi-IN");
    if (!result.success || !result.data) {
      throw new Error(result.error ?? "Speech to text failed");
    }
    return result.data;
  }

  private async processWithAI(transcript: string): Promise<{
    intent: string;
    response: string;
  }> {
    const [intentResult, responseResult] = await Promise.all([
      aiService.understandIntent(transcript),
      aiService.generateCustomerServiceResponse(transcript),
    ]);

    return {
      intent: intentResult.intent ?? "general",
      response: responseResult.response ?? "I couldn't process your request.",
    };
  }

  private async textToSpeech(text: string, language?: string | undefined): Promise<string> {
    const result = await sarvamProvider.textToSpeech(text, language ?? "hi-IN");
    if (!result.success || !result.data) {
      throw new Error(result.error ?? "Text to speech failed");
    }
    return result.data;
  }

  getQueueStats(): { queueSize: number; processing: number; concurrency: number } {
    return voiceJobQueue.getStats();
  }
}

export const enhancedVoiceService = new EnhancedVoiceService();
