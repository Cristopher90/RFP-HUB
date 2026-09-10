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

// The read-side counterpart to zonedTimeToUtc: formats a stored UTC instant
// back into a "datetime-local" string (e.g. "2026-09-10T14:30") in the given
// IANA timezone, for pre-filling a datetime-local input with the value the
// owning user would recognize — instead of native Date getters, which read
// the server process's own runtime timezone.
export function utcToZonedTime(date: Date, timeZone: string): string {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function getZonedDateParts(date: Date, timeZone: string): Record<string, string> {
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
  return formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
}

// Offset (in minutes) that `timeZone` is ahead of UTC at the instant `date`
// represents, e.g. +120 for CEST. On a DST transition where the local wall
// clock is ambiguous or skipped, this picks whichever instant Intl resolves
// to rather than throwing.
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getZonedDateParts(date, timeZone);
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
