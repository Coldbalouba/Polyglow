import { timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
import { runScheduledJobs } from "@/lib/bookings";

/** Hourly housekeeping. Called hourly by the jobs container (deploy/jobs.sh). */
export async function POST(req: Request) {
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const expected = Buffer.from(config.cronSecret);
  if (!config.cronSecret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const stats = await runScheduledJobs();
  return Response.json(stats);
}
