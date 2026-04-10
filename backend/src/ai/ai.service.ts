import { logger } from "../utils/logger";
import { openAIProvider } from "./providers/openai.provider";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const extractStructuredDataFallback = (text: string) => {
  const normalized = text.trim();
  const emailMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = normalized.match(/(?:\+?\d[\d\s\-()]{8,}\d)/);
  const extracted: {
    name?: string;
    phone?: string;
    email?: string;
    request?: string;
  } = {};

  const phone = phoneMatch?.[0]?.replace(/\s+/g, " ").trim();
  const email = emailMatch?.[0]?.toLowerCase();

  if (phone) {
    extracted.phone = phone;
  }
  if (email) {
    extracted.email = email;
  }
  if (normalized) {
    extracted.request = normalized;
  }

  return extracted;
};

const understandIntentFallback = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes("book") || normalized.includes("appointment") || normalized.includes("reserve")) {
    return "Booking request";
  }
  if (normalized.includes("price") || normalized.includes("cost") || normalized.includes("plan")) {
    return "Pricing enquiry";
  }
  if (normalized.includes("support") || normalized.includes("issue") || normalized.includes("problem")) {
    return "Support request";
  }
  if (normalized.includes("refund") || normalized.includes("cancel")) {
    return "Refund or cancellation enquiry";
  }
  if (normalized.includes("hours") || normalized.includes("open") || normalized.includes("available")) {
    return "Availability enquiry";
  }

  return "General enquiry";
};

const buildCustomerServiceFallback = (customerMessage: string) => {
  const intent = understandIntentFallback(customerMessage);

  if (intent === "Booking request") {
    return "I can help with your booking request. Please share the preferred date, time, and any important details so I can guide you further.";
  }

  if (intent === "Pricing enquiry") {
    return "I can help with pricing details. Please tell me which service or plan you are asking about, and I will help with the next step.";
  }

  if (intent === "Support request") {
    return "I can help with this support issue. Please share the main problem you are facing so I can guide you clearly.";
  }

  if (intent === "Refund or cancellation enquiry") {
    return "I can help with cancellation or refund guidance. Please share the relevant booking or payment detail so I can point you in the right direction.";
  }

  return "Thank you for reaching out. I can help with support, bookings, pricing, and availability. Please share a little more detail so I can guide the next step.";
};

const buildChatFallback = (userMessage: string) =>
  buildCustomerServiceFallback(userMessage);

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
          success: true,
          response: buildCustomerServiceFallback(customerMessage)
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
        success: true,
        response: buildCustomerServiceFallback(customerMessage)
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("AI service error", err);
      return {
        success: true,
        response: buildCustomerServiceFallback(customerMessage)
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
          success: true,
          data: extractStructuredDataFallback(text)
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
        success: true,
        data: extractStructuredDataFallback(text)
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Data extraction error", err);
      return {
        success: true,
        data: extractStructuredDataFallback(text)
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
          success: true,
          intent: understandIntentFallback(message)
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
        success: true,
        intent: understandIntentFallback(message)
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Intent understanding error", err);
      return {
        success: true,
        intent: understandIntentFallback(message)
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
          success: true,
          response: buildChatFallback(userMessage)
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
        success: true,
        response: buildChatFallback(userMessage)
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Chat error", err);
      return {
        success: true,
        response: buildChatFallback(userMessage)
      };
    }
  }
}

// Export singleton
export const aiService = new AIService();
