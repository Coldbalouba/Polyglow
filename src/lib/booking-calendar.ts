import { config } from "./config";
import type { CalendarEvent } from "./ics";

type B = {
  id: string; startsAt: Date; durationMin: number; language: string; isTrial: boolean; meetingUrl: string | null;
  tutor: { user: { name: string } }; student: { name: string };
};

export function calendarEventFor(b: B, forStudent: boolean): CalendarEvent {
  const other = forStudent ? b.tutor.user.name : b.student.name;
  const url = `${config.appUrl}/bookings/${b.id}`;
  return {
    uid: b.id,
    start: b.startsAt,
    durationMin: b.durationMin,
    title: `${b.isTrial ? "Trial " : ""}${b.language} lesson with ${other} (Polyglow)`,
    description: `Join from your booking page: ${url}`,
    location: b.meetingUrl,
    url,
  };
}
