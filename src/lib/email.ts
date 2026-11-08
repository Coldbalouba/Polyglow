import "server-only";
import { Resend } from "resend";
import { config } from "./config";

let client: Resend | null = null;

/**
 * Send a transactional email through Resend (free tier: 3,000/month, 100/day).
 * Without RESEND_API_KEY the email is printed to the server log instead, so local dev works.
 * Email failures never break the user's action; they are logged.
 */
export async function sendEmail(to: string | string[], subject: string, text: string) {
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) return;
  if (!config.resendApiKey) {
    console.info(`[email:dev] to=${recipients.join(",")} subject="${subject}"\n${text}\n`);
    return;
  }
  try {
    client ??= new Resend(config.resendApiKey);
    const { error } = await client.emails.send({ from: config.emailFrom, to: recipients, subject, text });
    if (error) console.error("[email] send failed", error);
  } catch (e) {
    console.error("[email] send failed", e);
  }
}

export const link = (path: string) => `${config.appUrl}${path}`;

export const signature = `\n\n— TutConnect\nQuestions? Reply to ${config.supportEmail}`;
