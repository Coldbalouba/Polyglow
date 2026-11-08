import "server-only";
import { prisma } from "./db";

/** Average rating and review count per tutor id. */
export async function ratingsFor(tutorIds: string[]) {
  if (tutorIds.length === 0) return new Map<string, { avg: number; count: number }>();
  const reviews = await prisma.review.findMany({
    where: { booking: { tutorId: { in: tutorIds } } },
    select: { rating: true, booking: { select: { tutorId: true } } },
  });
  const map = new Map<string, { avg: number; count: number }>();
  for (const r of reviews) {
    const cur = map.get(r.booking.tutorId) ?? { avg: 0, count: 0 };
    const count = cur.count + 1;
    map.set(r.booking.tutorId, { avg: (cur.avg * cur.count + r.rating) / count, count });
  }
  return map;
}
