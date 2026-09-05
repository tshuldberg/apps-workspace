// Plan datetimes are stored as local wall-time strings (YYYY-MM-DDTHH:mm),
// the format the module's calendar-payload and reminder engines parse. These
// helpers are the single conversion point between that string format and the
// Date objects the native picker works with.

const PLAN_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function planStringToDate(value: string): Date | null {
  const match = PLAN_DATETIME_RE.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  // new Date() silently rolls invalid components over (Feb 30 -> Mar 2);
  // reject anything that did not survive the round trip.
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== mi
  ) {
    return null;
  }
  return date;
}

function pad(n: number): string {
  return `${n}`.padStart(2, '0');
}

export function dateToPlanString(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function formatPlanLabel(value: string): string | null {
  const date = planStringToDate(value);
  if (!date) return null;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function roundToNextHalfHour(now: Date = new Date()): Date {
  const rounded = new Date(now);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  if (minutes === 0 || minutes === 30) return rounded;
  if (minutes < 30) {
    rounded.setMinutes(30);
  } else {
    rounded.setHours(rounded.getHours() + 1, 0);
  }
  return rounded;
}
