// src/services/ai.service.ts
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import * as ChatModel from '../models/chat.model';
import { walletService } from './wallet.service';
import { billingModel } from '../models/billing.model';
import { AppError } from '../middleware/error-handler';
import { ErrorCode } from '../types';
import { CREDIT_COSTS } from '../types/billing.types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration
const MODEL = 'gpt-3.5-turbo';
const MAX_TOKENS = 500;
const TEMPERATURE = 0.7;
const REQUEST_TIMEOUT = 30000; // 30 seconds
const FALLBACK_MODEL = 'fallback-rule-engine';

const buildFallbackChatReply = (userMessage: string): string => {
  const normalized = userMessage.trim().toLowerCase();

  if (!normalized) {
    return 'I can help with bookings, support, pricing, hours, and account questions. Tell me what you need and I will guide you.';
  }

  if (normalized.includes('book') || normalized.includes('appointment') || normalized.includes('reserve')) {
    return 'I can help you move forward with a booking or appointment request. Please share your preferred date, time, and any other requirement so I can guide the next step.';
  }

  if (normalized.includes('price') || normalized.includes('cost') || normalized.includes('plan')) {
    return 'I can help with pricing and plan details. Tell me what feature or service you are interested in, and I will help narrow the right option.';
  }

  if (normalized.includes('refund') || normalized.includes('cancel')) {
    return 'I can help with cancellation or refund questions. Please share the relevant booking, payment, or order details so I can point you to the right next step.';
  }

  if (normalized.includes('support') || normalized.includes('issue') || normalized.includes('problem') || normalized.includes('error')) {
    return 'I can help with support issues. Please describe the problem and any error you noticed, and I will help you troubleshoot it step by step.';
  }

  if (normalized.includes('hello') || normalized.includes('hi') || normalized.includes('hey')) {
    return 'Hello. I am here to help with support, bookings, account questions, and service information. What would you like to do today?';
  }

  return 'I understood your request and I can help you continue. Please share a little more detail, such as the service you need, the timing, or the issue you are facing.';
};

const persistChatMessageSafely = async (
  userId: number,
  message: string,
  response: string,
  tokensUsed: number
) => {
  try {
    await ChatModel.saveChatMessage(userId, message, response, tokensUsed);
  } catch (error) {
    logger.warn('Failed to persist chat message, continuing with response delivery', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export interface AIResponse {
  message: string;
  tokensUsed: number;
  model: string;
}

/**
 * Send message to OpenAI and get response
 */
export const sendMessage = async (userId: number, userMessage: string): Promise<AIResponse> => {
  const creditReference = `AI-${userId}-${Date.now()}`;

  try {
    // Validate input
    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (userMessage.length > 10000) {
      throw new Error('Message is too long (max 10,000 characters)');
    }

    // Check credit availability (but don't deduct yet)
    const userWallet = await billingModel.getOrCreateWallet(userId, 0);
    if (userWallet.balance_credits < CREDIT_COSTS.AI_CHAT_MESSAGE) {
      // Attempt autopay before rejecting
      const autopayResult: any = await walletService.triggerAutopay({
        userId,
        triggeredBy: 'manual' as any,
        force: false
      });
      if (!autopayResult?.success || userWallet.balance_credits < CREDIT_COSTS.AI_CHAT_MESSAGE) {
        throw new AppError(
          402,
          ErrorCode.INSUFFICIENT_CREDITS,
          autopayResult?.requires_user_action
            ? 'Insufficient credits. A compliant autopay checkout has been created and is waiting for user confirmation.'
            : 'Insufficient credits for this AI request.'
        );
      }
    }

    logger.info('Processing AI request', { userId, messageLength: userMessage.length });

    let assistantMessage = '';
    let tokensUsed = 0;
    let aiModel = FALLBACK_MODEL;

    if (!process.env.OPENAI_API_KEY) {
      assistantMessage = buildFallbackChatReply(userMessage);
      tokensUsed = 0;
      aiModel = FALLBACK_MODEL;
    } else {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI request timeout after 30 seconds')), REQUEST_TIMEOUT)
        );

        // Call OpenAI API with timeout
        const responsePromise = openai.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant for a business verification platform. Provide clear, concise, and helpful responses.'
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
        });

        const response = await Promise.race([responsePromise, timeoutPromise]);

        const aiResponse = response as OpenAI.Chat.ChatCompletion;
        assistantMessage = aiResponse.choices[0]?.message?.content || '';
        tokensUsed = aiResponse.usage?.total_tokens || 0;
        aiModel = MODEL;

        if (!assistantMessage) {
          throw new Error('Empty response from AI');
        }
      } catch (providerError) {
        // On error, return fallback response without charging
        logger.warn('Primary AI provider failed, returning fallback response', {
          userId,
          error: providerError instanceof Error ? providerError.message : String(providerError),
        });

        assistantMessage = buildFallbackChatReply(userMessage);
        tokensUsed = 0;
        aiModel = FALLBACK_MODEL;
      }
    }

    // NOW deduct credits after successful response generation
    const chargeResult = await walletService.deductCreditsForUsage(
      userId,
      'ai_chat',
      'AI chat request',
      creditReference,
      CREDIT_COSTS.AI_CHAT_MESSAGE
    );

    if (!chargeResult.success) {
      logger.warn('Failed to deduct credits after successful AI response', {
        userId,
        creditReference,
        reason: chargeResult.autopay ? 'Autopay required' : 'Unknown'
      });
      // Still return response even if credit deduction fails - user got the AI response
      // Log this as it indicates wallet issues
    }

    await persistChatMessageSafely(userId, userMessage, assistantMessage, tokensUsed);

    logger.info('AI request completed successfully', {
      userId,
      tokensUsed,
      messageLength: assistantMessage.length
    });

    return {
      message: assistantMessage,
      tokensUsed,
      model: aiModel
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('AI service error', error instanceof Error ? error : new Error(errorMessage));

    // Check for specific error types
    if (errorMessage.includes('timeout')) {
      throw new Error('AI request timed out. Please try again.');
    }

    if (errorMessage.includes('rate limit')) {
      throw new Error('Too many requests. Please wait before trying again.');
    }

    if (errorMessage.includes('invalid API key')) {
      throw new Error('AI service is not properly configured.');
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new Error('Failed to process your request. Please try again.');
  }
};

/**
 * Get chat history for user
 */
export const getChatHistory = async (userId: number, limit: number = 20, offset: number = 0) => {
  try {
    return await ChatModel.getChatHistory(userId, limit, offset);
  } catch (error) {
    logger.error('Error fetching chat history', error instanceof Error ? error : new Error(String(error)));
    throw new Error('Failed to retrieve chat history');
  }
};

/**
 * Get user chat statistics
 */
export const getUserStats = async (userId: number) => {
  try {
    return await ChatModel.getUserChatStats(userId);
  } catch (error) {
    logger.error('Error fetching user stats', error instanceof Error ? error : new Error(String(error)));
    throw new Error('Failed to retrieve user statistics');
  }
};

/**
 * Clear chat history for user
 */
export const clearChatHistory = async (userId: number): Promise<boolean> => {
  try {
    const result = await ChatModel.deleteChatHistory(userId);
    
    if (result) {
      logger.info('Chat history cleared', { userId });
    }
    
    return result;
  } catch (error) {
    logger.error('Error clearing chat history', error instanceof Error ? error : new Error(String(error)));
    throw new Error('Failed to clear chat history');
  }
};
