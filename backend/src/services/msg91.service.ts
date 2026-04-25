import axios from 'axios';
import { logger } from '../utils/logger';
import { getOptionalEnv, isPlaceholderEnvValue } from '../utils/env';

interface MSG91SendResponse {
  type?: string;
  message?: string;
  request_id?: string;
}

interface MSG91OTPResponse {
  type: string;
  message: string;
}

class MSG91Service {
  private authKey: string;
  private senderId: string;
  private route: string;
  private flowId: string;
  private dltTemplateId: string;
  private dltEntityId: string;
  private baseUrl = 'https://api.msg91.com';
  private isConfigured: boolean;

  constructor() {
    this.authKey = getOptionalEnv('MSG91_AUTH_KEY') || '';
    this.senderId = getOptionalEnv('MSG91_SENDER_ID') || '';
    this.route = getOptionalEnv('MSG91_ROUTE') || '4';
    this.flowId =
      getOptionalEnv('MSG91_FLOW_ID') ||
      getOptionalEnv('MSG91_TEMPLATE_ID') ||
      getOptionalEnv('MSG91_DLT_TE_ID') ||
      '';
    this.dltTemplateId =
      getOptionalEnv('MSG91_DLT_TE_ID') ||
      getOptionalEnv('MSG91_DLT_TEMPLATE_ID') ||
      getOptionalEnv('MSG91_TEMPLATE_ID') ||
      '';
    this.dltEntityId =
      getOptionalEnv('MSG91_DLT_PE_ID') ||
      getOptionalEnv('MSG91_DLT_ENTITY_ID') ||
      getOptionalEnv('MSG91_DLT_CG_ID') ||
      '';

    this.isConfigured = Boolean(
      this.authKey &&
        this.senderId &&
        !isPlaceholderEnvValue(this.authKey) &&
        !isPlaceholderEnvValue(this.senderId)
    );

    if (!this.isConfigured) {
      logger.warn('MSG91 SMS service not configured - check MSG91_AUTH_KEY and MSG91_SENDER_ID');
    }
  }

  /**
   * Check if MSG91 is configured
   */
  public isReady(): boolean {
    return this.isConfigured;
  }

  public getConfigurationSummary() {
    return {
      configured: this.isConfigured,
      provider: 'msg91',
      senderId: this.isConfigured ? this.senderId : null,
      route: this.route,
      apiBaseUrl: this.baseUrl,
      flowConfigured: Boolean(this.flowId),
      dltTemplateConfigured: Boolean(this.dltTemplateId),
      dltEntityConfigured: Boolean(this.dltEntityId),
      indianSenderIdFormatOk: /^[A-Za-z0-9]{6,10}$/.test(this.senderId),
    };
  }

  private normalizeSendResponse(
    data: MSG91SendResponse | string
  ): { success: boolean; messageId?: string; error?: string; raw: unknown } {
    if (typeof data === 'object' && data) {
      const type = String(data.type || '').toLowerCase();
      const message = data.message || data.request_id || '';

      if (type === 'success') {
        return {
          success: true,
          messageId: message,
          raw: data,
        };
      }

      return {
        success: false,
        error: message || 'MSG91 rejected the SMS request',
        raw: data,
      };
    }

    const text = String(data || '').trim();
    const normalized = text.toLowerCase();
    const failureWords = [
      'error',
      'fail',
      'invalid',
      'unauthorized',
      'missing',
      'required',
      'insufficient',
      'template',
      'dlt',
      'denied',
      'blocked',
    ];

    if (!text || failureWords.some((word) => normalized.includes(word))) {
      return {
        success: false,
        error: text || 'MSG91 returned an empty response',
        raw: data,
      };
    }

    return {
      success: true,
      messageId: text,
      raw: data,
    };
  }

