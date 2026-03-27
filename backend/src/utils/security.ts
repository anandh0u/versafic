// src/utils/security.ts
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hash password using bcrypt
 */
export const hashPassword = async (password: string, saltRounds: number = 10): Promise<string> => {
  return bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate secure random token
 */
export const generateToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate secure UUID
 */
export const generateUUID = (): string => {
  return crypto.randomUUID();
};

/**
 * Hash data using SHA256
 */
export const hashSHA256 = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Hash data using MD5 (for non-security purposes)
 */
export const hashMD5 = (data: string): string => {
  return crypto.createHash('md5').update(data).digest('hex');
};

/**
 * Encrypt string using AES-256-CBC
 * Returns a string in the format of iv:ciphertext
 */
export const encryptAES = (text: string, key: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(key.padEnd(32, '0').slice(0, 32)),
    iv
  );

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Prepend IV (not secret) to ciphertext
  return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Decrypt string using AES-256-CBC
 */
export const decryptAES = (encryptedText: string, key: string): string => {
  const [ivHex, ciphertext] = encryptedText.split(':');

  if (!ivHex || !ciphertext) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(key.padEnd(32, '0').slice(0, 32)),
    iv
  );

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Create HMAC signature
 */
export const createHMAC = (data: string, secret: string, algorithm: string = 'sha256'): string => {
  return crypto.createHmac(algorithm, secret).update(data).digest('hex');
};

/**
 * Verify HMAC signature
 */
export const verifyHMAC = (data: string, signature: string, secret: string, algorithm: string = 'sha256'): boolean => {
  const expectedSignature = createHMAC(data, secret, algorithm);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Generate email verification code
 */
export const generateVerificationCode = (length: number = 6): string => {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
};

/**
 * Check if password meets security requirements
 */
export const isSecurePassword = (password: string): {
  secure: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 12) errors.push('Password must be at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase letters');
  if (!/[a-z]/.test(password)) errors.push('Must contain lowercase letters');
  if (!/[0-9]/.test(password)) errors.push('Must contain numbers');
  if (!/[!@#$%^&*\-_.=+]/.test(password)) errors.push('Must contain special characters');

  return {
    secure: errors.length === 0,
    errors
  };
};

/**
 * Sanitize user input for security
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '')
    .replace(/[&]/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

/**
 * Check string for malicious patterns
 */
export const hasMaliciousPatterns = (input: string): boolean => {
  const maliciousPatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /\(\(.*?\)\)/g,
    /eval\(/gi,
    /expression\(/gi
  ];

  return maliciousPatterns.some(pattern => pattern.test(input));
};

/**
 * Rate limit check (basic in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (
  identifier: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } => {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: now + windowMs
    };
  }

  record.count++;

  return {
    allowed: record.count <= limit,
    remaining: Math.max(0, limit - record.count),
    resetTime: record.resetTime
  };
};

/**
 * Reset rate limit for identifier
 */
export const resetRateLimit = (identifier: string): void => {
  rateLimitMap.delete(identifier);
};

/**
 * Generate secure session token
 */
export const generateSessionToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create password reset token
 */
export const createPasswordResetToken = (): { token: string; hash: string; expiresAt: Date } => {
  const token = generateToken(32);
  const hash = hashSHA256(token);
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour

  return { token, hash, expiresAt };
};

/**
 * Create email verification token
 */
export const createEmailVerificationToken = (): { token: string; hash: string; expiresAt: Date } => {
  const token = generateToken(32);
  const hash = hashSHA256(token);
  const expiresAt = new Date(Date.now() + 86400000); // 24 hours

  return { token, hash, expiresAt };
};

/**
 * Validate CORS origin
 */
export const isValidCORSOrigin = (origin: string, allowedOrigins: string[]): boolean => {
  return allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    if (allowed === origin) return true;
    if (allowed.startsWith('http://') || allowed.startsWith('https://')) {
      try {
        const originUrl = new URL(origin);
        const allowedUrl = new URL(allowed);
        return originUrl.hostname === allowedUrl.hostname;
      } catch {
        return false;
      }
    }
    return false;
  });
};

/**
 * Strip sensitive headers
 */
export const stripSensitiveHeaders = (headers: Record<string, any>): Record<string, any> => {
  const sensitive = ['authorization', 'cookie', 'x-api-key', 'x-auth-token', 'password'];
  const stripped = { ...headers };

  sensitive.forEach(key => {
    if (stripped[key]) {
      stripped[key] = '***';
    }
  });

  return stripped;
};
