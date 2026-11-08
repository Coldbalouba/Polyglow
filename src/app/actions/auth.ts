"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { config } from "@/lib/config";
import { link, sendEmail, signature } from "@/lib/email";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

/** The visitor's IP as set by Caddy (it overwrites X-Forwarded-For with the real client address). */
async function clientIp() {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  return (xff ? xff.split(",").pop()!.trim() : h.get("x-real-ip")) || "unknown";
}

const tooMany = (sec: number) => `Too many attempts. Try again in ${Math.ceil(sec / 60)} minute${sec > 60 ? "s" : ""}.`;

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(["STUDENT", "TUTOR"]),
  terms: z.literal("on", { message: "Please accept the Terms and Privacy Policy" }),
});

export async function signup(formData: FormData) {
  const limited = rateLimit(`signup:${await clientIp()}`, 10, 3600_000);
  if (!limited.ok) redirect(`/signup?error=${encodeURIComponent(tooMany(limited.retryAfterSec))}`);
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  const roleParam = formData.get("role") === "TUTOR" ? "TUTOR" : "STUDENT";
  if (!parsed.success) redirect(`/signup?role=${roleParam}&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { name, email, password } = parsed.data;
  // Emails listed in ADMIN_EMAILS become admins when they sign up.
  const role = config.adminEmails.includes(email) ? "ADMIN" : parsed.data.role;
  if (await prisma.user.findUnique({ where: { email } })) {
    redirect(`/signup?role=${roleParam}&error=${encodeURIComponent("An account with this email already exists. Try logging in.")}`);
  }
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await hashPassword(password),
      ...(role === "TUTOR" ? { tutorProfile: { create: { application: { create: {} } } } } : {}),
    },
  });
  await createSession(user.id);
  await sendEmail(email, "Welcome to Polyglow",
    role === "TUTOR"
      ? `Hi ${name},\n\nThanks for applying to teach. Finish your application here: ${link("/apply")}\nWe review every application by hand.${signature}`
      : `Hi ${name},\n\nWelcome! Find a vetted tutor here: ${link("/tutors")}\nPay per lesson, no subscriptions, no expiring credits.${signature}`);
  redirect(role === "ADMIN" ? "/admin" : role === "TUTOR" ? "/apply" : "/tutors");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();
  // Per account and per IP, so one attacker can't lock everyone out and can't spray one account.
  for (const key of [`login:${email}`, `login-ip:${ip}`]) {
    const r = rateLimit(key, key.startsWith("login:") ? 8 : 30, 15 * 60_000);
    if (!r.ok) redirect(`/login?error=${encodeURIComponent(tooMany(r.retryAfterSec))}`);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing a little
    redirect(`/login?error=${encodeURIComponent("Wrong email or password")}`);
  }
  resetRateLimit(`login:${email}`);
  await createSession(user.id);
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = await clientIp();
  if (!rateLimit(`reset:${email}`, 3, 3600_000).ok || !rateLimit(`reset-ip:${ip}`, 10, 3600_000).ok) {
    redirect(`/forgot?error=${encodeURIComponent("Too many reset requests. Try again in an hour.")}`);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) },
    });
    await sendEmail(email, "Reset your Polyglow password",
      `Hi ${user.name},\n\nReset your password here (valid for 1 hour):\n${link(`/reset?token=${token}`)}\n\nIf you didn't ask for this, ignore this email.${signature}`);
  }
  // Same answer either way, so the form can't be used to discover accounts.
  redirect(`/forgot?notice=${encodeURIComponent("If that email has an account, a reset link is on its way.")}`);
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect(`/reset?token=${token}&error=${encodeURIComponent("Password must be at least 8 characters")}`);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    redirect(`/forgot?error=${encodeURIComponent("That reset link is invalid or expired. Request a new one.")}`);
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await createSession(record.userId);
  redirect("/dashboard");
}
