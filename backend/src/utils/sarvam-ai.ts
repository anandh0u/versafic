/**
 * Sarvam AI Integration
 * Speech-to-Text and Text-to-Speech utilities
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from './logger';

export interface SarvamSTTRequest {
  audio: string; // Base64 encoded audio
  language_code?: string;
}

export interface SarvamSTTResponse {
  status: string;
  transcript: string;
  confidence?: number;
}

export interface SarvamTTSRequest {
  inputs: Array<{
    source_lang: string;
    target_lang: string;
    speaker: string;
    text: string;
  }>;
}

export interface SarvamTTSResponse {
  status: string;
  audio?: string; // Base64 encoded audio
}

export class SarvamAIClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl = 'https://api.sarvam.ai/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || '';

    if (!this.apiKey) {
      logger.warn('Sarvam AI API key not configured');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'API-Subscription-Key': this.apiKey
      },
      timeout: 30000
    });
  }

  /**
   * Convert speech to text
   */
  async speechToText(
    audioBase64: string,
    languageCode: string = 'en-IN'
  ): Promise<SarvamSTTResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Sarvam AI API key not configured');
      }

      const response = await this.client.post<SarvamSTTResponse>('/speech-to-text', {
        audio: audioBase64,
        language_code: languageCode
      });

      logger.info('Sarvam STT successful', {
        transcript: response.data.transcript?.substring(0, 50),
        confidence: response.data.confidence
      });

      return response.data;
    } catch (error) {
      logger.error('Sarvam STT failed', error instanceof Error ? error : new Error(String(error)));
      throw new Error(`Speech-to-text conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(
    text: string,
    sourceLang: string = 'en',
    targetLang: string = 'en',
    speaker: string = 'default'
  ): Promise<SarvamTTSResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Sarvam AI API key not configured');
      }

      const response = await this.client.post<SarvamTTSResponse>('/text-to-speech', {
        inputs: [
          {
            source_lang: sourceLang,
            target_lang: targetLang,
            speaker: speaker,
            text: text
          }
        ]
      });

      logger.info('Sarvam TTS successful', {
        textLength: text.length,
        speaker: speaker
      });

      return response.data;
    } catch (error) {
      logger.error('Sarvam TTS failed', error instanceof Error ? error : new Error(String(error)));
      throw new Error(`Text-to-speech conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect language
   */
  async detectLanguage(audioBase64: string): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('Sarvam AI API key not configured');
      }

      const response = await this.client.post<{ language_code: string }>('/language-detection', {
        audio: audioBase64
      });

      return response.data.language_code;
    } catch (error) {
      logger.error('Language detection failed', error instanceof Error ? error : new Error(String(error)));
      return 'en-IN'; // Default to English
    }
  }

  /**
   * Batch speech to text
   */
  async batchSpeechToText(
    audioBase64Array: string[],
    languageCode: string = 'en-IN'
  ): Promise<SarvamSTTResponse[]> {
    const results: SarvamSTTResponse[] = [];

    for (const audio of audioBase64Array) {
      try {
        const result = await this.speechToText(audio, languageCode);
        results.push(result);
      } catch (error) {
        logger.error('Batch STT error for one audio', error instanceof Error ? error : new Error(String(error)));
        results.push({
          status: 'error',
          transcript: '',
          confidence: 0
        });
      }
    }

    return results;
  }
}

// Singleton instance
let sarvamInstance: SarvamAIClient | null = null;

/**
 * Get or create Sarvam AI client
 */
export const getSarvamAIClient = (): SarvamAIClient => {
  if (!sarvamInstance) {
    sarvamInstance = new SarvamAIClient();
  }
  return sarvamInstance;
};
