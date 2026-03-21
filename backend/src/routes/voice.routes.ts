import { Router, Request, Response } from "express";
import { VoiceController } from "../controllers/voice.controller";
import { logger } from "../utils/logger";

const router = Router();

/**
 * POST /voice/process
 * Process voice input through the full pipeline
 * - Speech to text
 * - Intent understanding
 * - Data extraction
 * - AI response generation
 * - Text to speech
 */
router.post("/process", async (req: Request, res: Response) => {
  try {
    await VoiceController.processVoice(req, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Voice process route error", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * POST /voice/stt
 * Convert speech to text only
 */
router.post("/stt", async (req: Request, res: Response) => {
  try {
    await VoiceController.speechToText(req, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Voice STT route error", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * POST /voice/tts
 * Convert text to speech only
 */
router.post("/tts", async (req: Request, res: Response) => {
  try {
    await VoiceController.textToSpeech(req, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Voice TTS route error", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * GET /voice/conversations/phone/:phone
 * Get conversations by phone number
 */
router.get("/conversations/phone/:phone", async (req: Request, res: Response) => {
  try {
    await VoiceController.getConversationsByPhone(req, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Voice conversations route error", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * GET /voice/statistics
 * Get voice interaction statistics
 */
router.get("/statistics", async (req: Request, res: Response) => {
  try {
    await VoiceController.getStatistics(req, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Voice statistics route error", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

export default router;
