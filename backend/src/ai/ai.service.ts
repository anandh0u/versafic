import { logger } from "../utils/logger";
import { openAIProvider } from "./providers/openai.provider";
import { sarvamProvider } from "./providers/sarvam.provider";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

class AIService {
  /**
   * Generate a customer service response from customer message
   */
  async generateCustomerServiceResponse(
    customerMessage: string,
    conversationHistory?: ConversationMessage[]
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      if (!openAIProvider.isAvailable()) {
        return {
          success: false,
          error: "OpenAI provider is not configured"
        };
      }

      const result = await openAIProvider.generateCustomerServiceResponse(
        customerMessage,
        conversationHistory
      );

      if (result.success && result.data) {
        return {
          success: true,
          response: result.data
        };
      }

      return {
        success: false,
        error: result.error || "Failed to generate response"
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("AI service error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Extract structured data from text
   */
  async extractStructuredData(text: string): Promise<{
    success: boolean;
    data?: {
      name?: string;
      phone?: string;
      email?: string;
      request?: string;
    };
    error?: string;
  }> {
    try {
      if (!openAIProvider.isAvailable()) {
        return {
          success: false,
          error: "OpenAI provider is not configured"
        };
      }

      const result = await openAIProvider.extractStructuredData(text);

      if (result.success && result.extracted) {
        return {
          success: true,
          data: result.extracted
        };
      }

      return {
        success: false,
        error: result.error || "Failed to extract data"
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Data extraction error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Understand intent from message
   */
  async understandIntent(message: string): Promise<{
    success: boolean;
    intent?: string;
    error?: string;
  }> {
    try {
      if (!openAIProvider.isAvailable()) {
        return {
          success: false,
          error: "OpenAI provider is not configured"
        };
      }

      const result = await openAIProvider.understandIntent(message);

      if (result.success && result.data) {
        return {
          success: true,
          intent: result.data
        };
      }

      return {
        success: false,
        error: result.error || "Failed to understand intent"
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Intent understanding error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Chat with AI
   */
  async chat(
    userMessage: string,
    conversationHistory?: ConversationMessage[]
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      if (!openAIProvider.isAvailable()) {
        return {
          success: false,
          error: "OpenAI provider is not configured"
        };
      }

      const result = await openAIProvider.chat(userMessage, conversationHistory);

      if (result.success && result.data) {
        return {
          success: true,
          response: result.data
        };
      }

      return {
        success: false,
        error: result.error || "Failed to get response"
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Chat error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

// Export singleton
export const aiService = new AIService();
