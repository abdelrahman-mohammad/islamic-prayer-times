"use strict";

/**
 * Builds synthetic AlAdhan calendar responses in the documented format, for
 * any month and time zone. The times are sample values that drift a little
 * from day to day; they are not real prayer times. Hijri dates use the
 * tabular (arithmetic) Islamic calendar, so Ramadan falls on realistic dates.
 */

const tz = require("./tz");

const BASE_MINUTES = {
  Imsak: 5 * 60 + 1,
  Fajr: 5 * 60 + 11,
  Sunrise: 6 * 60 + 47,
  Dhuhr: 11 * 60 + 43,
  Asr: 14 * 60 + 17,
  Sunset: 16 * 60 + 37,
  Maghrib: 16 * 60 + 37,
  Isha: 18 * 60 + 10,
  Midnight: 23 * 60 + 42,
  Firstthird: 21 * 60,
  Lastthird: 2 * 60 + 24,
};

function gregorianToJd(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/** Tabular Islamic calendar (civil epoch). Within a day or two of the observed calendar. */
function hijriFor(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  const jd = gregorianToJd(year, month, day);
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  const l1 = l0 - 10631 * n + 354;
  const j =
    Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) +
    Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
  const l2 =
    l1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hMonth = Math.floor((24 * l2) / 709);
  const hDay = l2 - Math.floor((709 * hMonth) / 24);
  const hYear = 30 * n + j - 30;
  return { year: hYear, month: hMonth, day: hDay };
}

/** Sample minutes for a day: a few minutes of drift so days differ. */
function minutesFor(dateText, offsets) {
  const day = Number(dateText.slice(8, 10));
  const drift = (day % 7) - 3;
  const result = {};
  Object.keys(BASE_MINUTES).forEach((name) => {
    const shift = name === "Dhuhr" ? 0 : drift;
    result[name] = BASE_MINUTES[name] + shift + ((offsets && offsets[name]) || 0);
  });
  return result;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** One entry of the data array, as AlAdhan's calendar endpoint returns it. */
function aladhanEntry(dateText, options) {
  const timeZone = options.timeZone;
  const minutes = minutesFor(dateText, options.offsets);
  const timings = {};
  Object.keys(minutes).forEach((name) => {
    const m = minutes[name];
    const afterMidnight = name === "Lastthird";
    const [y, mo, d] = dateText.split("-").map(Number);
    const localDate = afterMidnight
      ? new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10)
      : dateText;
    const epoch = tz.localToEpoch(localDate, m, timeZone);
    timings[name] = options.iso === false
      ? `${pad(Math.floor(m / 60))}:${pad(m % 60)} (${options.abbreviation || "LOCAL"})`
      : tz.toLocalIso(epoch, timeZone);
  });
  const [year, month, day] = dateText.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const hijri = hijriFor(dateText);
  return {
    timings,
    date: {
      readable: `${pad(day)} ${new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${year}`,
      timestamp: String(Math.floor(Date.UTC(year, month - 1, day) / 1000)),
      gregorian: {
        date: `${pad(day)}-${pad(month)}-${year}`,
        format: "DD-MM-YYYY",
        day: pad(day),
        weekday: { en: weekday },
        month: { number: month, en: "" },
        year: String(year),
        designation: { abbreviated: "AD", expanded: "Anno Domini" },
      },
      hijri: {
        date: `${pad(hijri.day)}-${pad(hijri.month)}-${hijri.year}`,
        format: "DD-MM-YYYY",
        day: pad(hijri.day),
        weekday: { en: "" },
        month: { number: hijri.month, en: "" },
        year: String(hijri.year),
        designation: { abbreviated: "AH", expanded: "Anno Hegirae" },
        holidays: [],
        adjustedHolidays: [],
      },
    },
    meta: {
      latitude: options.latitude,
      longitude: options.longitude,
      timezone: timeZone,
      method: { id: options.method === undefined ? 3 : options.method, name: "", params: {} },
      latitudeAdjustmentMethod: "ANGLE_BASED",
      midnightMode: "STANDARD",
      school: "STANDARD",
      offset: {},
    },
  };
}

/** A full month from the calendar endpoint. */
function aladhanMonth(year, month, options) {
  const data = [];
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    data.push(aladhanEntry(`${year}-${pad(month)}-${pad(day)}`, options));
  }
  return { code: 200, status: "OK", data };
}

module.exports = { aladhanMonth, aladhanEntry, hijriFor, minutesFor, BASE_MINUTES };
