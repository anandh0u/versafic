// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import * as AuthService from "../services/auth.service";
import { AppError } from "../middleware/error-handler";
import { ErrorCode } from "../types";
import { exchangeGitHubCodeForProfile } from "../utils/github-auth";
import { normalizeEnvValue } from "../utils/env";
import { exchangeGoogleCodeForProfile } from "../utils/google-auth";
import {
  buildFrontendAuthErrorUrl,
  buildFrontendAuthSuccessUrl,
  clearOAuthState,
  createOAuthState,
  readOAuthState,
  resolveFrontendReturnUrl,
  storeOAuthState,
} from "../utils/oauth-flow";
import { getRegistrableEmailError, isStrongPassword, isValidEmail, sanitizeEmail } from "../utils/validators";
import { AuthRequest } from "../middleware/jwt-auth";

type OAuthProvider = "google" | "github";

const getProviderDisplayName = (provider: OAuthProvider) => (provider === "google" ? "Google" : "GitHub");

const getPublicBaseUrl = () => {
  const publicBaseUrl = normalizeEnvValue(process.env.PUBLIC_BASE_URL);
  if (!publicBaseUrl) {
    throw new AppError(500, ErrorCode.AUTH_ERROR, "PUBLIC_BASE_URL is not configured");
  }

  return publicBaseUrl.replace(/\/+$/, "");
};

const getGoogleCallbackUrl = () =>
  normalizeEnvValue(process.env.GOOGLE_CALLBACK_URL) || `${getPublicBaseUrl()}/auth/google/callback`;

const getGitHubCallbackUrl = () =>
  normalizeEnvValue(process.env.GITHUB_CALLBACK_URL) || `${getPublicBaseUrl()}/auth/github/callback`;

