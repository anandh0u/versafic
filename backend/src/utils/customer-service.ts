/**
 * Customer Service Manager
 * Orchestrates conversation flow between Sarvam AI and OpenAI
 */

import { randomUUID } from 'crypto';
import { logger } from './logger';
import { getSarvamAIClient } from './sarvam-ai';
import { getOpenAIClient, ChatMessage } from './openai-client';

export interface CustomerServiceContext {
  sessionId: string;
  conversationHistory: ChatMessage[];
  customerData: {
    name?: string;
    phone?: string;
    email?: string;
    request?: string;
  };
  sentiment: 'positive' | 'negative' | 'neutral';
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerServiceRequest {
  audioBase64?: string; // Raw speech audio
  textMessage?: string; // Customer message
  languageCode?: string;
  sessionId?: string;
}

export interface CustomerServiceResponse {
  success: boolean;
  sessionId: string;
  customerMessage: string;
  aiResponse: string;
  audioResponse?: string; // Base64 encoded TTS audio
  extractedData?: {
    name?: string;
    phone?: string;
    email?: string;
    request?: string;
  };
  sentiment: 'positive' | 'negative' | 'neutral';
  isResolved: boolean;
  error?: string;
}

export class CustomerServiceManager {
  private sessions = new Map<string, CustomerServiceContext>();
  private sarvam = getSarvamAIClient();
  private openai = getOpenAIClient();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  /**
   * Create new customer service session
   */
  createSession(): string {
    const sessionId = randomUUID();

    this.sessions.set(sessionId, {
      sessionId,
      conversationHistory: [],
      customerData: {},
      sentiment: 'neutral',
      isResolved: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    logger.info('Customer service session created', { sessionId });

    return sessionId;
  }

  /**
   * Get session by ID
   */
  private getSession(sessionId: string): CustomerServiceContext {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check if session expired
    const elapsed = Date.now() - session.updatedAt.getTime();
    if (elapsed > this.sessionTimeout) {
      this.sessions.delete(sessionId);
      throw new Error(`Session expired: ${sessionId}`);
    }

    return session;
  }

  /**
   * Process customer request (speech or text)
   */
  async processCustomerRequest(
    request: CustomerServiceRequest
  ): Promise<CustomerServiceResponse> {
    try {
      let sessionId = request.sessionId || this.createSession();
      const session = this.getSession(sessionId);

      // Step 1: Convert audio to text if provided
      let customerMessage = request.textMessage || '';

      if (request.audioBase64) {
        logger.info('Converting speech to text', { sessionId });
        const sttResponse = await this.sarvam.speechToText(
          request.audioBase64,
          request.languageCode
        );

        customerMessage = sttResponse.transcript;

        if (!customerMessage) {
          throw new Error('Failed to transcribe audio');
        }
      }

      if (!customerMessage) {
        throw new Error('No customer message or audio provided');
      }

      logger.info('Customer message received', { sessionId, message: customerMessage.substring(0, 50) });

      // Step 2: Extract structured data
      const extractedData = await this.openai.extractCustomerData(customerMessage);

      if (extractedData.name) session.customerData.name = extractedData.name;
      if (extractedData.phone) session.customerData.phone = extractedData.phone;
      if (extractedData.email) session.customerData.email = extractedData.email;
      if (extractedData.request) session.customerData.request = extractedData.request;

      // Step 3: Analyze sentiment
      session.sentiment = await this.openai.analyzeSentiment(customerMessage);

      // Step 4: Generate AI response
      const aiResponseData = await this.openai.generateCustomerServiceResponse(
        customerMessage,
        session.conversationHistory
      );

      const aiResponse = aiResponseData.message;

      // Step 5: Convert response to speech
      let audioResponse: string | undefined;
      try {
        const ttsResponse = await this.sarvam.textToSpeech(
          aiResponse,
          'en',
          'en',
          'default'
        );
        audioResponse = ttsResponse.audio;
      } catch (error) {
        logger.warn('TTS conversion failed, continuing without audio', { sessionId });
        audioResponse = undefined;
      }

      // Step 6: Update conversation history
      session.conversationHistory.push(
        { role: 'user', content: customerMessage },
        { role: 'assistant', content: aiResponse }
      );

      // Step 7: Check if resolved
      if (
        extractedData.name &&
        extractedData.phone &&
        extractedData.request &&
        !['sorry', 'not sure', 'help', 'need'].some(word =>
          aiResponse.toLowerCase().includes(word)
        )
      ) {
        session.isResolved = true;
      }

      session.updatedAt = new Date();

      const response: CustomerServiceResponse = {
        success: true,
        sessionId,
        customerMessage,
        aiResponse,
        ...(audioResponse ? { audioResponse } : {}),
        extractedData,
        sentiment: session.sentiment,
        isResolved: session.isResolved
      } as CustomerServiceResponse;

      logger.info('Customer service request processed successfully', {
        sessionId,
        sentiment: session.sentiment,
        isResolved: session.isResolved
      });

      return response;
    } catch (error) {
      logger.error('Customer service request failed', error instanceof Error ? error : new Error(String(error)));

      return {
        success: false,
        sessionId: request.sessionId || '',
        customerMessage: request.textMessage || '',
        aiResponse: 'Sorry, I encountered an error. Please try again.',
        sentiment: 'neutral',
        isResolved: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get session history
   */
  getSessionHistory(sessionId: string): ChatMessage[] {
    const session = this.getSession(sessionId);
    return session.conversationHistory;
  }

  /**
   * Get session data
   */
  getSessionData(sessionId: string): {
    name?: string;
    phone?: string;
    email?: string;
    request?: string;
  } {
    const session = this.getSession(sessionId);
    return session.customerData;
  }

  /**
   * End session
   */
  endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.info('Customer service session ended', { sessionId });
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.updatedAt.getTime() > this.sessionTimeout) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired sessions`);
    }

    return cleaned;
  }
}

// Singleton instance
let managerInstance: CustomerServiceManager | null = null;

/**
 * Get or create customer service manager
 */
export const getCustomerServiceManager = (): CustomerServiceManager => {
  if (!managerInstance) {
    managerInstance = new CustomerServiceManager();

    // Cleanup expired sessions every 5 minutes
    setInterval(() => {
      managerInstance!.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  return managerInstance;
};
