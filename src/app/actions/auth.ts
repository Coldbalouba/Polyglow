"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["STUDENT", "TUTOR"]),
});

export async function signup(formData: FormData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const role = formData.get("role") === "TUTOR" ? "TUTOR" : "STUDENT";
    redirect(`/signup?role=${role}&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const { name, email, password, role } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) {
    redirect(`/signup?role=${role}&error=${encodeURIComponent("An account with this email already exists")}`);
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
  redirect(role === "TUTOR" ? "/apply" : "/tutors");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect(`/login?error=${encodeURIComponent("Wrong email or password")}`);
  }
  await createSession(user.id);
  redirect(user.role === "ADMIN" ? "/admin" : user.role === "TUTOR" ? "/apply" : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
