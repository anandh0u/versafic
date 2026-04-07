import { Request, Response } from "express";
import { voiceService, VoiceProcessingResult } from "../ai/voice.service";
import { conversationService } from "../services/conversation.service";
import { logger } from "../utils/logger";

export class VoiceController {
  /**
   * Process voice input
   * POST /voice/process
   */
  static async processVoice(req: Request, res: Response): Promise<void> {
    try {
      const { audioBase64, language } = req.body;

      if (!audioBase64) {
        res.status(400).json({
          success: false,
          error: "Audio data (audioBase64) is required"
        });
        return;
      }

      logger.info("Processing voice request");

      // Process voice through pipeline
      const voiceResult = await voiceService.processVoiceInput(
        audioBase64,
        language || "en-IN"
      );

      // Store conversation if successful and has all required fields
      if (voiceResult.success && voiceResult.name && voiceResult.phone && voiceResult.email && voiceResult.request) {
        await conversationService.createConversation({
          customer_name: voiceResult.name,
          phone: voiceResult.phone,
          email: voiceResult.email,
          request: voiceResult.request,
          ai_response: voiceResult.ai_response || "",
          transcript: voiceResult.raw_transcript || ""
        });
      }

      // Remove raw transcript from response (internal only)
      const response: VoiceProcessingResult = {
        success: voiceResult.success,
        name: voiceResult.name || "",
        phone: voiceResult.phone || "",
        email: voiceResult.email || "",
        request: voiceResult.request || "",
        ai_response: voiceResult.ai_response || "",
        audio_response: voiceResult.audio_response || "",
        error: voiceResult.error || ""
      };

      res.status(voiceResult.success ? 200 : 400).json(response);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Voice processing error", err);
      res.status(500).json({
        success: false,
        error: "Failed to process voice"
      });
    }
  }

  /**
   * Convert speech to text only
   * POST /voice/stt
   */
  static async speechToText(req: Request, res: Response): Promise<void> {
    try {
      const { audioBase64, language } = req.body;

      if (!audioBase64) {
        res.status(400).json({
          success: false,
          error: "Audio data (audioBase64) is required"
        });
        return;
      }

      logger.info("Processing speech to text request");

      const result = await voiceService.speechToText(
        audioBase64,
        language || "en-IN"
      );

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("STT error", err);
      res.status(500).json({
        success: false,
        error: "Failed to convert speech to text"
      });
    }
  }

  /**
   * Convert text to speech only
   * POST /voice/tts
   */
  static async textToSpeech(req: Request, res: Response): Promise<void> {
    try {
      const { text, language } = req.body;

      if (!text) {
        res.status(400).json({
          success: false,
          error: "Text is required"
        });
        return;
      }

      logger.info("Processing text to speech request");

      const result = await voiceService.textToSpeech(text, language || "en-IN");

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("TTS error", err);
      res.status(500).json({
        success: false,
        error: "Failed to convert text to speech"
      });
    }
  }

  /**
   * Get conversations by phone
   * GET /voice/conversations/phone/:phone
   */
  static async getConversationsByPhone(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.params;

      if (!phone) {
        res.status(400).json({
          success: false,
          error: "Phone number is required"
        });
        return;
      }

      logger.info("Retrieving conversations by phone", { phone });

      const phoneStr = (Array.isArray(phone) ? phone[0] : phone) || "";
      const result = await conversationService.getConversationsByPhone(phoneStr);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error retrieving conversations", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve conversations"
      });
    }
  }

  /**
   * Get recent voice conversations
   * GET /voice/conversations/recent
   */
  static async getRecentConversations(req: Request, res: Response): Promise<void> {
    try {
      const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const limit = Math.min(Math.max(parseInt(String(rawLimit || "25"), 10) || 25, 1), 100);

      logger.info("Retrieving recent conversations", { limit });

      const result = await conversationService.getRecentConversations(limit);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error retrieving recent conversations", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve recent conversations"
      });
    }
  }

  /**
   * Get voice statistics
   * GET /voice/statistics
   */
  static async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Retrieving voice statistics");

      const result = await conversationService.getStatistics();

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error retrieving statistics", err);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve statistics"
      });
    }
  }
}
