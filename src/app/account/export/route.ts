import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** "Download my data": everything we hold about the signed-in user, as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const profile = await prisma.tutorProfile.findUnique({
    where: { userId: user.id },
    include: {
      languages: true,
      slots: true,
      application: { omit: { resumeData: true } },
      bookings: { include: { review: true, dispute: true } },
    },
  });
  const data = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    tutorProfile: profile,
    lessonsAsStudent: await prisma.booking.findMany({ where: { studentId: user.id }, include: { review: true, dispute: true } }),
    messagesWritten: await prisma.message.findMany({ where: { authorId: user.id } }),
    reviewsWritten: await prisma.review.findMany({ where: { authorId: user.id } }),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="polyglow-my-data.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