  /**
   * Send SMS message
   */
  async sendSMS(
    phoneNumber: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; warning?: string }> {
    if (!this.isConfigured) {
      logger.error('MSG91 not configured');
      return { success: false, error: 'MSG91 SMS service not configured' };
    }

    try {
      // Ensure phone number is in correct format (without +)
      const cleanPhone = phoneNumber.replace(/^\+/, '');
      const isIndianNumber = cleanPhone.startsWith('91');

      if (this.flowId) {
        const response = await axios.post<MSG91SendResponse | string>(
          `${this.baseUrl}/api/v5/flow/`,
          {
            flow_id: this.flowId,
            sender: this.senderId,
            route: this.route,
            recipients: [
              {
                mobiles: cleanPhone,
                VAR1: message,
                var: message,
              },
            ],
          },
          {
            headers: {
              authkey: this.authKey,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            timeout: 10000,
          }
        );
        const normalizedResponse = this.normalizeSendResponse(response.data);

        if (normalizedResponse.success) {
          logger.info('MSG91 flow SMS accepted', {
            phone: cleanPhone,
            flowId: this.flowId,
          });
          return {
            success: true,
            ...(normalizedResponse.messageId ? { messageId: normalizedResponse.messageId } : {}),
          };
        }

        logger.error(`MSG91 flow SMS failed: ${normalizedResponse.error}`, undefined, {
          phone: cleanPhone,
          providerResponse: normalizedResponse.raw,
        });
        return {
          success: false,
          error: normalizedResponse.error || 'MSG91 rejected the SMS flow request',
        };
      }

      if (isIndianNumber && !this.dltTemplateId) {
        logger.warn('Sending Indian SMS without DLT template id; MSG91 may accept but telecom delivery can be rejected', {
          phone: cleanPhone,
          senderId: this.senderId,
          route: this.route,
        });
      }

      const response = await axios.get<MSG91SendResponse | string>(
        `${this.baseUrl}/api/sendhttp.php`,
        {
          params: {
            authkey: this.authKey,
            mobiles: cleanPhone,
            message: message,
            sender: this.senderId,
            route: this.route,
            country: isIndianNumber ? '91' : '0',
            response: 'json',
            ...(this.dltTemplateId ? { DLT_TE_ID: this.dltTemplateId } : {}),
            ...(this.dltEntityId ? { DLT_PE_ID: this.dltEntityId } : {}),
          },
          timeout: 10000,
        }
      );
      const normalizedResponse = this.normalizeSendResponse(response.data);

      if (normalizedResponse.success) {
        logger.info('SMS sent successfully', {
          phone: cleanPhone,
          messageLength: message.length,
        });
        return {
          success: true,
          ...(normalizedResponse.messageId ? { messageId: normalizedResponse.messageId } : {}),
          ...(isIndianNumber && !this.dltTemplateId
            ? { warning: 'MSG91 accepted the request, but Indian SMS delivery needs an approved DLT template id mapped to the sender.' }
            : {}),
        };
      } else {
        logger.error(`MSG91 SMS send failed: ${normalizedResponse.error}`, undefined, {
          phone: cleanPhone,
          providerResponse: normalizedResponse.raw,
        });
        return {
          success: false,
          error: normalizedResponse.error || 'MSG91 rejected the SMS request',
        };
      }
    } catch (error) {
      logger.error('MSG91 SMS send error', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendOTP(
    phoneNumber: string,
    otp: string,
    businessName?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; warning?: string }> {
    const message = businessName
      ? `Your ${businessName} OTP is ${otp}. Please do not share this code.`
      : `Your OTP is ${otp}. Please do not share this code.`;

    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Send verification message
   */
  async sendVerification(
    phoneNumber: string,
    businessName: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; warning?: string }> {
    const message = `${businessName} has requested access to your phone number. Reply CONFIRM to allow or DENY to reject.`;
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Send bulk SMS
   */
  async sendBulkSMS(
    phoneNumbers: string[],
    message: string
  ): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors: Array<{ phone: string; error: string }>;
  }> {
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as Array<{ phone: string; error: string }>,
    };

    for (const phone of phoneNumbers) {
      const result = await this.sendSMS(phone, message);
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({ phone, error: result.error || 'Unknown error' });
      }
      // Add slight delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      success: results.failed === 0,
      ...results,
    };
  }
}

export const msg91Service = new MSG91Service();
