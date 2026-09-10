// Converts a naive "datetime-local" string (e.g. "2026-09-10T14:30", no
// offset) into the correct UTC instant for a given IANA timezone. Intl only
// supports the reverse direction (formatting an instant *into* a timezone),
// so we derive the offset by formatting our best guess and correcting for
// the difference — the same technique libraries like date-fns-tz use.
export function zonedTimeToUtc(localDateTimeString: string, timeZone: string): Date {
  const guess = new Date(`${localDateTimeString}Z`);
  const offsetMinutes = getTimeZoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

// Offset (in minutes) that `timeZone` is ahead of UTC at the instant `date`
// represents, e.g. +120 for CEST. On a DST transition where the local wall
// clock is ambiguous or skipped, this picks whichever instant Intl resolves
// to rather than throwing.
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - date.getTime()) / 60_000;
}
