import { pool } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { walletService } from '../../services/wallet.service';
import { getOpenAIClient } from '../../utils/openai-client';
import { logger } from '../../utils/logger';
import { ErrorCode } from '../../types';
import {
  DemoCallRepository,
  DemoCallSessionRecord,
  DemoCallSessionType,
} from './demo-call.repository';

const AI_NUMBER = '8281929821';
const CUSTOMER_NUMBER = '9778773149';
const DEMO_CALL_COST = 20;
const demoCallRepository = new DemoCallRepository(pool);

type DemoCallSimulationResult = {
  session: DemoCallSessionRecord;
  balanceCredits: number;
  creditsDeducted: number;
  aiNumber: string;
  customerNumber: string;
};

const fallbackMessages: Record<DemoCallSessionType, string> = {
  outbound:
    'Hello, this is your AI customer assistant. I am calling to confirm your support request and let you know our team is ready to help.',
  incoming:
    'Hello, you have reached the AI customer assistant. I have noted your request and will guide you with the next support step right away.',
};

export class DemoCallService {
  async listSessions(userId: number, limit: number = 12): Promise<DemoCallSessionRecord[]> {
    return demoCallRepository.listByUser(userId, limit);
  }

  async simulateOutboundCall(userId: number): Promise<DemoCallSimulationResult> {
    return this.simulateCall(userId, 'outbound');
  }

  async simulateIncomingCall(userId: number): Promise<DemoCallSimulationResult> {
    return this.simulateCall(userId, 'incoming');
  }

  private async simulateCall(
    userId: number,
    type: DemoCallSessionType
  ): Promise<DemoCallSimulationResult> {
    const fromNumber = type === 'outbound' ? AI_NUMBER : CUSTOMER_NUMBER;
    const toNumber = type === 'outbound' ? CUSTOMER_NUMBER : AI_NUMBER;
    const referenceId = `DEMO-${type.toUpperCase()}-${Date.now()}`;

    const chargeResult = await walletService.deductCreditsForUsage(
      userId,
      type === 'outbound' ? 'outbound_call' : 'inbound_call',
      `Simulated ${type} AI demo call`,
      referenceId,
      DEMO_CALL_COST
    );

    if (!chargeResult.success) {
      const balanceCredits = await walletService.getBalance(userId);
      const blockedSession = await demoCallRepository.create({
        userId,
        fromNumber,
        toNumber,
        type,
        message: 'Call blocked because the wallet has fewer than 20 credits available.',
        status: 'blocked',
      });

      logger.warn('Demo call blocked due to insufficient credits', {
        userId,
        type,
        balanceCredits,
      });

      throw new AppError(
        402,
        ErrorCode.INSUFFICIENT_CREDITS,
        'At least 20 credits are required to simulate a call.'
      );
    }

    const message = await this.generateMessage(type);
    const session = await demoCallRepository.create({
      userId,
      fromNumber,
      toNumber,
      type,
      message,
      status: 'completed',
    });

    logger.info('Demo call simulated successfully', {
      userId,
      type,
      fromNumber,
      toNumber,
      balanceCredits: chargeResult.remaining,
    });

    return {
      session,
      balanceCredits: chargeResult.remaining ?? 0,
      creditsDeducted: DEMO_CALL_COST,
      aiNumber: AI_NUMBER,
      customerNumber: CUSTOMER_NUMBER,
    };
  }

  private async generateMessage(type: DemoCallSessionType): Promise<string> {
    const client = getOpenAIClient();
    const prompt =
      type === 'outbound'
        ? 'Write a polished AI phone call opening for a support follow-up. Mention this is an AI customer assistant. Keep it under 35 words and sound professional.'
        : 'Write a polished AI phone response for answering an incoming customer support call. Mention this is an AI customer assistant. Keep it under 35 words and sound professional.';

    try {
      const response = await client.chat([
        {
          role: 'system',
          content:
            'You are writing a short voice call script for a SaaS demo. Keep the response crisp, clear, human-friendly, and under 35 words.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const message = response.message.replace(/\s+/g, ' ').trim();
      if (!message) {
        return fallbackMessages[type];
      }

      return message;
    } catch (error) {
      logger.warn('Falling back to canned demo call message', {
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      return fallbackMessages[type];
    }
  }
}

export const demoCallService = new DemoCallService();
export const demoCallConfig = {
  aiNumber: AI_NUMBER,
  customerNumber: CUSTOMER_NUMBER,
  creditCost: DEMO_CALL_COST,
};
