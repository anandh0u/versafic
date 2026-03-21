import axios from "axios";
import { logger } from "../../utils/logger";

interface SarvamResponse {
  success: boolean;
  data?: string;
  error?: string;
}

class SarvamProvider {
  private apiKey: string;
  private baseURL: string = "https://api.sarvam.ai";

  constructor() {
    this.apiKey = process.env.SARVAM_API_KEY || "";
    if (!this.apiKey) {
      logger.warn("Sarvam API key not configured");
    }
  }

  /**
   * Convert speech to text (STT)
   */
  async speechToText(
    audioBase64: string,
    language: string = "en-IN"
  ): Promise<SarvamResponse> {
    try {
      if (!audioBase64) {
        return {
          success: false,
          error: "Audio data is required"
        };
      }

      const response = await axios.post(
        `${this.baseURL}/speech-to-text`,
        {
          audio: audioBase64,
          language_code: language
        },
        {
          headers: {
            "API-Subscription-Key": this.apiKey,
            "Content-Type": "application/json"
          },
          timeout: 30000
        }
      );

      if (response.data?.transcript) {
        return {
          success: true,
          data: response.data.transcript
        };
      }

      return {
        success: false,
        error: "No transcript in response"
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Speech to text conversion failed");
      logger.error("Sarvam STT error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Convert text to speech (TTS)
   */
  async textToSpeech(
    text: string,
    language: string = "en-IN",
    speaker: string = "default"
  ): Promise<SarvamResponse> {
    try {
      if (!text) {
        return {
          success: false,
          error: "Text is required"
        };
      }

      const response = await axios.post(
        `${this.baseURL}/text-to-speech`,
        {
          text: text,
          language_code: language,
          speaker: speaker
        },
        {
          headers: {
            "API-Subscription-Key": this.apiKey,
            "Content-Type": "application/json"
          },
          timeout: 30000
        }
      );

      if (response.data?.audio) {
        return {
          success: true,
          data: response.data.audio
        };
      }

      return {
        success: false,
        error: "No audio in response"
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Text to speech conversion failed");
      logger.error("Sarvam TTS error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Detect language from audio
   */
  async detectLanguage(audioBase64: string): Promise<SarvamResponse> {
    try {
      if (!audioBase64) {
        return {
          success: false,
          error: "Audio data is required"
        };
      }

      const response = await axios.post(
        `${this.baseURL}/language-detection`,
        {
          audio: audioBase64
        },
        {
          headers: {
            "API-Subscription-Key": this.apiKey,
            "Content-Type": "application/json"
          },
          timeout: 15000
        }
      );

      if (response.data?.language) {
        return {
          success: true,
          data: response.data.language
        };
      }

      return {
        success: false,
        error: "Could not detect language"
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Language detection failed";
      logger.warn("Sarvam language detection error", { error: errorMsg });
      // Don't fail on language detection, just default to en-IN
      return {
        success: true,
        data: "en-IN"
      };
    }
  }

  /**
   * Get available voices/speakers
   */
  async getAvailableVoices(): Promise<SarvamResponse> {
    try {
      const response = await axios.get(`${this.baseURL}/voices`, {
        headers: {
          "API-Subscription-Key": this.apiKey
        },
        timeout: 10000
      });

      if (response.data?.voices) {
        return {
          success: true,
          data: JSON.stringify(response.data.voices)
        };
      }

      return {
        success: false,
        error: "Could not fetch voices"
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to get voices");
      logger.error("Sarvam voices error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton
export const sarvamProvider = new SarvamProvider();
