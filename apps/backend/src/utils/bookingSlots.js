const dayjs = require("dayjs");

// Computes available meeting slots for a "booking" field on a given date,
// from the field's specific-date availability config, minus whatever's
// already booked (existing responses' answers for that field). Naive
// (no timezone conversion — slots are generated and compared as plain
// "HH:mm on this date" in whatever timezone the form owner meant their
// availability hours to be, same as the browser's local time when
// rendered) — good enough for a single-timezone team, not a substitute
// for real timezone-aware scheduling across regions.
//
// field.bookingConfig shape:
//   { durationMinutes: 30, bufferMinutes: 0,
//     dates: [{ date: "2026-07-15", start: "09:00", end: "17:00" }, ...] }
// Each entry is one specific calendar date with its own time window —
// deliberately not a recurring weekly pattern, so the owner picks exactly
// which days they're actually free (one-off availability, not "every
// Monday forever").

function availableDates(field) {
  const config = field.bookingConfig || {};
  const dates = Array.isArray(config.dates) ? config.dates : [];
  const today = dayjs().format("YYYY-MM-DD");
  return [...new Set(dates.map((d) => d.date))].filter((d) => d >= today).sort();
}

// Every slot in the day's window(s) that's still in the future, tagged
// with whether it's already booked — the richer version used by the
// public picker so it can show taken times as visibly disabled instead
// of just omitting them (clearer than a shrinking list with no
// explanation of where the missing times went).
function allSlotsForDate(field, dateStr, bookedIsoTimes) {
  const config = field.bookingConfig || {};
  const duration = Math.max(5, Number(config.durationMinutes) || 30);
  const buffer = Math.max(0, Number(config.bufferMinutes) || 0);
  const dates = Array.isArray(config.dates) ? config.dates : [];

  const date = dayjs(dateStr, "YYYY-MM-DD", true);
  if (!date.isValid()) return [];

  const windows = dates.filter((d) => d.date === dateStr && d.start && d.end);
  if (windows.length === 0) return [];

  const booked = new Set(bookedIsoTimes || []);
  const slots = [];

  for (const window of windows) {
    const [startH, startM] = window.start.split(":").map(Number);
    const [endH, endM] = window.end.split(":").map(Number);
    let cursor = date.hour(startH).minute(startM).second(0).millisecond(0);
    const end = date.hour(endH).minute(endM).second(0).millisecond(0);

    while (cursor.add(duration, "minute").isSame(end) || cursor.add(duration, "minute").isBefore(end)) {
      if (cursor.isAfter(dayjs())) {
        const iso = cursor.toISOString();
        slots.push({ time: iso, booked: booked.has(iso) });
      }
      cursor = cursor.add(duration + buffer, "minute");
    }
  }

  return slots;
}

// Available-only ISO times — used for the server-side conflict re-check
// on submission (forms.js), which just needs a simple "is this exact
// time still bookable" answer.
function slotsForDate(field, dateStr, bookedIsoTimes) {
  return allSlotsForDate(field, dateStr, bookedIsoTimes)
    .filter((s) => !s.booked)
    .map((s) => s.time);
}

// Every already-booked ISO start time for this field, across every
// response on the form (decrypted answers passed in — this module has no
// DB/crypto dependency, keeping it easy to unit test).
function extractBookedTimes(field, decryptedAnswers) {
  return decryptedAnswers
    .map((answers) => answers?.[field.id])
    .filter((v) => typeof v === "string" && v);
}

module.exports = { availableDates, allSlotsForDate, slotsForDate, extractBookedTimes };
