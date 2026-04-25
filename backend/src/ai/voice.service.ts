import { logger } from "../utils/logger";
import { sarvamProvider } from "./providers/sarvam.provider";
import { aiService } from "./ai.service";

export interface VoiceProcessingResult {
  success: boolean;
  name?: string;
  phone?: string;
  email?: string;
  request?: string;
  ai_response?: string;
  audio_response?: string; // Base64 encoded audio
  error?: string;
  raw_transcript?: string;
}

class VoiceService {
  /**
   * Main voice processing pipeline:
   * Audio -> STT -> Intent Understanding -> Data Extraction -> AI Response -> TTS
   */
  async processVoiceInput(
    audioBase64: string,
    language?: string
  ): Promise<VoiceProcessingResult> {
    try {
      if (!audioBase64) {
        return {
          success: false,
          error: "Audio data is required"
        };
      }

      logger.info("Starting voice processing pipeline");

      // Step 1: Speech to Text
      logger.debug("Step 1: Converting speech to text");
      const sttResult = await sarvamProvider.speechToText(
        audioBase64,
        language || "en-IN"
      );

      if (!sttResult.success || !sttResult.data) {
        logger.warn("STT failed, returning error response");
        return {
          success: false,
          error: "Sorry, I didn't catch that. Could you please repeat?",
          raw_transcript: ""
        };
      }

      const transcript = sttResult.data;
      logger.debug("Speech to text result", { transcript });

      // Step 2: Understand Intent and Extract Data
      logger.debug("Step 2: Understanding intent and extracting data");
      const intentResult = await aiService.understandIntent(transcript);
      const extractResult = await aiService.extractStructuredData(transcript);

      const extractedData = extractResult.data || {};
      const intent = intentResult.intent || "General inquiry";

      logger.debug("Intent and data extraction result", {
        intent,
        extractedData
      });

      // Step 3: Generate AI Response
      logger.debug("Step 3: Generating AI response");
      const aiResponseResult =
        await aiService.generateCustomerServiceResponse(transcript);

      if (!aiResponseResult.success || !aiResponseResult.response) {
        logger.warn("AI response generation failed");
        return {
          success: false,
          error: "Sorry, I couldn't process your request. Please try again.",
          raw_transcript: transcript,
          ...extractedData
        };
      }

      const aiResponse = aiResponseResult.response;
      logger.debug("AI response generated", { aiResponse });

      // Step 4: Text to Speech
      logger.debug("Step 4: Converting response to speech");
      let audioResponse: string | undefined;

      if (sarvamProvider.isAvailable()) {
        const ttsResult = await sarvamProvider.textToSpeech(
          aiResponse,
          language || "en-IN"
        );

        if (ttsResult.success && ttsResult.data) {
          audioResponse = ttsResult.data;
          logger.debug("Text to speech successful");
        } else {
          logger.warn("Text to speech failed, continuing without audio");
        }
      } else {
        logger.warn("Sarvam provider not available for TTS");
      }

      // Return complete result
      const result: VoiceProcessingResult = {
        success: true,
        name: extractedData.name || "",
        phone: extractedData.phone || "",
        email: extractedData.email || "",
        request: extractedData.request || "",
        ai_response: aiResponse,
        audio_response: audioResponse || "",
        raw_transcript: transcript
      };

      logger.info("Voice processing completed successfully", {
        hasName: !!result.name,
        hasPhone: !!result.phone,
        hasEmail: !!result.email
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Voice processing pipeline error", err);
      return {
        success: false,
        error: "Sorry, something went wrong. Please try again."
      };
    }
  }

  /**
   * Convert audio to text only (STT)
   */
  async speechToText(
    audioBase64: string,
    language?: string
  ): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      if (!sarvamProvider.isAvailable()) {
        return {
          success: false,
          error: "Speech to text service is not available"
        };
      }

      const result = await sarvamProvider.speechToText(
        audioBase64,
        language || "en-IN"
      );

      if (result.success && result.data) {
        return {
          success: true,
          text: result.data
        };
      }

      return {
        success: false,
        error: result.error || "Failed to convert speech to text"
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("STT error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Convert text to audio only (TTS)
   */
  async textToSpeech(
    text: string,
    language?: string
  ): Promise<{ success: boolean; audio?: string; error?: string }> {
    try {
      if (!sarvamProvider.isAvailable()) {
        return {
          success: false,
          error: "Text to speech service is not available"
        };
      }

      const result = await sarvamProvider.textToSpeech(text, language || "en-IN");

      if (result.success && result.data) {
        return {
          success: true,
          audio: result.data
        };
      }

      return {
        success: false,
        error: result.error || "Failed to convert text to speech"
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("TTS error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Check if voice services are available
   */
  isAvailable(): boolean {
    return sarvamProvider.isAvailable();
  }
}

// Export singleton
export const voiceService = new VoiceService();
