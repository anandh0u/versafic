import { pool } from "../config/database";
import * as UserModel from "../models/user.model";
import { getMailgunClient, getMailgunConfig, getMailgunFrom, isMailgunConfigured } from "../utils/mailgun";
import { logger } from "../utils/logger";

export type SendEmailInput = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export type SendEmailResult = {
  success: boolean;
  provider: "mailgun";
  id?: string | undefined;
  message?: string | undefined;
  error?: string | undefined;
};

type WelcomeEmailInput = {
  to: string;
  name?: string | null | undefined;
  businessName?: string | null | undefined;
};

type CallSummaryEmailInput = {
  to: string;
  businessName: string;
  customerNumber: string;
  recordingUrl?: string | null | undefined;
};

type LowCreditsAlertInput = {
  to: string;
  name?: string | null | undefined;
  balanceCredits: number;
  thresholdCredits: number;
};

type ResolvedBusinessContact = {
  email: string | null;
  name: string;
};

const APP_NAME = process.env.APP_NAME || "Versafic";
const APP_URL = process.env.APP_URL || process.env.FRONTEND_BASE_URL || "https://versafic.com";

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeRecipient = (value: string): string => value.trim().toLowerCase();

const extractEmailAddress = (input?: string | null): string | null => {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  const match = trimmed.match(/<([^>]+)>/);
  if (match?.[1]) {
    return match[1].trim().toLowerCase();
  }

  return trimmed.includes("@") ? trimmed.toLowerCase() : null;
};

const isSandboxMailgunDomain = (): boolean => getMailgunConfig().domain.toLowerCase().includes(".mailgun.org");

const buildEmailShell = (title: string, body: string): string => `
  <html>
    <body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
          <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#111827;">${title}</h1>
          <div style="font-size:15px;line-height:1.7;color:#374151;">
            ${body}
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
          <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
            Sent by ${APP_NAME}
          </p>
        </div>
      </div>
    </body>
  </html>
`;

const buildWelcomeTemplate = (input: WelcomeEmailInput): { subject: string; html: string; text: string } => {
  const displayName = input.name?.trim() || input.businessName?.trim() || "there";
  const businessLine = input.businessName?.trim()
    ? `<p style="margin:0 0 16px;">Your business profile for <strong>${input.businessName.trim()}</strong> is now ready to continue setup inside ${APP_NAME}.</p>`
    : `<p style="margin:0 0 16px;">Your ${APP_NAME} account is ready to go.</p>`;

  const html = buildEmailShell(
    `Welcome to ${APP_NAME}`,
    `
      <p style="margin:0 0 16px;">Hi ${displayName},</p>
      ${businessLine}
      <p style="margin:0 0 16px;">You can now sign in, complete onboarding, and start using AI chat and calling workflows.</p>
      <p style="margin:24px 0;">
        <a href="${APP_URL}" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;">
          Open ${APP_NAME}
        </a>
      </p>
    `
  );

  return {
    subject: `Welcome to ${APP_NAME}`,
    html,
    text: `Hi ${displayName}, welcome to ${APP_NAME}. ${input.businessName ? `Your business profile for ${input.businessName.trim()} is ready.` : "Your account is ready."} Open ${APP_URL} to continue.`,
  };
};

const buildCallSummaryTemplate = (input: CallSummaryEmailInput): { subject: string; html: string; text: string } => {
  const recordingBlock = input.recordingUrl
    ? `<p style="margin:0 0 16px;">Recording: <a href="${input.recordingUrl}">${input.recordingUrl}</a></p>`
    : `<p style="margin:0 0 16px;">Recording: not available for this call.</p>`;

  const html = buildEmailShell(
    `Call summary for ${input.businessName}`,
    `
      <p style="margin:0 0 16px;">A call has completed for <strong>${input.businessName}</strong>.</p>
      <p style="margin:0 0 8px;"><strong>Customer number:</strong> ${input.customerNumber}</p>
      ${recordingBlock}
    `
  );

  return {
    subject: `${input.businessName} call summary`,
    html,
    text: `A call has completed for ${input.businessName}. Customer number: ${input.customerNumber}.${input.recordingUrl ? ` Recording: ${input.recordingUrl}` : " Recording: not available."}`,
  };
};

