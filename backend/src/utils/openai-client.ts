/**
 * OpenAI Integration
 * Chat and intelligence generation
 */

import OpenAI from 'openai';
import { logger } from './logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  message: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
}

export class OpenAIClient {
  private client: OpenAI;
  private model: string = 'gpt-3.5-turbo';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;

    if (!key) {
      logger.warn('OpenAI API key not configured');
    }

    this.client = new OpenAI({
      apiKey: key,
      timeout: 30000
    });
  }

  /**
   * Set the model to use
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Generate a chat response
   */
  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: 0.7,
        max_tokens: 500
      });

      const message = response.choices[0]?.message?.content || '';

      logger.info('OpenAI chat response generated', {
        model: this.model,
        tokens: response.usage?.total_tokens
      });

      return {
        message,
        tokens: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0
        },
        model: response.model
      };
    } catch (error) {
      logger.error('OpenAI chat failed', error instanceof Error ? error : new Error(String(error)));
      throw new Error(`Chat generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a customer service response
   */
  async generateCustomerServiceResponse(
    customerMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatResponse> {
    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `You are a professional AI customer service assistant. Your responsibilities:
1. Understand the customer's request clearly
2. Respond politely and professionally
3. Thank the customer for their information
4. Ask for missing details when necessary
5. Keep responses short and clear (1-2 sentences max)

Tone: polite, helpful, professional, conversational`
    };

    const userMessage: ChatMessage = {
      role: 'user',
      content: customerMessage
    };

    const messages = [systemPrompt, ...conversationHistory, userMessage];

    return this.chat(messages);
  }

  /**
   * Extract structured data from customer message
   */
  async extractCustomerData(customerMessage: string): Promise<{
    name?: string;
    phone?: string;
    email?: string;
    request?: string;
  }> {
    try {
      const response = await this.chat([
        {
          role: 'system',
          content: `Extract customer information from the message. Return ONLY a JSON object with these fields:
{ "name": "", "phone": "", "email": "", "request": "" }
If a field is not mentioned, leave it empty string.`
        },
        {
          role: 'user',
          content: customerMessage
        }
      ]);

      try {
        return JSON.parse(response.message);
      } catch {
        return { request: customerMessage };
      }
    } catch (error) {
      logger.error('Data extraction failed', error instanceof Error ? error : new Error(String(error)));
      return { request: customerMessage };
    }
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(text: string): Promise<'positive' | 'negative' | 'neutral'> {
    try {
      const response = await this.chat([
        {
          role: 'system',
          content: `Analyze the sentiment of the text. Respond with ONLY one word: positive, negative, or neutral`
        },
        {
          role: 'user',
          content: text
        }
      ]);

      const sentiment = response.message.toLowerCase().trim();

      if (sentiment.includes('positive')) return 'positive';
      if (sentiment.includes('negative')) return 'negative';
      return 'neutral';
    } catch (error) {
      logger.error('Sentiment analysis failed', error instanceof Error ? error : new Error(String(error)));
      return 'neutral';
    }
  }

  /**
   * Generate summary
   */
  async generateSummary(text: string, maxLength: number = 100): Promise<string> {
    try {
      const response = await this.chat([
        {
          role: 'system',
          content: `Summarize the text in maximum ${maxLength} characters. Be concise.`
        },
        {
          role: 'user',
          content: text
        }
      ]);

      return response.message.substring(0, maxLength);
    } catch (error) {
      logger.error('Summary generation failed', error instanceof Error ? error : new Error(String(error)));
      return text.substring(0, maxLength);
    }
  }
}

// Singleton instance
let openaiInstance: OpenAIClient | null = null;

/**
 * Get or create OpenAI client
 */
export const getOpenAIClient = (): OpenAIClient => {
  if (!openaiInstance) {
    openaiInstance = new OpenAIClient();
  }
  return openaiInstance;
};
