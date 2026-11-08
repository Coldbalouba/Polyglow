import "server-only";
import { prisma } from "./db";
import { rankingScore } from "./policy";

export interface TutorStats {
  avg: number;
  count: number;
  completed: number;
  tutorCancellations90d: number;
  score: number;
}

/** Ratings, lesson counts, reliability and the transparent ranking score for a set of tutors. */
export async function statsFor(tutorIds: string[]): Promise<Map<string, TutorStats>> {
  const map = new Map<string, TutorStats>();
  if (tutorIds.length === 0) return map;
  const since = new Date(Date.now() - 90 * 24 * 3600_000);
  const [ratings, completed, cancels] = await Promise.all([
    prisma.booking.groupBy({ by: ["tutorId"], where: { tutorId: { in: tutorIds }, review: { isNot: null } }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["tutorId"], where: { tutorId: { in: tutorIds }, status: "COMPLETED" }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["tutorId"], where: { tutorId: { in: tutorIds }, cancelledBy: "TUTOR", createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const reviews = await prisma.review.findMany({ where: { booking: { tutorId: { in: tutorIds } } }, select: { rating: true, booking: { select: { tutorId: true } } } });
  const sums = new Map<string, number>();
  for (const r of reviews) sums.set(r.booking.tutorId, (sums.get(r.booking.tutorId) ?? 0) + r.rating);
  const get = (rows: { tutorId: string; _count: { _all: number } }[], id: string) => rows.find((r) => r.tutorId === id)?._count._all ?? 0;
  for (const id of tutorIds) {
    const count = get(ratings, id);
    const sum = sums.get(id) ?? 0;
    const s = { ratingSum: sum, ratingCount: count, completed: get(completed, id), tutorCancellations90d: get(cancels, id) };
    map.set(id, { avg: count ? sum / count : 0, count, completed: s.completed, tutorCancellations90d: s.tutorCancellations90d, score: rankingScore(s) });
  }
  return map;
}
