import { emailService } from "../services/email.service";

type EmailResult = {
  success: boolean;
  error?: string | undefined;
};

const buildVerificationEmailTemplate = (name: string, verificationLink: string): string => `
  <html>
    <body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
      <div style="max-width:600px;margin:0 auto;padding:24px;">
        <h2>Verify your ${process.env.APP_NAME || "Versafic"} account</h2>
        <p>Hi ${name || "there"},</p>
        <p>Please verify your email address by using the link below:</p>
        <p><a href="${verificationLink}">${verificationLink}</a></p>
      </div>
    </body>
  </html>
`;

const buildPasswordResetTemplate = (name: string, resetLink: string): string => `
  <html>
    <body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
      <div style="max-width:600px;margin:0 auto;padding:24px;">
        <h2>Password reset</h2>
        <p>Hi ${name || "there"},</p>
        <p>You can reset your password using the link below:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
      </div>
    </body>
  </html>
`;

const buildOnboardingTemplate = (businessName: string, setupProgress: number): string => `
  <html>
    <body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
      <div style="max-width:600px;margin:0 auto;padding:24px;">
        <h2>${businessName} onboarding progress</h2>
        <p>Your setup is now ${setupProgress}% complete.</p>
      </div>
    </body>
  </html>
`;

export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationLink: string
): Promise<EmailResult> => {
  const result = await emailService.sendEmail({
    to: email,
    subject: "Verify your account",
    html: buildVerificationEmailTemplate(name, verificationLink),
  });

  return result.success ? { success: true } : { success: false, error: result.error };
};

export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetLink: string
): Promise<EmailResult> => {
  const result = await emailService.sendEmail({
    to: email,
    subject: "Reset your password",
    html: buildPasswordResetTemplate(name, resetLink),
  });

  return result.success ? { success: true } : { success: false, error: result.error };
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<EmailResult> => {
  const result = await emailService.sendWelcomeEmail({ to: email, name });
  return result.success ? { success: true } : { success: false, error: result.error };
};

export const sendOnboardingNotification = async (
  email: string,
  businessName: string,
  setupProgress: number
): Promise<EmailResult> => {
  const result = await emailService.sendEmail({
    to: email,
    subject: `${businessName} setup progress update`,
    html: buildOnboardingTemplate(businessName, setupProgress),
  });

  return result.success ? { success: true } : { success: false, error: result.error };
};

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<EmailResult> => {
  const result = await emailService.sendEmail({ to, subject, html });
  return result.success ? { success: true } : { success: false, error: result.error };
};

export const sendBulkEmails = async (
  recipients: Array<{ email: string; subject: string; html: string }>
): Promise<{ sent: number; failed: number; errors: Array<{ email: string; error: string }> }> => {
  const summary = {
    sent: 0,
    failed: 0,
    errors: [] as Array<{ email: string; error: string }>,
  };

  for (const recipient of recipients) {
    const result = await emailService.sendEmail({
      to: recipient.email,
      subject: recipient.subject,
      html: recipient.html,
    });

    if (result.success) {
      summary.sent += 1;
    } else {
      summary.failed += 1;
      summary.errors.push({
        email: recipient.email,
        error: result.error || "Unknown error",
      });
    }
  }

  return summary;
};

export const testEmailConfiguration = async (): Promise<{ success: boolean; message: string }> =>
  emailService.testConfiguration();
