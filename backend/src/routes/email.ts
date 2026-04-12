import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/error-handler";
import type { AuthRequest } from "../middleware/jwt-auth";
import { verifyToken } from "../middleware/jwt-auth";
import { ErrorCode } from "../types";
import { emailService } from "../services/email.service";

const router = Router();
const emailDemoWindowMs = 60 * 60 * 1000;
const emailDemoMinIntervalMs = 60 * 1000;
const emailDemoMaxPerWindow = 3;
const emailDemoGuard = new Map<string, { count: number; windowStart: number; lastSentAt: number }>();

const enforceEmailDemoGuard = (userId: string) => {
  const now = Date.now();
  const current = emailDemoGuard.get(userId);

  if (!current || now - current.windowStart >= emailDemoWindowMs) {
    emailDemoGuard.set(userId, { count: 0, windowStart: now, lastSentAt: 0 });
  }

  const next = emailDemoGuard.get(userId)!;
  if (next.lastSentAt && now - next.lastSentAt < emailDemoMinIntervalMs) {
    throw new AppError(429, ErrorCode.FORBIDDEN, "Please wait a minute before sending another demo email.");
  }

  if (next.count >= emailDemoMaxPerWindow) {
    throw new AppError(429, ErrorCode.FORBIDDEN, "Demo email limit reached for this hour.");
  }

  next.count += 1;
  next.lastSentAt = now;
  emailDemoGuard.set(userId, next);
};

router.get("/test", verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "Sign in to send a demo email.");
    }

    enforceEmailDemoGuard(String(req.user.id));

    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const result = await emailService.sendTestEmail(to);

    if (!result.success) {
      return next(new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, result.error || "Failed to send test email"));
    }

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Test email sent successfully",
      data: {
        provider: result.provider,
        id: result.id ?? null,
        recipient: to ?? "MAILGUN_FROM",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