const buildLowCreditsTemplate = (input: LowCreditsAlertInput): { subject: string; html: string; text: string } => {
  const displayName = input.name?.trim() || "there";
  const html = buildEmailShell(
    "Low credits alert",
    `
      <p style="margin:0 0 16px;">Hi ${displayName},</p>
      <p style="margin:0 0 16px;">Your wallet balance is running low.</p>
      <p style="margin:0 0 8px;"><strong>Current credits:</strong> ${input.balanceCredits}</p>
      <p style="margin:0 0 16px;"><strong>Alert threshold:</strong> ${input.thresholdCredits}</p>
      <p style="margin:24px 0;">
        <a href="${APP_URL}" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;">
          Recharge credits
        </a>
      </p>
    `
  );

  return {
    subject: `${APP_NAME} low credits alert`,
    html,
    text: `Hi ${displayName}, your wallet is low on credits. Current credits: ${input.balanceCredits}. Alert threshold: ${input.thresholdCredits}. Recharge at ${APP_URL}.`,
  };
};

const buildTestTemplate = (): { subject: string; html: string; text: string } => {
  const html = buildEmailShell(
    "Mailgun is connected",
    `
      <p style="margin:0 0 16px;">Your ${APP_NAME} backend is now connected to Mailgun.</p>
      <p style="margin:0;">This is a test email from the production-ready email service.</p>
    `
  );

  return {
    subject: `${APP_NAME} Mailgun test`,
    html,
    text: `Your ${APP_NAME} backend is now connected to Mailgun. This is a test email from the email service.`,
  };
};

class EmailService {
  private getTestRecipient(to?: string | null): string | null {
    return extractEmailAddress(to) || extractEmailAddress(getMailgunFrom());
  }

  private getErrorMessage(error: unknown): string {
    if (!error) {
      return "Unknown Mailgun error";
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "object") {
      const candidate = error as {
        message?: unknown;
        details?: { message?: unknown };
        status?: unknown;
      };

      if (candidate.status === 403 && isSandboxMailgunDomain()) {
        return "Mailgun sandbox can only send to authorized recipient emails. Add this email in Mailgun authorized recipients or use a verified custom domain.";
      }

      if (typeof candidate.details?.message === "string") {
        if (
          candidate.details.message.toLowerCase().includes("forbidden") &&
          isSandboxMailgunDomain()
        ) {
          return "Mailgun sandbox can only send to authorized recipient emails. Add this email in Mailgun authorized recipients or use a verified custom domain.";
        }
        return candidate.details.message;
      }

      if (typeof candidate.message === "string") {
        if (candidate.message.toLowerCase().includes("forbidden") && isSandboxMailgunDomain()) {
          return "Mailgun sandbox can only send to authorized recipient emails. Add this email in Mailgun authorized recipients or use a verified custom domain.";
        }
        return candidate.message;
      }
    }

    return String(error);
  }

