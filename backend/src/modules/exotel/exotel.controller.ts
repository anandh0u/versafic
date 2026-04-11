import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/error-handler";
import type { AuthRequest } from "../../middleware/jwt-auth";
import { ErrorCode } from "../../types";
import { getOptionalEnv } from "../../utils/env";
import { exotelService } from "./exotel.service";

const getValue = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const getOptionalInternalApiKey = (): string => getOptionalEnv("EXOTEL_INTERNAL_API_KEY");

const enforceInternalApiKeyIfConfigured = (req: Request): void => {
  const configuredKey = getOptionalInternalApiKey();
  if (!configuredKey) {
    return;
  }

  const providedKey = req.get("x-api-key");
  if (!providedKey || providedKey !== configuredKey) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, "Unauthorized call start request");
  }
};

export const startExotelCall = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      enforceInternalApiKeyIfConfigured(req);
    }

    const customerNumber = getValue(req.body?.customer_number);
    const businessId = getValue(req.body?.business_id);

    if (!customerNumber) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "customer_number is required");
    }

    const result = await exotelService.startCall({
      customerNumber,
      businessId: businessId ?? null,
      ownerUserId: req.user ? Number(req.user.id) : null,
      ownerEmail: req.user?.email ?? null,
    });

    res.status(201).json({
      status: "success",
      statusCode: 201,
      message: "Call session created and Exotel outbound call initiated",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const handleExotelIncoming = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = getValue(
      req.query?.session_id,
      req.body?.session_id,
      req.body?.CustomField,
      req.body?.custom_field
    );
    const callId = getValue(req.body?.CallSid, req.body?.call_sid, req.query?.call_id);
    const customerNumber = getValue(
      req.body?.From,
      req.body?.from,
      req.body?.Caller,
      req.body?.customer_number,
      req.query?.customer_number
    );

    const routing = await exotelService.resolveIncomingCall({
      sessionId: sessionId ?? null,
      callId: callId ?? null,
      customerNumber: customerNumber ?? null,
      payload: req.body as Record<string, unknown>,
    });

    res.status(200).type("text/xml").send(exotelService.buildIncomingXml(routing));
  } catch (error) {
    next(error);
  }
};

export const handleExotelRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = getValue(
      req.query?.session_id,
      req.body?.session_id,
      req.body?.CustomField,
      req.body?.custom_field
    );
    const callId = getValue(req.body?.CallSid, req.body?.call_sid, req.query?.call_id);
    const customerNumber = getValue(
      req.body?.From,
      req.body?.from,
      req.body?.customer_number,
      req.query?.customer_number
    );
    const recordingUrl = getValue(req.body?.RecordingUrl, req.body?.recording_url, req.query?.recording_url);
    const durationSecondsValue = getValue(req.body?.RecordingDuration, req.body?.Duration, req.body?.duration);
    const durationSeconds = durationSecondsValue ? parseInt(durationSecondsValue, 10) : 0;

    await exotelService.handleRecording({
      sessionId: sessionId ?? null,
      callId: callId ?? null,
      customerNumber: customerNumber ?? null,
      recordingUrl: recordingUrl ?? null,
      durationSeconds,
      payload: req.body as Record<string, unknown>,
    });

    res.status(200).type("text/xml").send(exotelService.buildRecordingAcknowledgementXml());
  } catch (error) {
    next(error);
  }
};

export const handleExotelStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = getValue(
      req.query?.session_id,
      req.body?.session_id,
      req.body?.CustomField,
      req.body?.custom_field
    );
    const callId = getValue(req.body?.CallSid, req.body?.call_sid, req.query?.call_id);
    const status = getValue(req.body?.Status, req.body?.status);
    const recordingUrl = getValue(req.body?.RecordingUrl, req.body?.recording_url);

    await exotelService.handleStatusCallback({
      sessionId: sessionId ?? null,
      callId: callId ?? null,
      status: status ?? null,
      recordingUrl: recordingUrl ?? null,
      payload: req.body as Record<string, unknown>,
    });

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Exotel status processed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const getExotelConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Exotel configuration retrieved",
      data: exotelService.getConfigurationSummary(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
