import { OpenAI } from "openai";
import { logger } from "../../utils/logger";
import { isPlaceholderEnvValue } from "../../utils/env";

interface ExtractedData {
  name?: string;
  phone?: string;
  email?: string;
  request?: string;
}

interface AIResponse {
  success: boolean;
  data?: string;
  extracted?: ExtractedData;
  error?: string;
}

const OPENAI_TIMEOUT_MS = 30000;

class OpenAIProvider {
  private client: OpenAI;
  private model: string = "gpt-3.5-turbo";

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (isPlaceholderEnvValue(apiKey)) {
      logger.warn("OpenAI API key not configured");
    }
    this.client = new OpenAI({ apiKey });
  }

  private async createCompletion(
    params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
  ): Promise<OpenAI.Chat.ChatCompletion> {
    return await Promise.race([
      this.client.chat.completions.create(params, {
        timeout: OPENAI_TIMEOUT_MS
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`OpenAI API timeout after ${OPENAI_TIMEOUT_MS / 1000}s`)), OPENAI_TIMEOUT_MS)
      )
    ]);
  }

  /**
   * Generate a customer service response
   */
  async generateCustomerServiceResponse(
    customerMessage: string,
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<AIResponse> {
    try {
      const messages: any[] = [
        {
          role: "system",
          content: `You are a professional customer service assistant.

Customers speak through voice and their speech is converted to text.

Your responsibilities:
* Understand the customer request
* Respond politely and professionally
* Thank the customer
* Ask for missing information when needed
* Keep answers short and concise (2-3 sentences max)

Tone:
- Polite
- Helpful
- Professional

Always extract and remember customer details from the conversation.`
        }
      ];

      // Add conversation history if provided
      if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory);
      }

      // Add current message
      messages.push({
        role: "user",
        content: customerMessage
      });

      const response = await this.createCompletion({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 200
      });

      const aiResponse =
        response.choices[0]?.message?.content || "I couldn't process that request.";

      return {
        success: true,
        data: aiResponse
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("OpenAI generation error", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Extract structured data from text using OpenAI
   */
  async extractStructuredData(text: string): Promise<AIResponse> {
    try {
      const response = await this.createCompletion({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `Extract customer information from the text. Return ONLY valid JSON with these fields:
{
  "name": "customer name or null",
  "phone": "phone number or null",
  "email": "email address or null",
  "request": "what customer is asking for or null"
}

Be strict - only extract information that is clearly mentioned.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      });

      const content = response.choices[0]?.message?.content || "{}";

      try {
        const extracted = JSON.parse(content);
        return {
          success: true,
          extracted: {
            name: extracted.name || undefined,
            phone: extracted.phone || undefined,
            email: extracted.email || undefined,
            request: extracted.request || undefined
          }
        };
      } catch {
        logger.warn("Failed to parse extracted data JSON", { content });
        return {
          success: false,
          error: "Failed to parse extracted data"
        };
      }
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
   * Understand intent from customer message
   */
  async understandIntent(message: string): Promise<AIResponse> {
    try {
      const response = await this.createCompletion({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `Analyze the customer message and identify the intent. Return a brief intent description.`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.5,
        max_tokens: 50
      });

      const intent = response.choices[0]?.message?.content || "General inquiry";

      return {
        success: true,
        data: intent
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
   * General chat with AI
   */
  async chat(
    userMessage: string,
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<AIResponse> {
    try {
      const messages: any[] = [
        {
          role: "system",
          content: "You are a helpful AI assistant. Provide clear, concise responses."
        }
      ];

      if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory);
      }

      messages.push({
        role: "user",
        content: userMessage
      });

      const response = await this.createCompletion({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      });

      const aiResponse =
        response.choices[0]?.message?.content || "I couldn't process that request.";

      return {
        success: true,
        data: aiResponse
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

  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    return !isPlaceholderEnvValue(process.env.OPENAI_API_KEY);
  }
}

// Export singleton
export const openAIProvider = new OpenAIProvider();