  private async resolveBusinessContact(businessId: string): Promise<ResolvedBusinessContact | null> {
    const result = await pool.query<ResolvedBusinessContact>(
      `SELECT
         NULLIF(TRIM(email), '') AS email,
         COALESCE(NULLIF(TRIM(name), ''), NULLIF(TRIM(business_name), ''), NULLIF(TRIM(owner_name), ''), 'Business') AS name
       FROM businesses
       WHERE id = $1
       LIMIT 1`,
      [businessId]
    );

    return result.rows[0] || null;
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const to = normalizeRecipient(input.to);
    const subject = input.subject.trim();
    const html = input.html?.trim();
    const text = input.text?.trim() || (html ? stripHtml(html) : "");

    if (!to || !subject || (!text && !html)) {
      const error = "to, subject, and at least one of text or html are required";
      logger.warn("Email validation failed", { to, subject, hasHtml: Boolean(html), hasText: Boolean(text) });
      return {
        success: false,
        provider: "mailgun",
        error,
      };
    }

    if (!isMailgunConfigured()) {
      const error = "Mailgun is not configured";
      logger.warn("Email send skipped because Mailgun is not configured", { to, subject });
      return {
        success: false,
        provider: "mailgun",
        error,
      };
    }

    try {
      const client = getMailgunClient();
      const response = (await client.messages.create(getMailgunConfig().domain, {
        from: getMailgunFrom(),
        to: [to],
        subject,
        text,
        "h:Reply-To": getMailgunFrom(),
        "h:X-Auto-Response-Suppress": "OOF, AutoReply",
        "h:List-Unsubscribe": `<${APP_URL}>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "o:tracking": "no",
        "o:tracking-clicks": "no",
        "o:tracking-opens": "no",
        "o:tag": ["versafic-transactional"],
        ...(html ? { html } : {}),
      })) as { id?: string; message?: string };

      logger.info("Email sent", {
        provider: "mailgun",
        to,
        subject,
        id: response.id ?? null,
      });

      return {
        success: true,
        provider: "mailgun",
        id: response.id,
        message: response.message,
      };
    } catch (error) {
      const reason = this.getErrorMessage(error);
      logger.error("Email failed", error instanceof Error ? error : new Error(reason), {
        provider: "mailgun",
        to,
        subject,
        reason,
      });

      return {
        success: false,
        provider: "mailgun",
        error: reason,
      };
    }
  }

  async sendWelcomeEmail(input: WelcomeEmailInput): Promise<SendEmailResult> {
    const template = buildWelcomeTemplate(input);
    return this.sendEmail({
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendCallSummaryEmail(input: CallSummaryEmailInput): Promise<SendEmailResult> {
    const template = buildCallSummaryTemplate(input);
    return this.sendEmail({
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendLowCreditsAlert(input: LowCreditsAlertInput): Promise<SendEmailResult> {
    const template = buildLowCreditsTemplate(input);
    return this.sendEmail({
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendTestEmail(to?: string | null): Promise<SendEmailResult> {
    const recipient = this.getTestRecipient(to);
    if (!recipient) {
      return {
        success: false,
        provider: "mailgun",
        error: "No recipient available for test email. Provide ?to=... or configure MAILGUN_FROM with a real inbox.",
      };
    }

    const template = buildTestTemplate();
    return this.sendEmail({
      to: recipient,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendWelcomeEmailToUser(userId: number, nameOverride?: string | null): Promise<SendEmailResult> {
    const user = await UserModel.findUserById(userId);
    if (!user?.email) {
      logger.warn("Skipping welcome email because recipient email is missing", { userId });
      return {
        success: false,
        provider: "mailgun",
        error: "Recipient email unavailable",
      };
    }

    return this.sendWelcomeEmail({
      to: user.email,
      name: nameOverride ?? user.name,
    });
  }

  async sendCallSummaryToOwner(params: {
    userId?: number | null;
    businessId?: string | null;
    businessName?: string | null;
    customerNumber: string;
    recordingUrl?: string | null | undefined;
  }): Promise<SendEmailResult> {
    let recipientEmail: string | null = null;
    let resolvedBusinessName = params.businessName?.trim() || "Business";

    if (params.userId) {
      const user = await UserModel.findUserById(params.userId);
      recipientEmail = user?.email || null;
    }

    if (!recipientEmail && params.businessId) {
      const businessContact = await this.resolveBusinessContact(params.businessId);
      recipientEmail = businessContact?.email || null;
      if (!params.businessName && businessContact?.name) {
        resolvedBusinessName = businessContact.name;
      }
    }

    if (!recipientEmail) {
      logger.warn("Skipping call summary email because recipient email is unavailable", {
        userId: params.userId,
        businessId: params.businessId,
      });
      return {
        success: false,
        provider: "mailgun",
        error: "Recipient email unavailable",
      };
    }

    return this.sendCallSummaryEmail({
      to: recipientEmail,
      businessName: resolvedBusinessName,
      customerNumber: params.customerNumber,
      recordingUrl: params.recordingUrl,
    });
  }

  async sendLowCreditsAlertToUser(params: {
    userId: number;
    balanceCredits: number;
    thresholdCredits: number;
  }): Promise<SendEmailResult> {
    const user = await UserModel.findUserById(params.userId);
    if (!user?.email) {
      logger.warn("Skipping low credit alert because recipient email is unavailable", { userId: params.userId });
      return {
        success: false,
        provider: "mailgun",
        error: "Recipient email unavailable",
      };
    }

    return this.sendLowCreditsAlert({
      to: user.email,
      name: user.name,
      balanceCredits: params.balanceCredits,
      thresholdCredits: params.thresholdCredits,
    });
  }

  async testConfiguration(): Promise<{ success: boolean; message: string }> {
    if (!isMailgunConfigured()) {
      return {
        success: false,
        message: "Mailgun is not configured",
      };
    }

    return {
      success: true,
      message: "Mailgun configuration is present",
    };
  }
}

export const emailService = new EmailService();
