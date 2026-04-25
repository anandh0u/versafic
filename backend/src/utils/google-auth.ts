import { logger } from "./logger";
import axios from "axios";
import { normalizeEnvValue } from "./env";
import { resolveOAuthCallbackUrl } from "./oauth-callback";

export interface GoogleTokenPayload {
  email: string;
  googleId: string;
  name?: string;
  picture?: string;
  aud: string;
  iss?: string;
  exp?: number;
  iat?: number;
}

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

const getGoogleCallbackUrl = () => {
  return resolveOAuthCallbackUrl(process.env.GOOGLE_CALLBACK_URL, "/auth/google/callback", "Google");
};

const parseEpochSeconds = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
};

/**
 * Verify Google ID token by calling Google's tokeninfo endpoint
 * This is the simplest way to verify tokens without installing additional dependencies
 */
export const verifyGoogleToken = async (idToken: string): Promise<GoogleTokenPayload> => {
  try {
    logger.debug("Verifying Google ID token");

    // Verify token with Google
    const response = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
      params: { id_token: idToken },
      timeout: 5000
    });

    const tokenData = response.data;

    // Validate required fields
    if (!tokenData?.email || !tokenData?.sub || !tokenData?.aud) {
      logger.warn("Google token missing required fields");
      throw new Error("Invalid Google token: missing required claims");
    }

    const emailVerified =
      parseBoolean(tokenData.email_verified) ?? parseBoolean(tokenData.verified_email);
    if (emailVerified === false) {
      logger.warn("Google token email is not verified", { email: tokenData.email });
      throw new Error("Invalid Google token: email not verified");
    }

    if (tokenData.iss && !GOOGLE_ISSUERS.has(tokenData.iss)) {
      logger.warn("Google token has invalid issuer", { issuer: tokenData.iss });
      throw new Error("Invalid Google token: invalid issuer");
    }

    const exp = parseEpochSeconds(tokenData.exp);
    if (exp && exp <= Math.floor(Date.now() / 1000)) {
      logger.warn("Google token is expired", { email: tokenData.email, exp });
      throw new Error("Invalid Google token: expired");
    }

    const configuredClientId = normalizeEnvValue(process.env.GOOGLE_CLIENT_ID);
    if (configuredClientId) {
      const allowedClientIds = configuredClientId
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (allowedClientIds.length > 0 && !allowedClientIds.includes(tokenData.aud)) {
        logger.warn("Google token audience mismatch", {
          tokenAud: tokenData.aud
        });
        throw new Error("Invalid Google token: audience mismatch");
      }
    }

    logger.debug("Google token verified successfully", {
      email: tokenData.email,
      googleId: tokenData.sub
    });

    const payload: GoogleTokenPayload = {
      email: tokenData.email,
      googleId: tokenData.sub,
      aud: tokenData.aud // Client ID
    };

    if (tokenData.name) {
      payload.name = tokenData.name;
    }

    if (tokenData.picture) {
      payload.picture = tokenData.picture;
    }

    if (tokenData.iss) {
      payload.iss = tokenData.iss;
    }

    if (exp !== undefined) {
      payload.exp = exp;
    }

    const iat = parseEpochSeconds(tokenData.iat);
    if (iat !== undefined) {
      payload.iat = iat;
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid Google token")) {
      throw new Error("Invalid Google ID token");
    }

    if (axios.isAxiosError(error)) {
      logger.error(`Google token verification failed: ${error.message}`, undefined, {
        httpStatus: error.response?.status,
        response_data: error.response?.data
      });

      if (error.response?.status === 400 || error.response?.status === 401) {
        throw new Error("Invalid Google ID token");
      }
    }

    logger.error("Error verifying Google token", error instanceof Error ? error : new Error(String(error)));
    throw new Error("Failed to verify Google token");
  }
};

export const exchangeGoogleCodeForProfile = async (code: string): Promise<GoogleTokenPayload> => {
  const clientId = normalizeEnvValue(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = normalizeEnvValue(process.env.GOOGLE_CLIENT_SECRET);
  if (!clientId || !clientSecret) {
    throw new Error("Google login is not configured");
  }

  try {
    const tokenResponse = await axios.post<{
      id_token?: string;
      error?: string;
      error_description?: string;
    }>(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getGoogleCallbackUrl(),
        grant_type: "authorization_code",
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 8000,
      }
    );

    if (!tokenResponse.data?.id_token) {
      throw new Error(tokenResponse.data?.error_description || tokenResponse.data?.error || "Google did not return an ID token");
    }

    return verifyGoogleToken(tokenResponse.data.id_token);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error("Google OAuth exchange failed", error instanceof Error ? error : new Error(String(error)), {
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error("Google OAuth exchange failed", error instanceof Error ? error : new Error(String(error)));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to authenticate with Google");
  }
};

/**
 * Verify Google ID token using JWT library (alternative method)
 * This requires knowing Google's public keys
 */
export const getGooglePublicKeys = async (): Promise<any> => {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/oauth2/v1/certs",
      {
        timeout: 5000
      }
    );
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch Google public keys", error instanceof Error ? error : new Error(String(error)));
    throw new Error("Failed to fetch Google public keys");
  }
};
