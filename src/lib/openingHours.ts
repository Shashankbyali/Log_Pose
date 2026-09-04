import type { OpenState } from "./types";

/**
 * Minimal, deterministic parser for the common subset of the OSM
 * `opening_hours` syntax.
 *
 * Design rule: this parser NEVER guesses. Anything it does not fully
 * understand returns "unknown" rather than defaulting to open or closed,
 * because "no opening data" and "closed" are different facts.
 */

const DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

/** Tokens we deliberately refuse to interpret. */
const UNSUPPORTED = [
  "ph",
  "sh",
  "sunrise",
  "sunset",
  "dawn",
  "dusk",
  "week",
  "easter",
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
  "[",
];

export interface ClockNow {
  /** 0 = Sunday. */
  day: number;
  /** Minutes since local midnight. */
  minutes: number;
}

/** Current wall-clock time in a given IANA timezone (default Bengaluru). */
export function nowInTimeZone(
  timeZone = "Asia/Kolkata",
  date = new Date(),
): ClockNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const lookup = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const day = DAY_INDEX[lookup("weekday").slice(0, 2).toLowerCase()] ?? 0;
  const hour = Number(lookup("hour")) % 24;
  const minute = Number(lookup("minute"));

  return { day, minutes: hour * 60 + minute };
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseDaySelector(token: string): number[] | null {
  const days = new Set<number>();

  for (const part of token.split(",")) {
    const range = part.trim().toLowerCase();
    if (!range) continue;

    const rangeMatch = /^([a-z]{2})-([a-z]{2})$/.exec(range);
    if (rangeMatch) {
      const from = DAY_INDEX[rangeMatch[1]];
      const to = DAY_INDEX[rangeMatch[2]];
      if (from === undefined || to === undefined) return null;
      for (let i = 0; i < 7; i++) {
        const day = (from + i) % 7;
        days.add(day);
        if (day === to) break;
      }
      continue;
    }

    const single = DAY_INDEX[range];
    if (single === undefined) return null;
    days.add(single);
  }

  return days.size > 0 ? [...days] : null;
}

/** True when `now` falls inside `start`-`end`, handling past-midnight ranges. */
function withinRange(now: number, start: number, end: number): boolean {
  if (end === start) return true;
  if (end > start) return now >= start && now < end;
  return now >= start || now < end;
}

/**
 * Resolves an OSM `opening_hours` value to open / closed / unknown.
 * Returns "unknown" when the value is absent or uses syntax we do not support.
 */
export function resolveOpenState(
  openingHours: string | null | undefined,
  now: ClockNow = nowInTimeZone(),
): OpenState {
  if (!openingHours) return "unknown";

  const value = openingHours.trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "24/7" || value === "24/7; open" || value === "mo-su 00:00-24:00") {
    return "open";
  }
  if (value === "closed" || value === "off") return "closed";
  if (UNSUPPORTED.some((token) => value.includes(token))) return "unknown";

  let matchedAnyRule = false;
  let openNow = false;
  let explicitlyClosedToday = false;

  for (const rule of value.split(";")) {
    const trimmed = rule.trim();
    if (!trimmed) continue;

    // Split leading day selector from the time selector.
    const ruleMatch = /^([a-z,\- ]*?)\s*((?:\d{1,2}:\d{2}-\d{1,2}:\d{2}[, ]*)+|off|closed)$/.exec(
      trimmed,
    );
    if (!ruleMatch) return "unknown";

    const [, daysToken, timesToken] = ruleMatch;

    let days: number[];
    if (!daysToken.trim()) {
      days = [0, 1, 2, 3, 4, 5, 6];
    } else {
      const parsed = parseDaySelector(daysToken);
      if (!parsed) return "unknown";
      days = parsed;
    }

    if (!days.includes(now.day)) continue;
    matchedAnyRule = true;

    if (timesToken === "off" || timesToken === "closed") {
      explicitlyClosedToday = true;
      continue;
    }

    for (const span of timesToken.split(",")) {
      const spanTrimmed = span.trim();
      if (!spanTrimmed) continue;
      const [startRaw, endRaw] = spanTrimmed.split("-");
      const start = parseClock(startRaw ?? "");
      const end = parseClock(endRaw ?? "");
      if (start === null || end === null) return "unknown";
      if (withinRange(now.minutes, start, end)) openNow = true;
    }
  }

  if (openNow) return "open";
  if (explicitlyClosedToday || matchedAnyRule) return "closed";

  // The value parsed cleanly but named no rule for today, which in OSM
  // semantics means closed today.
  return "closed";
}

/** Human-readable label that never overstates what we know. */
export function describeOpenState(state: OpenState): string {
  if (state === "open") return "Open now";
  if (state === "closed") return "Closed now";
  return "Hours unknown";
}