const redirectWithOAuthError = (res: Response, returnTo: string, message: string) => {
  res.redirect(302, buildFrontendAuthErrorUrl(returnTo, message));
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Email and password are required"));
    }

    // Validate and sanitize email
    const normalizedEmail = sanitizeEmail(email);
    const emailValidationError = await getRegistrableEmailError(normalizedEmail);
    if (emailValidationError) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, emailValidationError));
    }

    // Validate password strength
    const passwordValidation = isStrongPassword(password);
    if (!passwordValidation.valid) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR,
        `Password requirements: ${passwordValidation.errors.join(", ")}`));
    }

    const result = await AuthService.registerUser(normalizedEmail, password, typeof name === "string" ? name : undefined);

    res.status(201).json({
      status: "success",
      message: "User registered successfully",
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Email and password are required"));
    }

    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid email format"));
    }

    const result = await AuthService.loginUser(normalizedEmail, password);

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const validateEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Email is required"));
    }

    const normalizedEmail = sanitizeEmail(email);
    const emailValidationError = await getRegistrableEmailError(normalizedEmail);

    res.status(200).json({
      status: "success",
      message: emailValidationError ? emailValidationError : "Email is valid",
      data: {
        email: normalizedEmail,
        valid: !emailValidationError,
        error: emailValidationError,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== "string") {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Refresh token is required"));
    }

    const result = await AuthService.refreshAuthToken(refreshToken);

    res.status(200).json({
      status: "success",
      message: "Token refreshed successfully",
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

const startOAuthFlow = (
  provider: OAuthProvider,
  buildAuthorizationUrl: (state: string) => string
) => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let returnTo = "";

  try {
    returnTo = resolveFrontendReturnUrl(req.query.return_to as string | undefined);
    const oauthState = createOAuthState(provider, returnTo);

    storeOAuthState(res, oauthState);
    res.redirect(302, buildAuthorizationUrl(oauthState.state));
  } catch (error) {
    if (returnTo) {
      redirectWithOAuthError(
        res,
        returnTo,
        error instanceof Error ? error.message : `Unable to start ${getProviderDisplayName(provider)} login.`
      );
      return;
    }

    next(
      error instanceof AppError
        ? error
        : new AppError(400, ErrorCode.AUTH_ERROR, error instanceof Error ? error.message : "Unable to start OAuth flow")
    );
  }
};

const handleOAuthCallback = (
  provider: OAuthProvider,
  exchangeCodeForProfile: (code: string) => Promise<{ email: string; name?: string; picture?: string; googleId?: string; githubId?: string }>
) => async (req: Request, res: Response): Promise<void> => {
  const storedState = readOAuthState(req, provider);
  const returnTo = storedState?.returnTo || resolveFrontendReturnUrl(undefined);

  try {
    clearOAuthState(res, provider);

    const providerError = typeof req.query.error === "string" ? req.query.error : "";
    const providerErrorDescription =
      typeof req.query.error_description === "string" ? req.query.error_description : "";
    if (providerError) {
      redirectWithOAuthError(res, returnTo, providerErrorDescription || `${getProviderDisplayName(provider)} login was cancelled.`);
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";

    if (!storedState || !state || storedState.state !== state) {
      redirectWithOAuthError(res, returnTo, `${getProviderDisplayName(provider)} login session expired. Please try again.`);
      return;
    }

    if (!code) {
      redirectWithOAuthError(res, returnTo, `${getProviderDisplayName(provider)} did not return an authorization code.`);
      return;
    }

    const profile = await exchangeCodeForProfile(code);
    const providerId = provider === "google" ? profile.googleId : profile.githubId;
    if (!providerId) {
      redirectWithOAuthError(res, returnTo, `${getProviderDisplayName(provider)} did not return a valid account identifier.`);
      return;
    }

    const result = await AuthService.handleOAuthProviderAuth(provider, profile.email, providerId, profile.name);
    res.redirect(
      302,
      buildFrontendAuthSuccessUrl(returnTo, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        provider,
        isNewUser: result.isNewUser,
      })
    );
  } catch (error) {
    redirectWithOAuthError(
      res,
      returnTo,
      error instanceof Error ? error.message : `Unable to finish ${getProviderDisplayName(provider)} login.`
    );
  }
};

export const startGoogleOAuth = startOAuthFlow("google", (state) => {
  const clientId = normalizeEnvValue(process.env.GOOGLE_CLIENT_ID);
  if (!clientId || clientId.includes("your_google_client_id")) {
    throw new AppError(503, ErrorCode.AUTH_ERROR, "Google login is not configured yet.");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getGoogleCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return url.toString();
});

export const googleOAuthCallback = handleOAuthCallback("google", exchangeGoogleCodeForProfile);

export const startGitHubOAuth = startOAuthFlow("github", (state) => {
  const clientId = normalizeEnvValue(process.env.GITHUB_CLIENT_ID);
  if (!clientId || clientId.includes("your_github_client_id")) {
    throw new AppError(503, ErrorCode.AUTH_ERROR, "GitHub login is not configured yet.");
  }

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getGitHubCallbackUrl());
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("allow_signup", "true");
  url.searchParams.set("state", state);

  return url.toString();
});

export const githubOAuthCallback = handleOAuthCallback("github", exchangeGitHubCodeForProfile);

export const googleAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, googleId, name } = req.body;

    if (typeof email !== "string" || typeof googleId !== "string" || !email || !googleId) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Email and googleId are required"));
    }

    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid email format"));
    }

    const result = await AuthService.handleGoogleAuth(normalizedEmail, googleId, name);

    res.status(result.isNewUser ? 201 : 200).json({
      status: "success",
      message: result.isNewUser ? "Account created via Google" : "Login successful via Google",
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Google ID token verification endpoint
 * Accepts Google ID token from frontend and verifies it
 */
export const googleAuthWithIdToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Google ID token (idToken) is required"));
    }

    const result = await AuthService.handleGoogleIdTokenAuth(idToken);

    res.status(result.isNewUser ? 201 : 200).json({
      status: "success",
      message: result.isNewUser ? "Account created via Google" : "Login successful via Google",
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, "User not authenticated"));
    }

    const user = await AuthService.getCurrentUserProfile(req.user.id);

    res.status(200).json({
      status: "success",
      message: "Current user retrieved successfully",
      data: user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const updateCurrentUserPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, "User not authenticated"));
    }

    const { name, phone_number, call_consent, call_opt_out } = req.body;

    const payload: {
      userId: string | number;
      name?: string;
      phoneNumber?: string;
      callConsent?: boolean;
      callOptOut?: boolean;
    } = {
      userId: req.user.id,
    };

    if (typeof name === "string") {
      payload.name = name;
    }

    if (typeof phone_number === "string") {
      payload.phoneNumber = phone_number;
    }

    if (typeof call_consent === "boolean") {
      payload.callConsent = call_consent;
    }

    if (typeof call_opt_out === "boolean") {
      payload.callOptOut = call_opt_out;
    }

    const updatedUser = await AuthService.updateCurrentUserContactPreferences(payload);

    res.status(200).json({
      status: "success",
      message: "Contact preferences updated successfully",
      data: updatedUser,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};
