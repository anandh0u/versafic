import { normalizeEnvValue } from "./env";

const isLocalHostUrl = (value: string): boolean => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const buildFromPublicBase = (path: string, provider: string): string => {
  const railwayDomain = normalizeEnvValue(process.env.RAILWAY_PUBLIC_DOMAIN);
  const vercelUrl = normalizeEnvValue(process.env.VERCEL_URL);
  const publicBaseUrl =
    normalizeEnvValue(process.env.PUBLIC_BASE_URL) ||
    normalizeEnvValue(process.env.BACKEND_BASE_URL) ||
    (railwayDomain ? `https://${railwayDomain}` : "") ||
    (vercelUrl ? `https://${vercelUrl}` : "");

  if (!publicBaseUrl) {
    throw new Error(`${provider} callback URL is not configured`);
  }

  return `${publicBaseUrl.replace(/\/+$/, "")}${path}`;
};

export const resolveOAuthCallbackUrl = (envValue: string | undefined, path: string, provider: string): string => {
  const configuredCallback = normalizeEnvValue(envValue);
  if (!configuredCallback) {
    return buildFromPublicBase(path, provider);
  }

  const publicBaseUrl = normalizeEnvValue(process.env.PUBLIC_BASE_URL);
  const configuredIsLocal = isLocalHostUrl(configuredCallback);

  if (configuredIsLocal && publicBaseUrl && !isLocalHostUrl(publicBaseUrl)) {
    return `${publicBaseUrl.replace(/\/+$/, "")}${path}`;
  }

  return configuredCallback;
};
