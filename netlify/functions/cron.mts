// Netlify scheduled function: runs hourly and calls the app's housekeeping endpoint
// (release unpaid holds, auto-complete lessons after the 24h problem window, send reminders).
import type { Config } from "@netlify/functions";

const handler = async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("missing URL or CRON_SECRET", { status: 500 });
  const res = await fetch(`${base}/api/cron`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  return new Response(await res.text(), { status: res.status });
};

export default handler;

export const config: Config = { schedule: "@hourly" };
