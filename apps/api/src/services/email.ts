import { env } from '../env';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailService {
  sendEmail(template: EmailTemplate): Promise<boolean>;
}

// Development email service - logs to console and file
class DevelopmentEmailService implements EmailService {
  private logFile = 'emails.log';

  async sendEmail(template: EmailTemplate): Promise<boolean> {
    const timestamp = new Date().toISOString();
    const logEntry = `
========================================
Email sent at: ${timestamp}
To: ${template.to}
Subject: ${template.subject}
----------------------------------------
HTML Content:
${template.html}
----------------------------------------
Text Content:
${template.text || 'N/A'}
========================================
`;

    // Log to console
    console.log(logEntry);

    // Log to file (in development)
    try {
      const fs = await import('fs/promises');
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.warn('Could not write to email log file:', error);
    }

    return true;
  }
}

// SendGrid email service
class SendGridEmailService implements EmailService {
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async sendEmail(template: EmailTemplate): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: template.to }],
              subject: template.subject,
            },
          ],
          from: { email: this.fromEmail },
          content: [
            {
              type: 'text/html',
              value: template.html,
            },
            ...(template.text ? [{
              type: 'text/plain',
              value: template.text,
            }] : []),
          ],
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('SendGrid email error:', error);
      return false;
    }
  }
}

// AWS SES email service
class AWSEmailService implements EmailService {
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private fromEmail: string;

  constructor(region: string, accessKeyId: string, secretAccessKey: string, fromEmail: string) {
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.fromEmail = fromEmail;
  }

  async sendEmail(template: EmailTemplate): Promise<boolean> {
    try {
      // For AWS SES, we'd use the AWS SDK
      // This is a simplified implementation
      const AWS = await import('@aws-sdk/client-ses');
      const { SESClient, SendEmailCommand } = AWS;
      
      const sesClient = new SESClient({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [template.to],
        },
        Message: {
          Subject: {
            Data: template.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: template.html,
              Charset: 'UTF-8',
            },
            ...(template.text ? {
              Text: {
                Data: template.text,
                Charset: 'UTF-8',
              },
            } : {}),
          },
        },
      });

      await sesClient.send(command);
      return true;
    } catch (error) {
      console.error('AWS SES email error:', error);
      return false;
    }
  }
}

// Email service factory
export function createEmailService(): EmailService {
  const emailProvider = process.env.EMAIL_PROVIDER || 'development';
  const fromEmail = process.env.FROM_EMAIL || 'noreply@backendhub.com';

  switch (emailProvider) {
    case 'sendgrid':
      const sendGridApiKey = process.env.SENDGRID_API_KEY;
      if (!sendGridApiKey) {
        throw new Error('SENDGRID_API_KEY environment variable is required');
      }
      return new SendGridEmailService(sendGridApiKey, fromEmail);

    case 'aws-ses':
      const awsRegion = process.env.AWS_SES_REGION;
      const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      
      if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
        throw new Error('AWS SES environment variables are required');
      }
      return new AWSEmailService(awsRegion, awsAccessKeyId, awsSecretAccessKey, fromEmail);

    case 'development':
    default:
      return new DevelopmentEmailService();
  }
}

// Email templates
export class EmailTemplates {
  static verificationEmail(email: string, verificationUrl: string): EmailTemplate {
    return {
      to: email,
      subject: 'Verify your email address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50;">Welcome to BackendHub!</h1>
            <p>Thank you for signing up. Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #7f8c8d;">${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #7f8c8d;">
              If you didn't create an account with us, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to BackendHub!

Thank you for signing up. Please verify your email address by visiting this link:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with us, please ignore this email.
      `
    };
  }

  static passwordResetEmail(email: string, resetUrl: string): EmailTemplate {
    return {
      to: email,
      subject: 'Reset your password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset your password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50;">Password Reset Request</h1>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #7f8c8d;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #7f8c8d;">
              If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset Request

We received a request to reset your password. Visit this link to set a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
      `
    };
  }
}

// Export singleton instance
export const emailService = createEmailService();
