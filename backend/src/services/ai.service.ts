// src/services/ai.service.ts
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import * as ChatModel from '../models/chat.model';
import { walletService } from './wallet.service';
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
  let creditsCharged = false;

  try {
    // Validate input
    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (userMessage.length > 10000) {
      throw new Error('Message is too long (max 10,000 characters)');
    }

    const chargeResult = await walletService.deductCreditsForUsage(
      userId,
      'ai_chat',
      'AI chat request',
      creditReference,
      CREDIT_COSTS.AI_CHAT_MESSAGE
    );

    if (!chargeResult.success) {
      throw new AppError(
        402,
        ErrorCode.INSUFFICIENT_CREDITS,
        chargeResult.autopay?.requires_user_action
          ? 'Insufficient credits. A compliant autopay checkout has been created and is waiting for user confirmation.'
          : 'Insufficient credits for this AI request.'
      );
    }

    creditsCharged = true;

    logger.info('Processing AI request', { userId, messageLength: userMessage.length });

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
    const assistantMessage = aiResponse.choices[0]?.message?.content || '';
    const tokensUsed = aiResponse.usage?.total_tokens || 0;

    if (!assistantMessage) {
      throw new Error('Empty response from AI');
    }

    // Save to database
    await ChatModel.saveChatMessage(userId, userMessage, assistantMessage, tokensUsed);

    logger.info('AI request completed successfully', {
      userId,
      tokensUsed,
      messageLength: assistantMessage.length
    });

    return {
      message: assistantMessage,
      tokensUsed,
      model: MODEL
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('AI service error', error instanceof Error ? error : new Error(errorMessage));

    if (!(error instanceof AppError) && creditsCharged) {
      try {
        await walletService.refundCredits(
          userId,
          CREDIT_COSTS.AI_CHAT_MESSAGE,
          creditReference,
          'Refunded AI request credits after an unsuccessful model call.'
        );
      } catch (refundError) {
        logger.warn('Failed to refund AI credits after error', {
          userId,
          error: refundError instanceof Error ? refundError.message : String(refundError)
        });
      }
    }

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
