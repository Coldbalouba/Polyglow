"use client";

/** Renders a date in the viewer's own time zone. */
export function LocalTime({ iso, withDate = true }: { iso: string; withDate?: boolean }) {
  const d = new Date(iso);
  const text = d.toLocaleString(undefined, {
    ...(withDate ? { weekday: "short", month: "short", day: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}

export function TzOffsetInput() {
  return <input type="hidden" name="tzOffset" value={new Date().getTimezoneOffset()} suppressHydrationWarning readOnly />;
}
