/**
 * Demo data. Run with `npm run db:seed`. All demo accounts use the password "password123".
 *   admin@polyglow.dev    — admin (reviews applications)
 *   student@polyglow.dev  — student
 *   sofia@polyglow.dev    — approved Spanish tutor (past the 5-class intro period)
 *   kenji@polyglow.dev    — approved Japanese tutor (new, on the 1% intro rate)
 *   amelie@polyglow.dev   — French tutor whose application is waiting for review
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { feeForClass, sessionPriceCents } from "../src/lib/fees";


const prisma = new PrismaClient();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const LESSON_PLAN = `## Objective
Students can order food and ask about dishes politely using "quisiera" and "¿qué lleva…?".

## Warm-up (5 min)
Favourite foods and the last restaurant visit.

## Presentation (10 min)
Menu vocabulary and polite request forms through a short dialogue.

## Controlled practice (10 min)
Substitution drill and matching menu items to descriptions.

## Free practice (25 min)
Role-play: student orders for a group with dietary needs; tutor plays the waiter.

## Feedback (10 min)
Review errors noted during role-play; student self-corrects.

## Homework
Record a 1-minute voice note ordering a three-course meal.`;

async function main() {
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.message.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.tutorApplication.deleteMany();
  await prisma.tutorLanguage.deleteMany();
  await prisma.tutorProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);
  const mk = (email: string, name: string, role: string) => prisma.user.create({ data: { email, name, role, passwordHash } });

  await mk("admin@polyglow.dev", "Ada Admin", "ADMIN");
  const student = await mk("student@polyglow.dev", "Sam Student", "STUDENT");
  const student2 = await mk("lena@polyglow.dev", "Lena Park", "STUDENT");

  async function tutor(opts: {
    email: string; name: string; country: string; headline: string; bio: string; rate: number;
    languages: [string, string][]; status: "APPROVED" | "SUBMITTED"; trialPriceCents?: number | null;
  }) {
    const user = await mk(opts.email, opts.name, "TUTOR");
    const approved = opts.status === "APPROVED";
    return prisma.tutorProfile.create({
      data: {
        userId: user.id,
        headline: opts.headline,
        bio: opts.bio,
        country: opts.country,
        hourlyRateCents: opts.rate,
        trialPriceCents: opts.trialPriceCents ?? null,
        status: opts.status,
        languages: { create: opts.languages.map(([language, level]) => ({ language, level })) },
        application: {
          create: {
            status: opts.status,
            submittedAt: new Date(Date.now() - 10 * DAY),
            reviewedAt: approved ? new Date(Date.now() - 8 * DAY) : null,
            resumeFileName: "resume.pdf",
            resumeMime: "application/pdf",
            resumeData: new Uint8Array(Buffer.from("%PDF-1.4\n% demo resume\n")),
            skillCheckScore: 88,
            skillCheckPassed: true,
            writingSample:
              "Usamos el subjuntivo después de expresiones de deseo o duda: «Quiero que vengas», «No creo que llueva». Si el sujeto es el mismo, usamos el infinitivo: «Quiero venir».",
            lessonPlanTitle: "Ordering at a restaurant",
            lessonPlan: LESSON_PLAN,
            lessonPlanAiTool: "Claude",
            resumeVerified: approved,
            liveCheckPassed: approved,
            lessonPlanApproved: approved,
          },
        },
      },
    });
  }

  const sofia = await tutor({
    email: "sofia@polyglow.dev", name: "Sofía Martínez", country: "Spain", rate: 3000, status: "APPROVED",
    headline: "Conversational Spanish for travellers and professionals",
    bio: "Native speaker from Madrid with 8 years of teaching experience and a DELE examiner certificate. My lessons are 70% you talking, with clear feedback after every activity.",
    languages: [["Spanish", "NATIVE"], ["English", "C1"]],
  });
  const kenji = await tutor({
    email: "kenji@polyglow.dev", name: "Kenji Watanabe", country: "Japan", rate: 2500, status: "APPROVED", trialPriceCents: 1000,
    headline: "Japanese from zero to JLPT N3, step by step",
    bio: "Tokyo-born teacher who loves helping beginners read their first manga. I build every lesson around your goals, with spaced-repetition vocab decks between classes.",
    languages: [["Japanese", "NATIVE"]],
  });
  await tutor({
    email: "amelie@polyglow.dev", name: "Amélie Durand", country: "France", rate: 2800, status: "SUBMITTED",
    headline: "French pronunciation and DELF exam coaching",
    bio: "Former high-school teacher in Lyon. I specialise in pronunciation and helping adult learners pass the DELF B1 and B2 exams with confidence.",
    languages: [["French", "NATIVE"]],
  });

  // Sofía: 6 completed classes (5 at 1%, then 5%), with reviews.
  for (let i = 0; i < 6; i++) {
    const startsAt = new Date(Date.now() - (20 - i * 2) * DAY);
    const slot = await prisma.availabilitySlot.create({ data: { tutorId: sofia.id, startsAt, durationMin: 60, isBooked: true } });
    const fee = feeForClass(sessionPriceCents(sofia.hourlyRateCents, 60), i);
    const b = await prisma.booking.create({
      data: {
        studentId: i % 2 ? student2.id : student.id, tutorId: sofia.id, slotId: slot.id, language: "Spanish",
        startsAt, durationMin: 60, priceCents: fee.priceCents, feeRateBps: fee.feeRateBps,
        platformFeeCents: fee.platformFeeCents, tutorPayoutCents: fee.tutorPayoutCents,
        status: "COMPLETED", paymentRef: `seed_${i}`, completedAt: new Date(startsAt.getTime() + HOUR),
      },
    });
    if (i < 4) {
      await prisma.review.create({
        data: {
          bookingId: b.id, authorId: b.studentId, rating: i === 2 ? 4 : 5,
          comment: ["Super patient and well prepared!", "I finally get the subjunctive.", "Great role-plays.", "Best tutor I've had."][i],
        },
      });
    }
  }

  // Open future slots for both approved tutors.
  for (const t of [sofia, kenji]) {
    for (let d = 1; d <= 6; d++) {
      for (const hour of [9, 17]) {
        const startsAt = new Date(Date.now() + d * DAY);
        startsAt.setUTCHours(hour, 0, 0, 0);
        await prisma.availabilitySlot.create({ data: { tutorId: t.id, startsAt, durationMin: 60 } });
      }
    }
  }

  // Kenji: one confirmed upcoming class with Sam.
  const kSlot = await prisma.availabilitySlot.findFirstOrThrow({ where: { tutorId: kenji.id }, orderBy: { startsAt: "asc" } });
  const kFee = feeForClass(kenji.hourlyRateCents, 0);
  await prisma.availabilitySlot.update({ where: { id: kSlot.id }, data: { isBooked: true } });
  await prisma.booking.create({
    data: {
      studentId: student.id, tutorId: kenji.id, slotId: kSlot.id, language: "Japanese", startsAt: kSlot.startsAt,
      durationMin: 60, priceCents: kFee.priceCents, feeRateBps: kFee.feeRateBps, platformFeeCents: kFee.platformFeeCents,
      tutorPayoutCents: kFee.tutorPayoutCents, status: "CONFIRMED", paymentRef: "seed_k", isTrial: false,
      meetingUrl: `https://meet.jit.si/Polyglow-seed-k`, confirmedAt: new Date(),
    },
  });

  // Sofía: a lesson that ended 2 hours ago, waiting for Sam to confirm or report a problem.
  const endedStart = new Date(Date.now() - 3 * HOUR);
  const endedSlot = await prisma.availabilitySlot.create({ data: { tutorId: sofia.id, startsAt: endedStart, durationMin: 60, isBooked: true } });
  const eFee = feeForClass(3000, 6);
  await prisma.booking.create({
    data: {
      studentId: student.id, tutorId: sofia.id, slotId: endedSlot.id, language: "Spanish", startsAt: endedStart, durationMin: 60,
      priceCents: eFee.priceCents, feeRateBps: eFee.feeRateBps, platformFeeCents: eFee.platformFeeCents, tutorPayoutCents: eFee.tutorPayoutCents,
      status: "CONFIRMED", paymentRef: "seed_e", meetingUrl: "https://meet.jit.si/Polyglow-seed-e", confirmedAt: new Date(Date.now() - 2 * 86400_000),
    },
  });

  console.log("Seeded. Log in with any demo account using password: password123");
}

main().finally(() => prisma.$disconnect());
