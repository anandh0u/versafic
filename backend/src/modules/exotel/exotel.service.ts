import axios, { AxiosError } from "axios";
import { randomUUID } from "crypto";
import { getPublicUrl } from "../../config/database";
import { AppError } from "../../middleware/error-handler";
import { ErrorCode } from "../../types";
import { getOptionalEnv, isPlaceholderEnvValue } from "../../utils/env";
import { logger } from "../../utils/logger";
import { normalizePhoneNumber } from "../../utils/validators";
import {
  exotelRepository,
  type ExotelBusiness,
  type ExotelCallSession,
} from "./exotel.repository";

type StartCallInput = {
  customerNumber: string;
  businessId?: string | null;
  ownerUserId?: number | null;
  ownerEmail?: string | null;
};

type IncomingWebhookInput = {
  sessionId?: string | null;
  callId?: string | null;
  customerNumber?: string | null;
  payload: Record<string, unknown>;
};

type RecordingWebhookInput = {
  sessionId?: string | null;
  callId?: string | null;
  customerNumber?: string | null;
  recordingUrl?: string | null;
  durationSeconds?: number | null;
  payload: Record<string, unknown>;
};

type StatusWebhookInput = {
  sessionId?: string | null;
  callId?: string | null;
  status?: string | null;
  recordingUrl?: string | null;
  payload: Record<string, unknown>;
};

type ResolvedCallRouting = {
  sessionId: string | null;
  session: ExotelCallSession | null;
  business: ExotelBusiness | null;
  routeSource: "session" | "mapping" | "default";
};

type StartCallResult = {
  session_id: string;
  call_id: string | null;
  business_id: string;
  customer_number: string;
  status: string;
  provider: "exotel";
  callback_url: string;
  status_callback_url: string;
};

const DEFAULT_EXOTEL_API_BASE_URL = "https://api.in.exotel.com";
const DEFAULT_UNKNOWN_BUSINESS_MESSAGE =
  "Hello. We could not identify the correct business for this call right now. Please try again from your latest business interaction.";
