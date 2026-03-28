import type { Response, NextFunction } from 'express';
import { AppError } from '../../middleware/error-handler';
import type { AuthRequest } from '../../middleware/jwt-auth';
import { ErrorCode } from '../../types';
import { demoCallConfig, demoCallService } from './demo-call.service';

export const listDemoCallSessions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required'));
    }

    const limit = Math.min(parseInt(String(req.query.limit || '12'), 10) || 12, 30);
    const sessions = await demoCallService.listSessions(Number(req.user.id), limit);

    res.status(200).json({
      status: 'success',
      message: 'Demo call sessions retrieved successfully',
      data: {
        sessions,
        ...demoCallConfig,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const simulateOutboundDemoCall = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required'));
    }

    const result = await demoCallService.simulateOutboundCall(Number(req.user.id));

    res.status(201).json({
      status: 'success',
      message: 'Simulated AI outbound call completed successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const simulateIncomingDemoCall = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required'));
    }

    const result = await demoCallService.simulateIncomingCall(Number(req.user.id));

    res.status(201).json({
      status: 'success',
      message: 'Simulated customer inbound call completed successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
