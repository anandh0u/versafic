// src/utils/email.ts
import nodemailer from 'nodemailer';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

/**
 * Email verification template
 */
const verificationEmailTemplate = (name: string, verificationLink: string): string => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Welcome to Versafic!</h2>
          <p>Hi ${name},</p>
          <p>Thank you for signing up. Please verify your email address by clicking the link below:</p>
          <p>
            <a href="${verificationLink}" 
               style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              Verify Email
            </a>
          </p>
          <p>Or copy this link: ${verificationLink}</p>
          <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">If you didn't sign up, please ignore this email.</p>
        </div>
      </body>
    </html>
  `;
};

/**
 * Password reset template
 */
const passwordResetTemplate = (name: string, resetLink: string): string => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the link below to set a new password:</p>
          <p>
            <a href="${resetLink}" 
               style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
          </p>
          <p>Or copy this link: ${resetLink}</p>
          <p style="color: #666; font-size: 12px;">This link expires in 1 hour.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
        </div>
      </body>
    </html>
  `;
};

/**
 * Welcome email template
 */
const welcomeEmailTemplate = (name: string): string => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Welcome Aboard, ${name}!</h2>
          <p>Your account is now active and ready to use.</p>
          <h3>Getting Started:</h3>
          <ul>
            <li>Complete your business profile</li>
            <li>Set up your preferences</li>
            <li>Explore our AI chat feature</li>
          </ul>
          <p>
            <a href="${process.env.APP_URL || 'https://versafic.com'}" 
               style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              Go to Dashboard
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">Need help? Contact us at support@versafic.com</p>
        </div>
      </body>
    </html>
  `;
};

/**
 * Business onboarding notification template
 */
const onboardingNotificationTemplate = (businessName: string, setupProgress: number): string => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>${businessName} Onboarding Progress</h2>
          <p>You're ${setupProgress}% complete with your business setup!</p>
          <div style="background-color: #f0f0f0; padding: 20px; border-radius: 5px;">
            <div style="background-color: #28a745; height: 30px; border-radius: 5px; width: ${setupProgress}%; display: flex; align-items: center; justify-content: center; color: white;">
              ${setupProgress}%
            </div>
          </div>
          <p>Keep going! Complete your profile to unlock all features.</p>
          <p>
            <a href="${process.env.APP_URL || 'https://versafic.com'}/setup" 
               style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              Continue Setup
            </a>
          </p>
        </div>
      </body>
    </html>
  `;
};

/**
 * Send verification email
 */
export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationLink: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@versafic.com',
      to: email,
      subject: 'Verify your Versafic account',
      html: verificationEmailTemplate(name, verificationLink)
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Verification email sent to ${email}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to send verification email to ${email}:`, error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    };
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetLink: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@versafic.com',
      to: email,
      subject: 'Reset your Versafic password',
      html: passwordResetTemplate(name, resetLink)
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${email}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to send password reset email to ${email}:`, error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    };
  }
};

/**
 * Send welcome email
 */
export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@versafic.com',
      to: email,
      subject: 'Welcome to Versafic!',
      html: welcomeEmailTemplate(name)
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${email}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to send welcome email to ${email}:`, error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    };
  }
};

/**
 * Send onboarding notification
 */
export const sendOnboardingNotification = async (
  email: string,
  businessName: string,
  setupProgress: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@versific.com',
      to: email,
      subject: `${businessName} setup progress update`,
      html: onboardingNotificationTemplate(businessName, setupProgress)
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Onboarding notification sent to ${email}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to send onboarding notification to ${email}:`, error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    };
  }
};

/**
 * Send generic email
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  from?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const mailOptions = {
      from: from || process.env.SMTP_FROM || 'noreply@versafic.com',
      to,
      subject,
      html
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${subject}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    };
  }
};

/**
 * Send bulk emails
 */
export const sendBulkEmails = async (
  recipients: Array<{ email: string; subject: string; html: string }>,
  from?: string
): Promise<{ sent: number; failed: number; errors: Array<{ email: string; error: string }> }> => {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as Array<{ email: string; error: string }>
  };

  for (const recipient of recipients) {
    const result = await sendEmail(recipient.email, recipient.subject, recipient.html, from);
    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push({
        email: recipient.email,
        error: result.error || 'Unknown error'
      });
    }
  }

  return results;
};

/**
 * Test email configuration
 */
export const testEmailConfiguration = async (): Promise<{ success: boolean; message: string }> => {
  try {
    await transporter.verify();
    logger.info('Email configuration verified');
    return {
      success: true,
      message: 'Email configuration is valid'
    };
  } catch (error) {
    logger.error('Email configuration verification failed:', error as Error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Configuration verification failed'
    };
  }
};
