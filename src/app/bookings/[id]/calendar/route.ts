import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { calendarEventFor } from "@/lib/booking-calendar";
import { buildIcs } from "@/lib/ics";

/** Downloads the lesson as an .ics file for Apple Calendar, Outlook and others. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { tutor: { include: { user: true } }, student: true } });
  if (!booking || (booking.studentId !== user.id && booking.tutor.userId !== user.id)) return new Response("Not found", { status: 404 });
  const ics = buildIcs(calendarEventFor(booking, booking.studentId === user.id));
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="polyglow-lesson-${booking.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
