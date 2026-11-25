export function toWallClockIso(value: Date | string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 19);
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)) {
      return trimmed.replace(' ', 'T').slice(0, 19);
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateLocal(parsed);
    }
    return trimmed;
  }
  return formatDateLocal(value);
}

function formatDateLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function normalizeDepartureInput(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Accept YYYY-MM-DDTHH:mm, YYYY-MM-DDTHH:mm:ss, or YYYY-MM-DD HH:mm(:ss)
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/
  );
  if (!match) return null;
  const [, datePart, timePart, secPart] = match;
  const parsed = new Date(`${datePart}T${timePart}:${secPart ?? '00'}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${datePart} ${timePart}:${secPart ?? '00'}`;
}

