import "server-only";

/** Central place for environment configuration. Optional services degrade to safe local fallbacks. */
export const config = {
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "TutConnect <hello@example.com>",
  supportEmail: process.env.SUPPORT_EMAIL || "support@example.com",
  adminEmails: (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  cronSecret: process.env.CRON_SECRET || "",
  currency: "usd",
};

export const paymentsLive = () => Boolean(config.stripeSecretKey);
