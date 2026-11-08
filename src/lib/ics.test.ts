import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, icsEscape } from "./ics";

const ev = {
  uid: "b1",
  start: new Date("2026-12-01T15:00:00Z"),
  durationMin: 45,
  title: "Spanish lesson with Sofía",
  description: "Bring questions; we'll review verbs.",
  location: "https://meet.jit.si/Polyglow-b1",
  url: "https://polyglow.com/bookings/b1",
};

describe("ics", () => {
  it("escapes special characters", () => {
    expect(icsEscape("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
  it("builds a valid event with the right times", () => {
    const ics = buildIcs(ev, new Date("2026-11-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261201T150000Z");
    expect(ics).toContain("DTEND:20261201T154500Z");
    expect(ics).toContain("UID:b1@polyglow");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75)).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("makes a Google Calendar link", () => {
    const u = new URL(googleCalendarUrl(ev));
    expect(u.searchParams.get("dates")).toBe("20261201T150000Z/20261201T154500Z");
  });
});
