import { resolveMx } from "node:dns/promises";
import validator from "validator";

const INDIA_LOCAL_PHONE_PATTERN = /^[6-9]\d{9}$/;
const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const disposableEmailDomains = new Set([
  "10minutemail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
]);
const reservedEmailDomains = new Set([
  "example.com",
  "example.net",
  "example.org",
  "localhost",
  "localhost.localdomain",
]);
const reservedEmailSuffixes = [".example", ".invalid", ".localhost", ".local", ".test", ".internal"];
const emailDomainCheckCache = new Map<string, { valid: boolean; checkedAt: number }>();
const EMAIL_DOMAIN_CHECK_TTL_MS = 1000 * 60 * 60 * 6;
const EMAIL_DOMAIN_LOOKUP_TIMEOUT_MS = 2500;

const hasBlockedEmailDomain = (domain: string) =>
  Array.from(disposableEmailDomains).some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));

const hasReservedEmailDomain = (domain: string) =>
  reservedEmailDomains.has(domain) || reservedEmailSuffixes.some((suffix) => domain.endsWith(suffix));

const withLookupTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("lookup_timeout")), timeoutMs);
    }),
  ]);

const hasMailRoutingDomain = async (domain: string): Promise<boolean> => {
  const cached = emailDomainCheckCache.get(domain);
  if (cached && Date.now() - cached.checkedAt < EMAIL_DOMAIN_CHECK_TTL_MS) {
    return cached.valid;
  }

  const mark = (valid: boolean) => {
    emailDomainCheckCache.set(domain, {
      valid,
      checkedAt: Date.now(),
    });
    return valid;
  };

  try {
    const mxRecords = await withLookupTimeout(resolveMx(domain), EMAIL_DOMAIN_LOOKUP_TIMEOUT_MS);
    if (mxRecords.some((record) => !!record.exchange && record.exchange !== ".")) {
      return mark(true);
    }
  } catch {
    return mark(false);
  }

  return mark(false);
};

const getPhoneDigits = (phone: string) => phone.replace(/\D/g, "");

const isIndianPhoneDigits = (digits: string): boolean => {
  if (digits.length === 10) {
    return INDIA_LOCAL_PHONE_PATTERN.test(digits);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return INDIA_LOCAL_PHONE_PATTERN.test(digits.slice(1));
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return INDIA_LOCAL_PHONE_PATTERN.test(digits.slice(2));
  }

  return false;
};

const normalizeIndianPhone = (digits: string): string => {
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return `+91${digits.slice(-10)}`;
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean =>
  validator.isEmail(email, {
    allow_ip_domain: false,
    allow_utf8_local_part: false,
    domain_specific_validation: true,
  });

export const getRegistrableEmailError = async (email: string): Promise<string | null> => {
  const normalizedEmail = sanitizeEmail(email);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return "Enter a valid email address.";
  }

  const [localPart, rawDomain] = normalizedEmail.split("@");
  const domain = rawDomain?.toLowerCase().trim() || "";

  if (!localPart || !domain) {
    return "Enter a valid email address.";
  }

  if (localPart.length < 2 || localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    return "Enter a valid email address.";
  }

  if (!domain.includes(".") || hasBlockedEmailDomain(domain) || hasReservedEmailDomain(domain)) {
    return "Use a genuine business or personal email address.";
  }

  if (!(await hasMailRoutingDomain(domain))) {
    return "Use an email from a real, active domain.";
  }

  return null;
};

/**
 * Validate strong password
 * Requirements: min 8 chars, uppercase, lowercase, number, special char
 */
export const isStrongPassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain number");
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push("Password must contain special character (!@#$%^&*)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitize email
 */
export const sanitizeEmail = (email: string): string => {
  return validator.normalizeEmail(email) || email.toLowerCase().trim();
};

/**
 * Validate URL
 */
export const isValidUrl = (url: string): boolean => {
  return validator.isURL(url);
};

export const getPhoneValidationError = (phone: string): string | null => {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "Phone number is required.";
  }

  const digits = getPhoneDigits(trimmed);
  if (!digits) {
    return "Enter a valid phone number.";
  }

  if (isIndianPhoneDigits(digits) || trimmed.startsWith("+91")) {
    if (!isIndianPhoneDigits(digits)) {
      return "Indian mobile numbers must have exactly 10 digits.";
    }

    return null;
  }

  const normalized = normalizePhoneNumber(trimmed);
  if (!E164_PHONE_PATTERN.test(normalized)) {
    return "Enter a valid international phone number with country code.";
  }

  if (!validator.isMobilePhone(normalized, "any", { strictMode: true })) {
    return "Enter a valid mobile phone number.";
  }

  return null;
};

/**
 * Validate phone number
 */
export const isValidPhone = (phone: string): boolean => getPhoneValidationError(phone) === null;

/**
 * Normalize phone number into a compact +E.164-like format when possible
 */
export const normalizePhoneNumber = (phone: string): string => {
  const trimmed = phone.trim();
  const digits = getPhoneDigits(trimmed);

  if (!digits) {
    return "";
  }

  if (isIndianPhoneDigits(digits) || trimmed.startsWith("+91")) {
    return normalizeIndianPhone(digits);
  }

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length >= 8) {
    return `+${digits}`;
  }

  return digits;
};

/**
 * Validate business name
 */
export const isValidBusinessName = (name: string): boolean => {
  return validator.isLength(name, { min: 2, max: 255 }) && /^[a-zA-Z0-9\s\-'.,&()]+$/.test(name);
};

/**
 * Validate country code (2-letter ISO code)
 */
export const isValidCountryCode = (code: string): boolean => {
  return /^[A-Z]{2}$/.test(code);
};

/**
 * Sanitize string input (remove dangerous characters)
 */
export const sanitizeString = (str: string): string => {
  return validator.escape(str).trim();
};

/**
 * Validate message length
 */
export const isValidMessageLength = (message: string, min = 1, max = 10000): boolean => {
  return validator.isLength(message, { min, max });
};

/**
 * Check if value is numeric
 */
export const isNumeric = (value: unknown): boolean => {
  return !isNaN(parseFloat(String(value))) && isFinite(Number(value));
};

/**
 * Validate JWT format
 */
export const isValidJWT = (token: string): boolean => {
  const jwtRegex = /^[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*$/;
  return jwtRegex.test(token);
};

/**
 * Validate date string (ISO format)
 */
export const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Sanitize filename
 */
export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9._\-]/g, "").slice(0, 255);
};

/**
 * Validate credit card number (Luhn algorithm)
 */
export const isValidCreditCard = (cardNumber: string): boolean => {
  return validator.isCreditCard(cardNumber);
};

/**
 * Check if string contains SQL injection patterns
 */
export const hasSQLInjectionPatterns = (input: string): boolean => {
  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)/gi,
    /(\bselect\b.*\bfrom\b)/gi,
    /(\bdrop\b.*\btable\b)/gi,
    /(\binsert\b.*\binto\b)/gi,
    /(\bupdate\b.*\bset\b)/gi,
    /(\bdelete\b.*\bfrom\b)/gi,
    /(-{2}|\/\*|\*\/|xp_|sp_)/gi,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
};

/**
 * Check if string contains XSS patterns
 */
export const hasXSSPatterns = (input: string): boolean => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
};
