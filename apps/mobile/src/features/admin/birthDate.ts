export const MIN_BIRTH_YEAR = 1900;

export function toIsoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  )
    return null;
  return date;
}

export function isValidBirthDate(value: string, today = new Date()) {
  const date = parseIsoDate(value);
  if (!date || date.getFullYear() < MIN_BIRTH_YEAR) return false;
  const endOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
  );
  return date <= endOfToday;
}

export function formatBirthDate(value: string) {
  const date = parseIsoDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function calendarDays(year: number, month: number) {
  const count = new Date(year, month + 1, 0).getDate();
  const mondayFirstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  return [
    ...Array.from({ length: mondayFirstOffset }, () => null),
    ...Array.from({ length: count }, (_, index) => index + 1),
  ];
}
