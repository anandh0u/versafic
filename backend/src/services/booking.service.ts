import { pool } from "../config/database";
import { logger } from "../utils/logger";
import { normalizePhoneNumber } from "../utils/validators";

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface BookingRecord {
  id: string;
  user_id: number | null;
  business_id: string | null;
  source: string;
  source_session_id: string | null;
  source_call_sid: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  service: string;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_at: string | null;
  status: BookingStatus;
  notes: string | null;
  raw_details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingInput {
  userId?: number | null | undefined;
  businessId?: string | null | undefined;
  source?: string | null | undefined;
  sourceSessionId?: string | null | undefined;
  sourceCallSid?: string | null | undefined;
  customerName?: string | null | undefined;
  customerPhone?: string | null | undefined;
  customerEmail?: string | null | undefined;
  service?: string | null | undefined;
  appointmentDate?: string | null | undefined;
  appointmentTime?: string | null | undefined;
  appointmentAt?: string | null | undefined;
  status?: BookingStatus | null | undefined;
  notes?: string | null | undefined;
  rawDetails?: Record<string, unknown> | null | undefined;
}

export interface BookingCaptureInput {
  userId?: number | null | undefined;
  businessId?: string | null | undefined;
  source: string;
  sourceSessionId?: string | null | undefined;
  sourceCallSid?: string | null | undefined;
  customerName?: string | null | undefined;
  customerPhone?: string | null | undefined;
  customerEmail?: string | null | undefined;
  customerText: string;
  aiResponse?: string | null | undefined;
  rawDetails?: Record<string, unknown> | null | undefined;
}

type ParsedBookingIntent = {
  hasIntent: boolean;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  service: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  appointmentAt: string | null;
  notes: string;
  status: BookingStatus;
};

let bookingsTableReady: Promise<void> | null = null;

const BOOKING_TABLE_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    source VARCHAR(40) NOT NULL DEFAULT 'manual',
    source_session_id VARCHAR(255),
    source_call_sid VARCHAR(255),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    service VARCHAR(255) NOT NULL DEFAULT 'Appointment',
    appointment_date DATE,
    appointment_time TIME,
    appointment_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    notes TEXT,
    raw_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_source_session
    ON bookings(source, source_session_id)
    WHERE source_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_user_created
    ON bookings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_business_created
    ON bookings(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_appointment_at
    ON bookings(appointment_at);

CREATE INDEX IF NOT EXISTS idx_bookings_status
    ON bookings(status);
`;

const cleanText = (value?: string | null): string | null => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || null;
};

const normalizeEmail = (value?: string | null): string | null => {
  const email = cleanText(value)?.toLowerCase() || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
};

const clampText = (value: string | null, maxLength: number): string | null => {
  if (!value) {
    return null;
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

const formatServiceLabel = (value?: string | null): string => {
  const service = cleanText(value) || "Appointment";
  return `${service.charAt(0).toUpperCase()}${service.slice(1)}`;
};

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toIsoTime = (hours: number, minutes: number): string => {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
};

const normalizeDateField = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value);
  }

  const text = String(value);
  const isoMatch = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    return isoMatch[0];
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDate(parsed);
  }

  return text.slice(0, 10);
};

const normalizeTimeField = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  const text = String(value);
  const match = text.match(/\d{2}:\d{2}(?::\d{2})?/);
  return match ? match[0].padEnd(8, ":00").slice(0, 8) : text.slice(0, 8);
};

const combineAppointmentAt = (dateValue: string | null, timeValue: string | null): string | null => {
  if (!dateValue || !timeValue) {
    return null;
  }
  return new Date(`${dateValue}T${timeValue}+05:30`).toISOString();
};

const parseDateFromText = (text: string, now = new Date()): string | null => {
  const normalized = text.toLowerCase();

  if (/\btoday\b/.test(normalized)) {
    return toIsoDate(now);
  }

  if (/\btomorrow\b/.test(normalized)) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return toIsoDate(date);
  }

  const numericDate = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numericDate) {
    const day = Number(numericDate[1]);
    const month = Number(numericDate[2]);
    const rawYear = numericDate[3] ? Number(numericDate[3]) : now.getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month - 1) {
      return toIsoDate(date);
    }
  }

  const months: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };
  const monthDate = normalized.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{2,4}))?\b/
  );
  if (monthDate) {
    const day = Number(monthDate[1]);
    const month = months[monthDate[2] || ""];
    const rawYear = monthDate[3] ? Number(monthDate[3]) : now.getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    if (month !== undefined) {
      const date = new Date(year, month, day);
      if (!Number.isNaN(date.getTime()) && date.getDate() === day) {
        return toIsoDate(date);
      }
    }
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayMatch = normalized.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (dayMatch) {
    const targetDay = weekdays.indexOf(dayMatch[2] || "");
    if (targetDay >= 0) {
      const date = new Date(now);
      let offset = targetDay - date.getDay();
      if (offset <= 0 || dayMatch[1]) {
        offset += 7;
      }
      date.setDate(date.getDate() + offset);
      return toIsoDate(date);
    }
  }

  return null;
};

const parseTimeFromText = (text: string): string | null => {
  const normalized = text.toLowerCase();
  const meridianTime = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (meridianTime) {
    let hours = Number(meridianTime[1]);
    const minutes = meridianTime[2] ? Number(meridianTime[2]) : 0;
    const meridian = meridianTime[3];
    if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (meridian === "pm" && hours < 12) {
        hours += 12;
      }
      if (meridian === "am" && hours === 12) {
        hours = 0;
      }
      return toIsoTime(hours, minutes);
    }
  }

  const atTime = normalized.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (atTime) {
    const hours = Number(atTime[1]);
    const minutes = atTime[2] ? Number(atTime[2]) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return toIsoTime(hours, minutes);
    }
  }

  if (/\bmorning\b/.test(normalized)) {
    return "10:00:00";
  }
  if (/\bafternoon\b/.test(normalized)) {
    return "14:00:00";
  }
  if (/\bevening\b/.test(normalized)) {
    return "17:00:00";
  }
  if (/\bnight\b/.test(normalized)) {
    return "19:00:00";
  }

  return null;
};

const extractName = (text: string): string | null => {
  const match = text.match(/\b(?:my name is|this is|i am|i'm)\s+/i);
  if (!match || match.index === undefined) {
    return null;
  }

  const afterPrefix = text.slice(match.index + match[0].length);
  const stopIndex = afterPrefix.search(/[,.!?]|\b(?:please|book|schedule|reserve|appointment)\b/i);
  const candidate = stopIndex >= 0 ? afterPrefix.slice(0, stopIndex) : afterPrefix;
  return clampText(cleanText(candidate), 120);
};

const extractPhone = (text: string): string | null => {
  const match = text.match(/(?:\+?\d[\d\s().-]{8,}\d)/);
  return normalizePhoneNumber(match?.[0] || "") || null;
};

const extractEmail = (text: string): string | null => {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return normalizeEmail(match?.[0] || null);
};

const extractService = (text: string): string => {
  const normalized = cleanText(text) || "";
  const patterns = [
    /\b(?:book|schedule|reserve|arrange|set up)\s+(?:an?\s+)?(.+?)(?:\s+(?:on|for|at|today|tomorrow|next)\b|[.?!,]|$)/i,
    /\bappointment\s+(?:for|about|regarding)\s+(.+?)(?:\s+(?:on|at|today|tomorrow|next)\b|[.?!,]|$)/i,
    /\b(?:for|about|regarding)\s+(.+?)(?:\s+(?:on|at|today|tomorrow|next)\b|[.?!,]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const raw = cleanText(match?.[1]);
    if (!raw) {
      continue;
    }

    const service = raw
      .replace(/\b(?:appointment|booking|slot|call|please|me|my|a|an|the)\b/gi, " ")
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (service.length >= 3) {
      return formatServiceLabel(clampText(service, 120));
    }
  }

  if (/\bconsult(?:ation)?\b/i.test(normalized)) {
    return "Consultation";
  }
  if (/\bdemo\b/i.test(normalized)) {
    return "Demo appointment";
  }
  return "Appointment";
};

const hasBookingIntent = (text: string): boolean =>
  /\b(book|booking|appointment|schedule|scheduled|reserve|reservation|slot|consultation|meet|meeting|visit)\b/i.test(text);

const parseBookingIntent = (text: string, fallback?: Partial<CreateBookingInput>): ParsedBookingIntent => {
  const normalized = cleanText(text) || "";
  const appointmentDate = parseDateFromText(normalized);
  const appointmentTime = parseTimeFromText(normalized);
  const appointmentAt = combineAppointmentAt(appointmentDate, appointmentTime);
  const status: BookingStatus = appointmentDate && appointmentTime ? "confirmed" : "pending";

  return {
    hasIntent: hasBookingIntent(normalized),
    customerName: cleanText(fallback?.customerName) || extractName(normalized),
    customerPhone: normalizePhoneNumber(fallback?.customerPhone || "") || extractPhone(normalized),
    customerEmail: normalizeEmail(fallback?.customerEmail || null) || extractEmail(normalized),
    service: cleanText(fallback?.service) || extractService(normalized),
    appointmentDate,
    appointmentTime,
    appointmentAt,
    status,
    notes: normalized,
  };
};

const ensureBookingsTable = async (): Promise<void> => {
  if (!bookingsTableReady) {
    bookingsTableReady = pool
      .query(BOOKING_TABLE_SQL)
      .then(() => undefined)
      .catch((error) => {
        bookingsTableReady = null;
        throw error;
      });
  }

  await bookingsTableReady;
};

const normalizeStatus = (value?: BookingStatus | null): BookingStatus => {
  if (value && ["pending", "confirmed", "completed", "cancelled", "no_show"].includes(value)) {
    return value;
  }
  return "pending";
};

const rowToBooking = (row: BookingRecord): BookingRecord => ({
  ...row,
  raw_details: row.raw_details || {},
  appointment_date: normalizeDateField(row.appointment_date),
  appointment_time: normalizeTimeField(row.appointment_time),
});

class BookingService {
  async ensureReady(): Promise<void> {
    await ensureBookingsTable();
  }

  async createBooking(input: CreateBookingInput): Promise<BookingRecord> {
    await ensureBookingsTable();

    const service = clampText(formatServiceLabel(input.service), 255) || "Appointment";
    const source = clampText(cleanText(input.source) || "manual", 40) || "manual";
    const customerPhone = normalizePhoneNumber(input.customerPhone || "") || null;
    const customerEmail = normalizeEmail(input.customerEmail || null);
    const status = normalizeStatus(input.status);

    const result = await pool.query<BookingRecord>(
      `INSERT INTO bookings (
         user_id,
         business_id,
         source,
         source_session_id,
         source_call_sid,
         customer_name,
         customer_phone,
         customer_email,
         service,
         appointment_date,
         appointment_time,
         appointment_at,
         status,
         notes,
         raw_details
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::time, $12::timestamptz, $13, $14, $15::jsonb)
       ON CONFLICT (source, source_session_id)
       WHERE source_session_id IS NOT NULL
       DO UPDATE SET
         user_id = COALESCE(EXCLUDED.user_id, bookings.user_id),
         business_id = COALESCE(EXCLUDED.business_id, bookings.business_id),
         source_call_sid = COALESCE(EXCLUDED.source_call_sid, bookings.source_call_sid),
         customer_name = COALESCE(EXCLUDED.customer_name, bookings.customer_name),
         customer_phone = COALESCE(EXCLUDED.customer_phone, bookings.customer_phone),
         customer_email = COALESCE(EXCLUDED.customer_email, bookings.customer_email),
         service = COALESCE(NULLIF(EXCLUDED.service, ''), bookings.service),
         appointment_date = COALESCE(EXCLUDED.appointment_date, bookings.appointment_date),
         appointment_time = COALESCE(EXCLUDED.appointment_time, bookings.appointment_time),
         appointment_at = COALESCE(EXCLUDED.appointment_at, bookings.appointment_at),
         status = CASE
           WHEN bookings.status IN ('completed', 'cancelled', 'no_show') THEN bookings.status
           ELSE EXCLUDED.status
         END,
         notes = COALESCE(EXCLUDED.notes, bookings.notes),
         raw_details = COALESCE(bookings.raw_details, '{}'::jsonb) || COALESCE(EXCLUDED.raw_details, '{}'::jsonb),
         updated_at = NOW()
       RETURNING *`,
      [
        input.userId ?? null,
        input.businessId ?? null,
        source,
        clampText(cleanText(input.sourceSessionId), 255),
        clampText(cleanText(input.sourceCallSid), 255),
        clampText(cleanText(input.customerName), 255),
        customerPhone,
        customerEmail,
        service,
        input.appointmentDate || null,
        input.appointmentTime || null,
        input.appointmentAt || null,
        status,
        input.notes || null,
        JSON.stringify(input.rawDetails || {}),
      ]
    );

    const booking = result.rows[0];
    if (!booking) {
      throw new Error("Failed to create booking");
    }

    logger.info("Booking saved", {
      bookingId: booking.id,
      source: booking.source,
      sourceSessionId: booking.source_session_id,
      status: booking.status,
    });

    return rowToBooking(booking);
  }

  async captureBookingFromText(input: BookingCaptureInput): Promise<BookingRecord | null> {
    const customerText = cleanText(input.customerText);
    if (!customerText) {
      return null;
    }

    const parsed = parseBookingIntent(customerText, {
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      customerEmail: input.customerEmail ?? null,
    });

    if (!parsed.hasIntent) {
      return null;
    }

    return this.createBooking({
      userId: input.userId ?? null,
      businessId: input.businessId ?? null,
      source: input.source,
      sourceSessionId: input.sourceSessionId ?? null,
      sourceCallSid: input.sourceCallSid ?? null,
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone,
      customerEmail: parsed.customerEmail,
      service: parsed.service,
      appointmentDate: parsed.appointmentDate,
      appointmentTime: parsed.appointmentTime,
      appointmentAt: parsed.appointmentAt,
      status: parsed.status,
      notes: parsed.notes,
      rawDetails: {
        ...(input.rawDetails || {}),
        captured_from_ai: true,
        customer_text: customerText,
        ai_response: input.aiResponse || null,
      },
    });
  }

  async listBookingsForUser(userId: number, limit = 50): Promise<BookingRecord[]> {
    await ensureBookingsTable();

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await pool.query<BookingRecord>(
      `SELECT bk.*
       FROM bookings bk
       LEFT JOIN businesses biz ON biz.id = bk.business_id
       LEFT JOIN users owner ON owner.id = $1
       WHERE bk.user_id = $1
          OR (
            bk.business_id IS NOT NULL
            AND owner.email IS NOT NULL
            AND LOWER(COALESCE(biz.email, '')) = LOWER(owner.email)
          )
       ORDER BY COALESCE(bk.appointment_at, bk.created_at) DESC, bk.created_at DESC
       LIMIT $2`,
      [userId, safeLimit]
    );

    return result.rows.map(rowToBooking);
  }

  buildVoiceConfirmation(booking: BookingRecord | null): string {
    if (!booking) {
      return "Thank you. We are processing your request.";
    }

    const datePart = booking.appointment_date ? ` on ${booking.appointment_date}` : "";
    const timePart = booking.appointment_time ? ` at ${booking.appointment_time.slice(0, 5)}` : "";
    return `Thank you. Your ${booking.service} request has been saved${datePart}${timePart}. Our team will confirm it shortly.`;
  }
}

export const bookingService = new BookingService();

export const extractTranscriptFromPayload = (payload: Record<string, unknown>): string | null => {
  const keys = [
    "TranscriptionText",
    "transcription_text",
    "SpeechResult",
    "speech_result",
    "RecordingTranscript",
    "recording_transcript",
    "Transcript",
    "transcript",
    "customer_message",
    "message",
  ];

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};