const EXOTEL_NUMBER_FALLBACK = "unknown-exotel-number";
const APP_NAME = process.env.APP_NAME || "Versafic";

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const appendQueryParams = (baseUrl: string, params: Record<string, string | undefined | null>): string => {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

const mapExotelStatus = (status?: string | null): string => {
  const normalized = String(status || "").trim().toLowerCase();
  switch (normalized) {
    case "queued":
    case "initiated":
    case "ringing":
      return "initiated";
    case "in-progress":
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "no-answer":
      return "no-answer";
    case "busy":
    case "failed":
      return "failed";
    default:
      return "initiated";
  }
};

const formatExotelDialNumber = (phone: string): string => {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `0${digits.slice(2)}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return digits;
  }

  if (digits.length === 10) {
    return `0${digits}`;
  }

  if (phone.startsWith("+")) {
    return `+${digits}`;
  }

  return digits;
};

const getExotelProviderMessage = (providerDetails: unknown): string => {
  const restMessage =
    typeof providerDetails === "object" &&
    providerDetails &&
    "RestException" in providerDetails &&
    typeof (providerDetails as { RestException?: { Message?: unknown } }).RestException?.Message === "string"
      ? (providerDetails as { RestException: { Message: string } }).RestException.Message
      : typeof providerDetails === "string"
        ? providerDetails
        : "Failed to initiate Exotel outbound call";

  const normalized = restMessage.toLowerCase();

  if (normalized.includes("kyc compliant")) {
    return "Exotel outbound calling is blocked until the Exotel account KYC is completed.";
  }

  if (normalized.includes("bad or missing parameters")) {
    return "Exotel rejected the call request. Check the Exotel number, flow URL, and outbound call parameters.";
  }

  return restMessage;
};

class ExotelService {
  private readonly sid = getOptionalEnv("EXOTEL_SID");
  private readonly apiKey = getOptionalEnv("EXOTEL_API_KEY");
  private readonly apiToken = getOptionalEnv("EXOTEL_API_TOKEN");
  private readonly rawExotelNumber = getOptionalEnv("EXOTEL_NUMBER");
  private readonly exotelNumber = normalizePhoneNumber(this.rawExotelNumber) || EXOTEL_NUMBER_FALLBACK;
  private readonly apiBaseUrl = getOptionalEnv("EXOTEL_API_BASE_URL", DEFAULT_EXOTEL_API_BASE_URL).replace(/\/$/, "");
  private readonly configuredFlowUrl = getOptionalEnv("EXOTEL_CALL_FLOW_URL");
  private readonly defaultMessage =
    getOptionalEnv("EXOTEL_DEFAULT_MESSAGE") || DEFAULT_UNKNOWN_BUSINESS_MESSAGE;

  private ensureConfigured(): void {
    const requiredValues = [this.sid, this.apiKey, this.apiToken, this.rawExotelNumber];
    if (requiredValues.some((value) => !value || isPlaceholderEnvValue(value))) {
      throw new AppError(
        503,
        ErrorCode.SERVICE_UNAVAILABLE,
        "Exotel is not configured. Set EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, and EXOTEL_NUMBER."
      );
    }
  }

  private getConnectEndpoint(): string {
    return `${this.apiBaseUrl}/v1/Accounts/${encodeURIComponent(this.sid)}/Calls/connect.json`;
  }

  private getIncomingCallbackUrl(sessionId: string): string {
    if (this.configuredFlowUrl) {
      return this.configuredFlowUrl;
    }

    return appendQueryParams(getPublicUrl("/exotel/incoming"), { session_id: sessionId });
  }

  private getStatusCallbackUrl(sessionId: string): string {
    return appendQueryParams(getPublicUrl("/exotel/status"), { session_id: sessionId });
  }

  private getRecordingActionUrl(sessionId: string | null): string {
    return appendQueryParams(getPublicUrl("/exotel/recording"), { session_id: sessionId || undefined });
  }

  private buildBusinessMessage(business: ExotelBusiness): string {
    return `Hello, this is AI assistant for ${business.name}. Please tell your request after the beep.`;
  }

  getConfigurationSummary() {
    const configured = Boolean(
      this.sid &&
        this.apiKey &&
        this.apiToken &&
        this.rawExotelNumber &&
        !isPlaceholderEnvValue(this.sid) &&
        !isPlaceholderEnvValue(this.apiKey) &&
        !isPlaceholderEnvValue(this.apiToken) &&
        !isPlaceholderEnvValue(this.rawExotelNumber)
    );

    return {
      configured,
      provider: "exotel",
      ai_number: configured ? this.exotelNumber : null,
      call_credit_cost: 20,
      account_mode: "live",
      demo_mode: false,
      cooldown_enabled: false,
      daily_limit_enabled: false,
      app_name: APP_NAME,
      intro_message: `Hello, this is an AI assistant from ${APP_NAME}.`,
      trial_guidance: configured
        ? "The AI number is connected through Exotel."
        : "Exotel is not configured yet.",
      webhooks: {
        incoming: getPublicUrl("/exotel/incoming"),
        status: getPublicUrl("/exotel/status"),
        recording: getPublicUrl("/exotel/recording"),
      },
      provider_base_url: this.apiBaseUrl,
    };
  }

  buildIncomingXml(routing: ResolvedCallRouting): string {
    if (!routing.business || !routing.sessionId) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(this.defaultMessage)}</Say>
</Response>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(this.buildBusinessMessage(routing.business))}</Say>
  <Record maxLength="30" action="${escapeXml(this.getRecordingActionUrl(routing.sessionId))}" method="POST" />
</Response>`;
  }

  buildRecordingAcknowledgementXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you. We are processing your request.</Say>
</Response>`;
  }

  async startCall(input: StartCallInput): Promise<StartCallResult> {
    this.ensureConfigured();

    const customerNumber = normalizePhoneNumber(input.customerNumber);
    if (!customerNumber) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "customer_number is required");
    }

    const business = input.businessId
      ? await exotelRepository.findBusinessById(input.businessId)
      : input.ownerEmail
        ? await exotelRepository.findBusinessByEmail(input.ownerEmail)
        : null;

    if (!business) {
      throw new AppError(
        404,
        ErrorCode.NOT_FOUND,
        input.businessId
          ? "Business not found for the given business_id"
          : "Business profile not found for the current account"
      );
    }

    const sessionId = randomUUID();
    const callbackUrl = this.getIncomingCallbackUrl(sessionId);
    const statusCallbackUrl = this.getStatusCallbackUrl(sessionId);
    const exotelCustomerNumber = formatExotelDialNumber(customerNumber);
    const exotelCallerId = formatExotelDialNumber(this.exotelNumber);

    await exotelRepository.createSession({
      sessionId,
      customerNumber,
      userId: input.ownerUserId ?? null,
      businessId: business.id,
      fromNumber: this.exotelNumber,
      toNumber: customerNumber,
      status: "initiated",
      direction: "outbound",
      type: "outgoing",
      routeSource: "session",
      providerStatus: "queued",
      metadata: {
        business_name: business.name,
        ai_prompt_present: Boolean(business.ai_prompt),
      },
      providerPayload: {
        provider: "exotel",
        callback_url: callbackUrl,
        status_callback_url: statusCallbackUrl,
        exotel_from: exotelCustomerNumber,
        exotel_caller_id: exotelCallerId,
      },
    });

    const payload = new URLSearchParams({
      From: exotelCustomerNumber,
      CallerId: exotelCallerId,
      CallType: getOptionalEnv("EXOTEL_CALL_TYPE", "trans"),
      Url: callbackUrl,
      StatusCallback: statusCallbackUrl,
      CustomField: sessionId,
      TimeLimit: getOptionalEnv("EXOTEL_TIME_LIMIT_SECONDS", "180"),
      TimeOut: getOptionalEnv("EXOTEL_TIMEOUT_SECONDS", "30"),
    });

    try {
      const response = await axios.post(this.getConnectEndpoint(), payload.toString(), {
        auth: {
          username: this.apiKey,
          password: this.apiToken,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        timeout: 15000,
      });

      const providerCallId = response.data?.Call?.Sid || null;
      const providerStatus = String(response.data?.Call?.Status || "queued");

      await exotelRepository.updateSessionBySessionId(sessionId, {
        callSid: providerCallId,
        status: mapExotelStatus(providerStatus),
        providerStatus,
        providerPayload: {
          outbound_connect_response: response.data,
        },
      });

      await exotelRepository.touchCustomerBusinessMapping(customerNumber, business.id);

      logger.info("Exotel outbound call initiated", {
        sessionId,
        businessId: business.id,
        customerNumber,
        callId: providerCallId,
      });

      return {
        session_id: sessionId,
        call_id: providerCallId,
        business_id: business.id,
        customer_number: customerNumber,
        status: mapExotelStatus(providerStatus),
        provider: "exotel",
        callback_url: callbackUrl,
        status_callback_url: statusCallbackUrl,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const providerDetails = axiosError.response?.data || axiosError.message;
      const providerMessage = getExotelProviderMessage(providerDetails);

      await exotelRepository.updateSessionBySessionId(sessionId, {
        status: "failed",
        providerStatus: "failed",
        lastError: typeof providerDetails === "string" ? providerDetails : JSON.stringify(providerDetails),
        providerPayload: {
          outbound_connect_error: providerDetails,
        },
      });

      logger.error("Exotel outbound call initiation failed", error instanceof Error ? error : new Error(String(error)), {
        sessionId,
        businessId: business.id,
        customerNumber,
      });

      throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, providerMessage, providerDetails);
    }
  }

  async resolveIncomingCall(input: IncomingWebhookInput): Promise<ResolvedCallRouting> {
    const normalizedCustomerNumber = input.customerNumber ? normalizePhoneNumber(input.customerNumber) : null;

    let session = input.sessionId ? await exotelRepository.findSessionBySessionId(input.sessionId) : null;
    let business = session?.business_id ? await exotelRepository.findBusinessById(session.business_id) : null;
    let routeSource: ResolvedCallRouting["routeSource"] = "default";
    let effectiveSessionId = session?.session_id || input.sessionId || null;

    if (session && business) {
      routeSource = "session";
    } else if (normalizedCustomerNumber) {
      const mapping = await exotelRepository.findLatestCustomerBusinessMapping(normalizedCustomerNumber);
      if (mapping) {
        routeSource = "mapping";
        business = {
          id: mapping.business_id,
          name: mapping.business_name,
          ai_prompt: mapping.ai_prompt,
          phone_number: mapping.phone_number,
        };

        if (!session) {
          effectiveSessionId = effectiveSessionId || randomUUID();
          session = await exotelRepository.createSession({
            sessionId: effectiveSessionId,
            callSid: input.callId || null,
            customerNumber: normalizedCustomerNumber,
            businessId: mapping.business_id,
            fromNumber: normalizedCustomerNumber,
            toNumber: this.exotelNumber,
            status: "active",
            direction: "inbound",
            type: "incoming",
            routeSource: "mapping",
            providerStatus: "in-progress",
            metadata: {
              created_from: "incoming_webhook",
            },
            providerPayload: input.payload,
          });
        }
      }
    }

    if (session && effectiveSessionId) {
      await exotelRepository.updateSessionBySessionId(effectiveSessionId, {
        callSid: input.callId || session.call_sid,
        customerNumber: normalizedCustomerNumber || session.customer_number,
        businessId: business?.id || session.business_id,
        status: business ? "active" : session.status,
        providerStatus: input.callId ? "in-progress" : null,
        routeSource,
        providerPayload: input.payload,
      });
    }

    if (business && normalizedCustomerNumber) {
      await exotelRepository.touchCustomerBusinessMapping(normalizedCustomerNumber, business.id);
    }

    logger.info("Exotel incoming call routed", {
      sessionId: effectiveSessionId,
      callId: input.callId,
      customerNumber: normalizedCustomerNumber,
      businessId: business?.id,
      routeSource,
    });

    return {
      sessionId: effectiveSessionId,
      session,
      business,
      routeSource,
    };
  }

  async handleRecording(input: RecordingWebhookInput): Promise<{ sessionId: string | null; businessId: string | null }> {
    const session =
      (input.sessionId ? await exotelRepository.findSessionBySessionId(input.sessionId) : null) ||
      (input.callId ? await exotelRepository.findSessionByCallId(input.callId) : null);

    const recordingUrl = input.recordingUrl || null;
    const durationSeconds = Math.max(Number(input.durationSeconds || 0), 0);

    if (!session) {
      logger.warn("Exotel recording callback received without matching session", {
        sessionId: input.sessionId,
        callId: input.callId,
      });

      return {
        sessionId: input.sessionId || null,
        businessId: null,
      };
    }

    if (!recordingUrl || !session.call_sid) {
      if (session.session_id) {
        await exotelRepository.updateSessionBySessionId(session.session_id, {
          providerPayload: input.payload,
        });
      }

      return {
        sessionId: session.session_id,
        businessId: session.business_id,
      };
    }

    await exotelRepository.saveRecording({
      callId: session.call_sid,
      recordingUrl,
      businessId: session.business_id,
      customerNumber: session.customer_number || input.customerNumber || session.phone_number || "",
      durationSeconds,
    });

    if (session.session_id) {
      await exotelRepository.updateSessionBySessionId(session.session_id, {
        status: "completed",
        providerStatus: "recording-received",
        recordingUrl,
        durationSeconds,
        metadata: {
          speech_to_text_status: "pending_integration",
        },
        providerPayload: input.payload,
      });
    }

    if (session.customer_number && session.business_id) {
      await exotelRepository.touchCustomerBusinessMapping(session.customer_number, session.business_id);
    }

    logger.info("Exotel recording stored", {
      sessionId: session.session_id,
      callId: session.call_sid,
      businessId: session.business_id,
      recordingUrl,
    });

    return {
      sessionId: session.session_id,
      businessId: session.business_id,
    };
  }

  async handleStatusCallback(input: StatusWebhookInput): Promise<void> {
    const normalizedStatus = mapExotelStatus(input.status);
    const session =
      (input.sessionId ? await exotelRepository.findSessionBySessionId(input.sessionId) : null) ||
      (input.callId ? await exotelRepository.findSessionByCallId(input.callId) : null);

    if (!session) {
      logger.warn("Exotel status callback received without matching session", {
        sessionId: input.sessionId,
        callId: input.callId,
        status: input.status,
      });
      return;
    }

    if (session.session_id) {
      await exotelRepository.updateSessionBySessionId(session.session_id, {
        callSid: input.callId || session.call_sid,
        status: normalizedStatus,
        providerStatus: input.status || null,
        recordingUrl: input.recordingUrl || session.recording_url,
        providerPayload: input.payload,
      });
    }

    logger.info("Exotel call status updated", {
      sessionId: session.session_id,
      callId: input.callId || session.call_sid,
      status: normalizedStatus,
    });
  }
}

export const exotelService = new ExotelService();
