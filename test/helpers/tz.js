"use strict";

/**
 * Time zone helpers for the tests, built on Intl. The add-on uses
 * Utilities.formatDate and Utilities.parseDate in Apps Script; these do the
 * same conversions in Node.js.
 */

const formatters = {};

function partsFormatter(timeZone) {
  if (!formatters[timeZone]) {
    formatters[timeZone] = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
    });
  }
  return formatters[timeZone];
}

/** Wall-clock fields of an instant in a time zone. */
function wallClock(epochMs, timeZone) {
  const fields = {};
  partsFormatter(timeZone)
    .formatToParts(new Date(epochMs))
    .forEach((part) => {
      fields[part.type] = part.value;
    });
  return {
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    second: Number(fields.second),
    weekday: fields.weekday,
  };
}

function offsetMs(epochMs, timeZone) {
  const w = wallClock(epochMs, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(epochMs / 1000) * 1000;
}

/** Instant of a local wall time ("YYYY-MM-DD" plus minutes after midnight) in a time zone. */
function localToEpoch(dateText, minutes, timeZone) {
  const [year, month, day] = dateText.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  let epoch = wall;
  for (let i = 0; i < 3; i++) epoch = wall - offsetMs(epoch, timeZone);
  return epoch;
}

/** "+01:00" style offset of an instant in a time zone. */
function isoOffset(epochMs, timeZone) {
  const minutes = Math.round(offsetMs(epochMs, timeZone) / 60000);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return sign + String(Math.floor(abs / 60)).padStart(2, "0") + ":" + String(abs % 60).padStart(2, "0");
}

/** Local ISO 8601 with offset, as AlAdhan returns with iso8601=true. */
function toLocalIso(epochMs, timeZone) {
  const w = wallClock(epochMs, timeZone);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:00` + isoOffset(epochMs, timeZone)
  );
}

/**
 * A small subset of Java SimpleDateFormat, enough for the patterns the add-on
 * passes to Utilities.formatDate and Utilities.parseDate.
 */
function formatDate(date, timeZone, pattern) {
  const w = wallClock(date.getTime(), timeZone);
  const pad = (n, size) => String(n).padStart(size, "0");
  const tokens = {
    yyyy: () => pad(w.year, 4),
    MM: () => pad(w.month, 2),
    dd: () => pad(w.day, 2),
    HH: () => pad(w.hour, 2),
    mm: () => pad(w.minute, 2),
    ss: () => pad(w.second, 2),
    EEEE: () => w.weekday,
  };
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss|EEEE/g, (token) => tokens[token]());
}

function parseDate(text, timeZone, pattern) {
  if (pattern !== "yyyy-MM-dd HH:mm") throw new Error("Test parseDate supports only yyyy-MM-dd HH:mm, got " + pattern);
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/.exec(text);
  if (!match) throw new Error("Unparseable date: " + text);
  return new Date(localToEpoch(match[1], Number(match[2]) * 60 + Number(match[3]), timeZone));
}

module.exports = { wallClock, localToEpoch, toLocalIso, isoOffset, formatDate, parseDate };
