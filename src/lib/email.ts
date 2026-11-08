import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { config } from "./config";

/**
 * Transactional email. Pick one transport with environment variables:
 * - SMTP_URL (any provider: Amazon SES, your domain host's mailbox, Postmark, Brevo…)
 *   e.g. smtps://USER:PASS@email-smtp.eu-west-1.amazonaws.com:465
 * - RESEND_API_KEY
 * - neither: emails are printed to the server log (local dev).
 * Failures are logged and never break the user's action.
 */
let smtp: Transporter | null = null;
let resend: Resend | null = null;

export async function sendEmail(to: string | string[], subject: string, text: string) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return;
  try {
    if (process.env.SMTP_URL) {
      smtp ??= nodemailer.createTransport(process.env.SMTP_URL);
      await smtp.sendMail({ from: config.emailFrom, to: recipients, replyTo: config.supportEmail, subject, text });
    } else if (config.resendApiKey) {
      resend ??= new Resend(config.resendApiKey);
      const { error } = await resend.emails.send({ from: config.emailFrom, to: recipients, replyTo: config.supportEmail, subject, text });
      if (error) console.error("[email] send failed", error);
    } else {
      console.info(`[email:dev] to=${recipients.join(",")} subject="${subject}"\n${text}\n`);
    }
  } catch (e) {
    console.error("[email] send failed", e);
  }
}

export const link = (path: string) => `${config.appUrl}${path}`;

export const signature = `\n\n— Polyglow\nQuestions? Reply to this email.`;
