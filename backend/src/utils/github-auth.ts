import axios from "axios";
import { logger } from "./logger";
import { normalizeEnvValue } from "./env";

type GitHubEmailRecord = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
};

type GitHubUserRecord = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
};

export interface GitHubProfile {
  email: string;
  githubId: string;
  name?: string;
  picture?: string;
}

const getGitHubCallbackUrl = () => {
  const configuredCallback = normalizeEnvValue(process.env.GITHUB_CALLBACK_URL);
  if (configuredCallback) {
    return configuredCallback;
  }

  const publicBaseUrl = normalizeEnvValue(process.env.PUBLIC_BASE_URL);
  if (!publicBaseUrl) {
    throw new Error("GitHub callback URL is not configured");
  }

  return `${publicBaseUrl.replace(/\/+$/, "")}/auth/github/callback`;
};

const getVerifiedGitHubEmail = (emails: GitHubEmailRecord[]): string | null => {
  const primaryVerified = emails.find((email) => email.primary && email.verified);
  if (primaryVerified?.email) {
    return primaryVerified.email;
  }

  const firstVerified = emails.find((email) => email.verified);
  return firstVerified?.email || null;
};

export const exchangeGitHubCodeForProfile = async (code: string): Promise<GitHubProfile> => {
  const clientId = normalizeEnvValue(process.env.GITHUB_CLIENT_ID);
  const clientSecret = normalizeEnvValue(process.env.GITHUB_CLIENT_SECRET);
  if (!clientId || !clientSecret) {
    throw new Error("GitHub login is not configured");
  }

  try {
    const tokenResponse = await axios.post<{ access_token?: string; error?: string; error_description?: string }>(
      "https://github.com/login/oauth/access_token",
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getGitHubCallbackUrl(),
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    if (!tokenResponse.data?.access_token) {
      throw new Error(tokenResponse.data?.error_description || tokenResponse.data?.error || "GitHub did not return an access token");
    }

    const headers = {
      Authorization: `Bearer ${tokenResponse.data.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Versafic",
    };

    const [userResponse, emailResponse] = await Promise.all([
      axios.get<GitHubUserRecord>("https://api.github.com/user", {
        headers,
        timeout: 8000,
      }),
      axios.get<GitHubEmailRecord[]>("https://api.github.com/user/emails", {
        headers,
        timeout: 8000,
      }),
    ]);

    const email = getVerifiedGitHubEmail(emailResponse.data || []);
    if (!email) {
      throw new Error("GitHub account must have a verified email address");
    }

    const profile: GitHubProfile = {
      email,
      githubId: String(userResponse.data.id),
    };

    const resolvedName = userResponse.data.name || userResponse.data.login || undefined;
    if (resolvedName) {
      profile.name = resolvedName;
    }

    if (userResponse.data.avatar_url) {
      profile.picture = userResponse.data.avatar_url;
    }

    return profile;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error("GitHub OAuth exchange failed", error instanceof Error ? error : new Error(String(error)), {
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error("GitHub OAuth exchange failed", error instanceof Error ? error : new Error(String(error)));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to authenticate with GitHub");
  }
};
