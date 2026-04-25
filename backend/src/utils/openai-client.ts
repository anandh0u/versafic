/**
 * OpenAI Integration
 * Chat and intelligence generation
 */

import OpenAI from 'openai';
import { logger } from './logger';
import { isPlaceholderEnvValue } from './env';

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

const FALLBACK_MODEL = 'fallback-rule-engine';

const inferIntentFromText = (text: string): string => {
  const normalized = text.toLowerCase();

  if (normalized.includes('book') || normalized.includes('appointment') || normalized.includes('reserve')) {
    return 'booking';
  }
  if (normalized.includes('price') || normalized.includes('cost') || normalized.includes('plan')) {
    return 'pricing';
  }
  if (normalized.includes('refund') || normalized.includes('cancel')) {
    return 'refund';
  }
  if (normalized.includes('support') || normalized.includes('issue') || normalized.includes('problem') || normalized.includes('error')) {
    return 'support';
  }

  return 'general';
};

const buildFallbackMessage = (text: string): string => {
  switch (inferIntentFromText(text)) {
    case 'booking':
      return 'I can help with your booking request. Please share the preferred date, time, and any key details so I can guide the next step.';
    case 'pricing':
      return 'I can help with pricing details. Please tell me which service or plan you want, and I will guide you further.';
    case 'refund':
      return 'I can help with cancellation or refund guidance. Please share the relevant booking or payment detail so I can point you to the next step.';
    case 'support':
      return 'I can help with this support issue. Please describe the problem you are facing so I can guide you clearly.';
    default:
      return 'Thank you for reaching out. I can help with support, bookings, pricing, and general enquiries. Please share a little more detail so I can guide the next step.';
  }
};

const extractCustomerDataFallback = (customerMessage: string) => {
  const email = customerMessage.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = customerMessage.match(/(?:\+?\d[\d\s\-()]{8,}\d)/)?.[0] || '';

  return {
    name: '',
    phone: phone.trim(),
    email: email.toLowerCase(),
    request: customerMessage.trim(),
  };
};

export class OpenAIClient {
  private client: OpenAI;
  private model: string = 'gpt-3.5-turbo';
  private apiKeyConfigured: boolean;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    this.apiKeyConfigured = !isPlaceholderEnvValue(key);

    if (!this.apiKeyConfigured) {
      logger.warn('OpenAI API key not configured');
    }

    this.client = new OpenAI({
      apiKey: this.apiKeyConfigured ? key : undefined,
      timeout: 30000
    });
  }

  /**
   * Set the model to use
   */
  setModel(model: string): void {
    this.model = model;
  }

  isConfigured(): boolean {
    return this.apiKeyConfigured;
  }

  /**
   * Generate a chat response
   */
  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content || '';

    try {
      if (!this.isConfigured()) {
        return {
          message: buildFallbackMessage(lastUserMessage),
          tokens: {
            prompt: 0,
            completion: 0,
            total: 0,
          },
          model: FALLBACK_MODEL,
        };
      }

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
      return {
        message: buildFallbackMessage(lastUserMessage),
        tokens: {
          prompt: 0,
          completion: 0,
          total: 0,
        },
        model: FALLBACK_MODEL,
      };
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
      if (!this.isConfigured()) {
        return extractCustomerDataFallback(customerMessage);
      }

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
        return extractCustomerDataFallback(customerMessage);
      }
    } catch (error) {
      logger.error('Data extraction failed', error instanceof Error ? error : new Error(String(error)));
      return extractCustomerDataFallback(customerMessage);
    }
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(text: string): Promise<'positive' | 'negative' | 'neutral'> {
    try {
      if (!this.isConfigured()) {
        const normalized = text.toLowerCase();
        if (/(happy|great|good|thanks|thank you|awesome)/.test(normalized)) return 'positive';
        if (/(bad|angry|issue|problem|refund|cancel|complaint)/.test(normalized)) return 'negative';
        return 'neutral';
      }

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
