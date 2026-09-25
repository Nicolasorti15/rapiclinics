import { describe, expect, it } from "vitest";
import {
  calendarDays,
  formatBirthDate,
  isValidBirthDate,
  parseIsoDate,
  toIsoDate,
} from "../src/features/admin/birthDate";

describe("birth date calendar", () => {
  it("keeps the API value in ISO format and presents it in Spanish", () => {
    expect(toIsoDate(1990, 0, 31)).toBe("1990-01-31");
    expect(formatBirthDate("1990-01-31")).toMatch(/31 de enero de 1990/i);
  });

  it("rejects impossible, future and pre-1900 dates", () => {
    const today = new Date(2026, 8, 24, 12);
    expect(parseIsoDate("2025-02-29")).toBeNull();
    expect(isValidBirthDate("2026-09-25", today)).toBe(false);
    expect(isValidBirthDate("1899-12-31", today)).toBe(false);
    expect(isValidBirthDate("2026-09-24", today)).toBe(true);
  });

  it("builds a Monday-first calendar including leap day", () => {
    const days = calendarDays(2024, 1);
    expect(days.slice(0, 3)).toEqual([null, null, null]);
    expect(days.at(-1)).toBe(29);
  });
});
