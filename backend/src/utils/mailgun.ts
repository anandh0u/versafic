import Mailgun from "mailgun.js";
import FormData from "form-data";
import { AppError } from "../middleware/error-handler";
import { ErrorCode } from "../types";
import { getOptionalEnv, isPlaceholderEnvValue } from "./env";

const DEFAULT_MAILGUN_BASE_URL = "https://api.mailgun.net";

type MailgunConfig = {
  apiKey: string;
  domain: string;
  from: string;
  baseUrl: string;
};

const readMailgunConfig = (): MailgunConfig => ({
  apiKey: getOptionalEnv("MAILGUN_API_KEY"),
  domain: getOptionalEnv("MAILGUN_DOMAIN"),
  from: getOptionalEnv("MAILGUN_FROM"),
  baseUrl: getOptionalEnv("MAILGUN_BASE_URL", DEFAULT_MAILGUN_BASE_URL).replace(/\/+$/, ""),
});

const createMailgunClient = () => {
  const config = readMailgunConfig();
  const mailgun = new Mailgun(FormData);

  return mailgun.client({
    username: "api",
    key: config.apiKey,
    url: config.baseUrl,
  });
};

let mailgunClient: ReturnType<typeof createMailgunClient> | null = null;

export const isMailgunConfigured = (): boolean => {
  const config = readMailgunConfig();

  return (
    Boolean(config.apiKey && config.domain && config.from) &&
    !isPlaceholderEnvValue(config.apiKey) &&
    !isPlaceholderEnvValue(config.domain) &&
    !isPlaceholderEnvValue(config.from)
  );
};

export const getMailgunConfig = (): Omit<MailgunConfig, "apiKey"> => {
  const { apiKey: _apiKey, ...rest } = readMailgunConfig();
  return rest;
};

export const getMailgunClient = () => {
  if (!isMailgunConfigured()) {
    const config = readMailgunConfig();
    const missing = [
      !config.apiKey || isPlaceholderEnvValue(config.apiKey) ? "MAILGUN_API_KEY" : null,
      !config.domain || isPlaceholderEnvValue(config.domain) ? "MAILGUN_DOMAIN" : null,
      !config.from || isPlaceholderEnvValue(config.from) ? "MAILGUN_FROM" : null,
    ].filter(Boolean);

    throw new AppError(
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      `Mailgun is not configured. Missing: ${missing.join(", ")}`
    );
  }

  if (!mailgunClient) {
    mailgunClient = createMailgunClient();
  }

  return mailgunClient;
};

export const getMailgunDomain = (): string => readMailgunConfig().domain;

export const getMailgunFrom = (): string => readMailgunConfig().from;
