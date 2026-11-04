/**
 * Core.gs: pure logic for the Prayer Times add-on.
 *
 * Nothing in this file calls an Apps Script service. Every function takes
 * plain values and returns plain values, so the unit tests in test/ run it in
 * Node.js. When a function needs a time zone conversion, the caller passes a
 * converter in (Apps Script uses Utilities.parseDate, the tests use Intl).
 *
 * Names ending in an underscore are private in Apps Script: they do not show
 * up in the editor's Run menu and cannot be called from outside the script.
 */

const APP_ = Object.freeze({
  name: "Prayer Times",
  calendarName: "Prayer Times",
  settingsKey: "settings.v2",
  stateKey: "syncState.v2",
  aladhanBaseUrl: "https://api.aladhan.com/v1",
  geocodeUrl: "https://geocoding-api.open-meteo.com/v1/search",
  calendarApiUrl: "https://www.googleapis.com/calendar/v3",
  // Coordinates of the Kaaba, as used by AlAdhan's own Qibla endpoint.
  kaaba: Object.freeze({ latitude: 21.4225241, longitude: 39.8261818 }),
  // Local hour at which the daily automatic sync runs.
  syncHour: 3,
  eventVersion: "2",
});

/** Keys of the private extended properties set on every event the add-on creates. */
const TAG_ = Object.freeze({
  app: "prayerTimeEvent", // "true". Version 1 of the add-on set this key too.
  name: "prayerName", // Event slot: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha, Suhoor, Iftar.
  date: "prayerDate", // Local date at the location, YYYY-MM-DD. Missing on version 1 events.
  sig: "prayerSig", // Hash of the event content, used to skip unchanged events.
  version: "prayerVersion",
});

/** Times read from each AlAdhan day. */
const TIMING_NAMES_ = Object.freeze(["Imsak", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]);
const BEFORE_DHUHR_ = Object.freeze(["Imsak", "Fajr", "Sunrise"]);
const AFTER_DHUHR_ = Object.freeze(["Asr", "Maghrib", "Isha"]);

/** Events the user can choose, in the order they happen during the day. */
const DAILY_EVENTS_ = Object.freeze(["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]);
const OBLIGATORY_PRAYERS_ = Object.freeze(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);

/** Calculation methods offered by the AlAdhan API, by method ID. */
const METHODS_ = Object.freeze([
  { id: 3, name: "Muslim World League" },
  { id: 2, name: "Islamic Society of North America (ISNA)" },
  { id: 5, name: "Egyptian General Authority of Survey" },
  { id: 4, name: "Umm Al-Qura University, Makkah" },
  { id: 1, name: "University of Islamic Sciences, Karachi" },
  { id: 7, name: "Institute of Geophysics, University of Tehran" },
  { id: 0, name: "Shia Ithna Ashari, Leva Institute, Qum" },
  { id: 8, name: "Gulf Region" },
  { id: 9, name: "Kuwait" },
  { id: 10, name: "Qatar" },
  { id: 11, name: "Majlis Ugama Islam Singapura, Singapore" },
  { id: 12, name: "Union des Organisations Islamiques de France" },
  { id: 13, name: "Diyanet İşleri Başkanlığı, Turkey" },
  { id: 14, name: "Spiritual Administration of Muslims of Russia" },
  { id: 15, name: "Moonsighting Committee Worldwide" },
  { id: 16, name: "Dubai" },
  { id: 17, name: "Jabatan Kemajuan Islam Malaysia (JAKIM)" },
  { id: 18, name: "Tunisia" },
  { id: 19, name: "Algeria" },
  { id: 20, name: "Kementerian Agama, Indonesia (KEMENAG)" },
  { id: 21, name: "Morocco" },
  { id: 22, name: "Comunidade Islâmica de Lisboa" },
  { id: 23, name: "Ministry of Awqaf, Jordan" },
]);

/**
 * Suggested calculation method by ISO 3166-1 country code. Countries that are
 * not listed get the Muslim World League method. These are suggestions only;
 * the user sees the choice and can change it.
 */
const COUNTRY_METHOD_ = Object.freeze({
  US: 2, CA: 2,
  SA: 4,
  EG: 5, SD: 5, LY: 5, SY: 5, LB: 5,
  PK: 1, IN: 1, BD: 1, AF: 1,
  IR: 7,
  AE: 16, KW: 9, QA: 10, BH: 8, OM: 8,
  SG: 11, MY: 17, ID: 20,
  FR: 12, TR: 13, RU: 14,
  TN: 18, DZ: 19, MA: 21, PT: 22, JO: 23,
});

/** Countries where the Hanafi Asr time is the usual default. */
const HANAFI_COUNTRIES_ = Object.freeze(["PK", "IN", "BD", "AF"]);

const SCHOOLS_ = Object.freeze([
  { id: 0, name: "Standard (Shafi, Maliki, Hanbali)" },
  { id: 1, name: "Hanafi" },
]);

/** AlAdhan latitudeAdjustmentMethod values. */
const HIGH_LATITUDE_RULES_ = Object.freeze([
  { id: 3, name: "Angle based (recommended)" },
  { id: 1, name: "Middle of the night" },
  { id: 2, name: "One seventh of the night" },
]);

const HIJRI_MONTHS_ = Object.freeze([
  "Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Ula", "Jumada al-Akhirah",
  "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhu al-Hijjah",
]);

const WEEKDAYS_ = Object.freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
const MONTHS_ = Object.freeze([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);

const REMINDER_CHOICES_ = Object.freeze([null, 0, 5, 10, 15, 20, 30, 45, 60]);
const DURATION_CHOICES_ = Object.freeze([5, 10, 15, 20, 30, 45, 60]);
const DAYS_AHEAD_CHOICES_ = Object.freeze([7, 14, 30]);
const HIJRI_ADJUSTMENT_CHOICES_ = Object.freeze([-2, -1, 0, 1, 2]);
const MAX_OFFSET_MINUTES_ = 60;

/** Form field names shared by the cards (Cards.gs) and the form parser below. */
const FIELD_ = Object.freeze({
  method: "method",
  school: "school",
  highLatitudeRule: "highLatitudeRule",
  prayers: "prayers",
  jumuah: "jumuah",
  jumuahTime: "jumuahTime",
  ramadan: "ramadan",
  hijriAdjustment: "hijriAdjustment",
  reminder: "reminder",
  duration: "duration",
  showAsFree: "showAsFree",
  calendar: "calendar",
  daysAhead: "daysAhead",
  autoSync: "autoSync",
  locationQuery: "locationQuery",
  coordinates: "coordinates",
  placeName: "placeName",
});
const OFFSET_FIELD_PREFIX_ = "offset_";

/** Calendar dropdown value for the add-on's own "Prayer Times" calendar. */
const DEDICATED_CALENDAR_ = "dedicated";

/** Legacy time zone names that some systems still report, mapped to current names. */
const TZ_ALIASES_ = Object.freeze({
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Dacca": "Asia/Dhaka",
  "Asia/Istanbul": "Europe/Istanbul",
  "Asia/Ujung_Pandang": "Asia/Makassar",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "US/Eastern": "America/New_York",
  "US/Central": "America/Chicago",
  "US/Mountain": "America/Denver",
  "US/Pacific": "America/Los_Angeles",
  "US/Alaska": "America/Anchorage",
  "US/Hawaii": "Pacific/Honolulu",
  "Canada/Eastern": "America/Toronto",
  "Canada/Pacific": "America/Vancouver",
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function pad2_(n) {
  return (n < 10 ? "0" : "") + n;
}

/** Rounds to 4 decimals (about 11 metres), enough for prayer times. */
function round4_(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

/**
 * Parses a whole number written by a user. Returns NaN for anything else.
 * Unlike parseInt it rejects "5.5", "5 min" and "" instead of guessing.
 */
function parseWholeNumber_(value) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  return /^[+-]?\d+$/.test(text) ? Number(text) : NaN;
}

/** Escapes text before it goes into CardService HTML. */
function escapeHtml_(text) {
  return String(text === undefined || text === null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** FNV-1a 32-bit hash as 8 hex characters. Stable across runs and runtimes. */
function hashString_(text) {
  let hash = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** An error whose message is written for the user and is shown as is. */
function userError_(message) {
  const error = new Error(message);
  error.isUserError = true;
  return error;
}

/** The text to show the user for any error. */
function errorMessage_(error) {
  if (error && error.isUserError) return error.message;
  const text = error && error.message ? error.message : String(error);
  return "Something went wrong: " + text;
}

function toQueryString_(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key])))
    .join("&");
}

// ---------------------------------------------------------------------------
// Dates. A date is a "YYYY-MM-DD" string for a local day at the location.
// All arithmetic uses UTC so it does not depend on the runtime's time zone.
// ---------------------------------------------------------------------------

function parseIsoDate_(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text));
  if (!match) throw new Error("Invalid date: " + text);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error("Invalid date: " + text);
  }
  return { year: year, month: month, day: day };
}

function formatIsoDate_(year, month, day) {
  return String(year).padStart(4, "0") + "-" + pad2_(month) + "-" + pad2_(day);
}

function addDays_(dateText, days) {
  const p = parseIsoDate_(dateText);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return formatIsoDate_(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Day of the week, 0 = Sunday ... 6 = Saturday. */
function weekdayOf_(dateText) {
  const p = parseIsoDate_(dateText);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

function daysBetween_(fromDate, toDate) {
  const a = parseIsoDate_(fromDate);
  const b = parseIsoDate_(toDate);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
}

/** Every date from start to end, inclusive. */
function datesBetween_(startDate, endDate) {
  const count = daysBetween_(startDate, endDate);
  const dates = [];
  for (let i = 0; i <= count; i++) dates.push(addDays_(startDate, i));
  return dates;
}

/** The months that contain any date from start to end, as {year, month}. */
function monthsCovering_(startDate, endDate) {
  const months = [];
  const seen = {};
  datesBetween_(startDate, endDate).forEach((date) => {
    const p = parseIsoDate_(date);
    const key = p.year + "-" + p.month;
    if (!seen[key]) {
      seen[key] = true;
      months.push({ year: p.year, month: p.month });
    }
  });
  return months;
}

/** AlAdhan writes dates as DD-MM-YYYY. */
function aladhanDateToIso_(text) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(text));
  if (!match) throw new Error("Unexpected date from AlAdhan: " + text);
  const iso = match[3] + "-" + match[2] + "-" + match[1];
  parseIsoDate_(iso);
  return iso;
}

/** The days the sync keeps in the calendar: today and the following days. */
function syncWindow_(today, daysAhead) {
  return { start: today, end: addDays_(today, Math.max(1, daysAhead) - 1) };
}

/** "Wednesday 4 November" or, with the year, "Wednesday 4 November 2026". */
function formatLongDate_(dateText, withYear) {
  const p = parseIsoDate_(dateText);
  const text = WEEKDAYS_[weekdayOf_(dateText)] + " " + p.day + " " + MONTHS_[p.month - 1];
  return withYear ? text + " " + p.year : text;
}

/** "4 Nov" */
function formatShortDate_(dateText) {
  const p = parseIsoDate_(dateText);
  return p.day + " " + MONTHS_[p.month - 1].slice(0, 3);
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

/**
 * Parses a time from AlAdhan. Two formats are accepted:
 *   "05:12 (CET)"                local wall time, no instant
 *   "2026-11-04T05:12:00+01:00"  ISO 8601 with offset (iso8601=true)
 * Returns {minutes, epochMs, isoDate} or null. minutes is the local wall
 * time in minutes after midnight. epochMs and isoDate are null for the first
 * format.
 */
function parseAladhanTime_(text) {
  const value = String(text === undefined || text === null ? "" : text).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.exec(value);
  if (iso) {
    const hours = Number(iso[4]);
    const minutes = Number(iso[5]);
    const seconds = Number(iso[6] || 0);
    let offset = 0;
    if (iso[7] !== "Z") {
      const sign = iso[7][0] === "-" ? -1 : 1;
      const digits = iso[7].slice(1).replace(":", "");
      offset = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
    }
    const epochMs =
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), hours, minutes, seconds) - offset * 60000;
    return { minutes: hours * 60 + minutes, epochMs: epochMs, isoDate: iso[1] + "-" + iso[2] + "-" + iso[3] };
  }
  const plain = /^(\d{1,2}):(\d{2})(?:\s|$)/.exec(value);
  if (plain && Number(plain[1]) < 24 && Number(plain[2]) < 60) {
    return { minutes: Number(plain[1]) * 60 + Number(plain[2]), epochMs: null, isoDate: null };
  }
  return null;
}

/**
 * Parses a time typed by the user: "13:30", "1:30 pm", "9:05am".
 * Returns minutes after midnight, or null.
 */
function parseUserTime_(text) {
  const value = String(text === undefined || text === null ? "" : text).trim().toLowerCase();
  const match = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/.exec(value);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  if (match[3]) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (match[3] === "pm" ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Minutes after midnight as "05:12" (24-hour) or "5:12 AM" (12-hour). */
function formatClock_(minutesOfDay, use24h) {
  const total = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (use24h) return pad2_(hours) + ":" + pad2_(minutes);
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return h12 + ":" + pad2_(minutes) + (hours < 12 ? " AM" : " PM");
}

/** "45 min", "1 h", "2 h 5 min". */
function formatDuration_(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 1) return "less than a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m + " min";
  return m === 0 ? h + " h" : h + " h " + m + " min";
}

/** RFC 3339 in UTC without milliseconds, as the Calendar API expects. */
function toRfc3339_(epochMs) {
  return new Date(epochMs).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ---------------------------------------------------------------------------
// AlAdhan prayer times API
// ---------------------------------------------------------------------------

/**
 * Adds the user's minute adjustments to parsed days. Imsak moves with Fajr,
 * so the gap between them stays the same. This is done here rather than with
 * AlAdhan's tune parameter, because some methods (Turkey, Dubai, Morocco,
 * Lisbon, Umm Al-Qura) carry their own tune values, and a tune parameter
 * from the add-on would replace them instead of adding to them.
 */
function applyOffsets_(days, offsets) {
  const o = offsets || {};
  const offsetFor = (name) => clampOffset_(o[name === "Imsak" ? "Fajr" : name]);
  if (!TIMING_NAMES_.some((name) => offsetFor(name) !== 0)) return days;
  return days.map((day) => {
    const times = {};
    TIMING_NAMES_.forEach((name) => {
      const minutes = offsetFor(name);
      const t = day.times[name];
      times[name] = { minutes: (((t.minutes + minutes) % 1440) + 1440) % 1440, epochMs: t.epochMs + minutes * 60000 };
    });
    return Object.assign({}, day, { times: times });
  });
}

function clampOffset_(value) {
  const n = Number(value);
  if (!isFinite(n)) return 0;
  return Math.max(-MAX_OFFSET_MINUTES_, Math.min(MAX_OFFSET_MINUTES_, Math.round(n)));
}

/**
 * URL for one Gregorian month of prayer times from AlAdhan's calendar endpoint.
 * When the location's time zone is unknown it is left out, and AlAdhan works
 * it out from the coordinates and reports it in meta.timezone.
 */
function buildAladhanMonthUrl_(year, month, location, settings) {
  const params = {
    latitude: location.latitude,
    longitude: location.longitude,
    method: settings.method,
    school: settings.school,
    latitudeAdjustmentMethod: settings.highLatitudeRule,
    timezonestring: location.timezone || "",
    iso8601: "true",
  };
  return APP_.aladhanBaseUrl + "/calendar/" + year + "/" + month + "?" + toQueryString_(params);
}

/**
 * Turns an AlAdhan calendar response into days:
 *   { date, weekday, hijri: {day, month, year}, timezone,
 *     times: { Fajr: {minutes, epochMs}, ... } }
 * localToEpoch(date, minutes, timeZone) converts a local wall time to an
 * instant; it is only used when AlAdhan returns times without an offset.
 */
function parseAladhanCalendar_(json, localToEpoch) {
  if (!json || typeof json !== "object") throw new Error("AlAdhan returned an empty response.");
  if (json.code !== 200 || !Array.isArray(json.data)) {
    const detail = typeof json.data === "string" ? json.data : json.status || "unknown error";
    throw new Error("AlAdhan returned an error: " + detail);
  }
  return json.data.map((entry) => parseAladhanDay_(entry, localToEpoch));
}

function parseAladhanDay_(entry, localToEpoch) {
  if (!entry || !entry.timings || !entry.date || !entry.date.gregorian) {
    throw new Error("AlAdhan returned a day without times.");
  }
  const date = aladhanDateToIso_(entry.date.gregorian.date);
  const timeZone = (entry.meta && entry.meta.timezone) || "";
  const times = {};
  TIMING_NAMES_.forEach((name) => {
    const parsed = parseAladhanTime_(entry.timings[name]);
    if (!parsed) throw new Error("AlAdhan returned no " + name + " time for " + date + ".");
    times[name] = { minutes: parsed.minutes, epochMs: parsed.epochMs, isoDate: parsed.isoDate };
  });
  // At high latitudes Maghrib and Isha can fall after midnight, and with some
  // rules Imsak and Fajr before it. Dhuhr is always at midday of the date, so a
  // time on the wrong side of Dhuhr belongs to the next or the previous day.
  const dhuhr = times.Dhuhr.minutes;
  TIMING_NAMES_.forEach((name) => {
    const t = times[name];
    let shift = 0;
    if (BEFORE_DHUHR_.indexOf(name) !== -1 && t.minutes > dhuhr) shift = -1;
    if (AFTER_DHUHR_.indexOf(name) !== -1 && t.minutes < dhuhr) shift = 1;
    if (t.epochMs === null) {
      if (typeof localToEpoch !== "function" || !timeZone) {
        throw new Error("AlAdhan returned times without a time zone.");
      }
      t.epochMs = localToEpoch(addDays_(date, shift), t.minutes, timeZone);
    } else if (shift !== 0 && t.isoDate === date) {
      // The ISO time carries the day's own date although it is past midnight.
      t.epochMs += shift * 86400000;
    }
    delete t.isoDate;
  });
  const h = entry.date.hijri || {};
  const hijri = {
    day: Number(h.day),
    month: Number(h.month && h.month.number),
    year: Number(h.year),
  };
  return {
    date: date,
    weekday: weekdayOf_(date),
    hijri: isFinite(hijri.day) && isFinite(hijri.month) && isFinite(hijri.year) && hijri.month >= 1 ? hijri : null,
    timezone: timeZone,
    times: times,
  };
}

/** Dates from the list that are missing in the parsed days. */
function missingDates_(days, dates) {
  const have = {};
  days.forEach((day) => {
    have[day.date] = true;
  });
  return dates.filter((date) => !have[date]);
}

/**
 * Applies the user's Hijri date adjustment. With +1 the Hijri date of each day
 * is the one AlAdhan gives for the following day. Days whose shifted source is
 * not in the data get hijri: null.
 */
function applyHijriAdjustment_(days, adjustment) {
  if (!adjustment) return days;
  const byDate = {};
  days.forEach((day) => {
    byDate[day.date] = day;
  });
  return days.map((day) => {
    const source = byDate[addDays_(day.date, adjustment)];
    return Object.assign({}, day, { hijri: source ? source.hijri : null });
  });
}

/** The months to download for a window, with margin for the Hijri adjustment. */
function monthsForRange_(startDate, endDate, hijriAdjustment) {
  const margin = Math.abs(hijriAdjustment || 0);
  return monthsCovering_(addDays_(startDate, -margin), addDays_(endDate, margin));
}

function formatHijriDate_(hijri) {
  if (!hijri) return "";
  return hijri.day + " " + HIJRI_MONTHS_[hijri.month - 1] + " " + hijri.year + " AH";
}

function isRamadan_(hijri) {
  return !!hijri && hijri.month === 9;
}

// ---------------------------------------------------------------------------
// Open-Meteo geocoding API
// ---------------------------------------------------------------------------

function buildGeocodeUrl_(query, count) {
  return APP_.geocodeUrl + "?" + toQueryString_({
    name: String(query).trim(),
    count: count || 10,
    language: "en",
    format: "json",
  });
}

/** Turns an Open-Meteo search response into places. Throws on API errors. */
function parseGeocodeResults_(json) {
  if (json && json.error) {
    throw new Error("Location search failed: " + (json.reason || "unknown error"));
  }
  const results = json && Array.isArray(json.results) ? json.results : [];
  return results
    .filter((r) => r && r.name && isFinite(r.latitude) && isFinite(r.longitude))
    .map((r) => ({
      name: String(r.name),
      region: r.admin1 ? String(r.admin1) : "",
      country: r.country ? String(r.country) : "",
      countryCode: r.country_code ? String(r.country_code).toUpperCase() : "",
      latitude: round4_(r.latitude),
      longitude: round4_(r.longitude),
      timezone: r.timezone ? String(r.timezone) : "",
      population: Number(r.population) || 0,
    }));
}

/** "Springfield, Illinois, United States". The region is left out when it repeats the city. */
function formatPlaceName_(place) {
  if (!place) return "";
  const parts = [place.name];
  if (place.region && place.region !== place.name) parts.push(place.region);
  if (place.country) parts.push(place.country);
  return parts.filter(Boolean).join(", ");
}

/** Region and country only, for the second line of a search result. */
function formatPlaceDetail_(place) {
  const parts = [];
  if (place.region && place.region !== place.name) parts.push(place.region);
  if (place.country) parts.push(place.country);
  return parts.join(", ");
}

/** For "Springfield, IL" returns "Springfield", to retry a search without the qualifier. */
function fallbackQuery_(query) {
  const text = String(query || "");
  if (text.indexOf(",") === -1) return null;
  const first = text.split(",")[0].trim();
  return first.length >= 2 ? first : null;
}

/** A place as stored in settings. */
function placeToLocation_(place) {
  return {
    name: String(place.name || ""),
    region: String(place.region || ""),
    country: String(place.country || ""),
    countryCode: String(place.countryCode || "").toUpperCase(),
    latitude: round4_(place.latitude),
    longitude: round4_(place.longitude),
    timezone: String(place.timezone || ""),
  };
}

// ---------------------------------------------------------------------------
// Suggestions from the calendar time zone
// ---------------------------------------------------------------------------

function normalizeTimeZone_(timeZone) {
  const tz = String(timeZone || "").trim();
  return TZ_ALIASES_[tz] || tz;
}

/** "America/New_York" -> "New York". Null for zones without a city, like "Etc/UTC". */
function timeZoneCityName_(timeZone) {
  const tz = normalizeTimeZone_(timeZone);
  if (tz.indexOf("/") === -1) return null;
  const parts = tz.split("/");
  if (["Etc", "SystemV", "US", "Canada", "Brazil", "Chile", "Mexico", "Antarctica"].indexOf(parts[0]) !== -1) {
    return null;
  }
  const city = parts[parts.length - 1].replace(/_/g, " ").trim();
  if (!city || /^(GMT|UTC)/i.test(city)) return null;
  return city;
}

/** The most populous place whose time zone is the calendar's time zone. */
function pickPlaceForTimeZone_(places, timeZone) {
  const zone = normalizeTimeZone_(timeZone);
  const matches = places.filter((p) => normalizeTimeZone_(p.timezone) === zone);
  if (!matches.length) return null;
  return matches.slice().sort((a, b) => (b.population || 0) - (a.population || 0))[0];
}

function suggestMethod_(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  return Object.prototype.hasOwnProperty.call(COUNTRY_METHOD_, code) ? COUNTRY_METHOD_[code] : 3;
}

function suggestSchool_(countryCode) {
  return HANAFI_COUNTRIES_.indexOf(String(countryCode || "").toUpperCase()) !== -1 ? 1 : 0;
}

function methodName_(id) {
  const method = METHODS_.filter((m) => m.id === Number(id))[0];
  return method ? method.name : "Method " + id;
}

function schoolName_(id) {
  return Number(id) === 1 ? "Hanafi" : "Standard";
}

// ---------------------------------------------------------------------------
// Coordinates and Qibla
// ---------------------------------------------------------------------------

/**
 * Parses coordinates as copied from Google Maps ("47.4979, 19.0402") or
 * written with hemispheres ("47.4979 N, 19.0402 E"). Returns
 * {latitude, longitude} or null.
 */
function parseCoordinates_(text) {
  const value = String(text || "")
    .toUpperCase()
    .replace(/[°º]/g, " ")
    .trim();
  const match = /^([+-]?\d{1,3}(?:\.\d+)?)\s*([NS])?\s*(?:,|;|\s)\s*([+-]?\d{1,3}(?:\.\d+)?)\s*([EW])?$/.exec(value);
  if (!match) return null;
  let latitude = Number(match[1]);
  let longitude = Number(match[3]);
  if (match[2] === "S") latitude = -Math.abs(latitude);
  if (match[4] === "W") longitude = -Math.abs(longitude);
  if (!(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180)) return null;
  return { latitude: round4_(latitude), longitude: round4_(longitude) };
}

/** Initial great-circle bearing to the Kaaba, in degrees clockwise from true north. */
function qiblaBearing_(latitude, longitude) {
  const rad = Math.PI / 180;
  const phi1 = latitude * rad;
  const phi2 = APP_.kaaba.latitude * rad;
  const deltaLambda = (APP_.kaaba.longitude - longitude) * rad;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

function compassName_(degrees) {
  const names = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return names[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function defaultSettings_() {
  return {
    version: 2,
    location: null,
    method: 3,
    methodChosen: false,
    school: 0,
    schoolChosen: false,
    highLatitudeRule: 3,
    offsets: { Fajr: 0, Sunrise: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 },
    prayers: OBLIGATORY_PRAYERS_.slice(),
    jumuah: true,
    jumuahTime: "",
    ramadan: true,
    hijriAdjustment: 0,
    reminderMinutes: 0,
    durationMinutes: 15,
    showAsFree: true,
    calendar: DEDICATED_CALENDAR_,
    dedicatedCalendarId: "",
    daysAhead: 30,
    autoSync: true,
    setupComplete: false,
  };
}

function normalizeLocation_(location) {
  if (!location || typeof location !== "object") return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!isFinite(latitude) || !isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    name: String(location.name || "").trim() || latitude.toFixed(4) + ", " + longitude.toFixed(4),
    region: String(location.region || ""),
    country: String(location.country || ""),
    countryCode: String(location.countryCode || "").toUpperCase(),
    latitude: round4_(latitude),
    longitude: round4_(longitude),
    timezone: String(location.timezone || ""),
  };
}

/** Fills in defaults and drops invalid values, so the rest of the code can trust settings. */
function normalizeSettings_(raw) {
  const defaults = defaultSettings_();
  const s = raw && typeof raw === "object" ? raw : {};
  const pick = (value, allowed, fallback) => (allowed.indexOf(value) !== -1 ? value : fallback);
  const int = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  const offsets = {};
  DAILY_EVENTS_.forEach((name) => {
    offsets[name] = clampOffset_(s.offsets && s.offsets[name]);
  });
  const prayers = Array.isArray(s.prayers) ? DAILY_EVENTS_.filter((name) => s.prayers.indexOf(name) !== -1) : null;
  const reminder =
    s.reminderMinutes === null ? null : int(s.reminderMinutes, 0, 40320, defaults.reminderMinutes);
  return {
    version: 2,
    location: normalizeLocation_(s.location),
    method: pick(Number(s.method), METHODS_.map((m) => m.id), defaults.method),
    methodChosen: s.methodChosen === true,
    school: pick(Number(s.school), [0, 1], defaults.school),
    schoolChosen: s.schoolChosen === true,
    highLatitudeRule: pick(Number(s.highLatitudeRule), [1, 2, 3], defaults.highLatitudeRule),
    offsets: offsets,
    prayers: prayers && prayers.length ? prayers : defaults.prayers,
    jumuah: typeof s.jumuah === "boolean" ? s.jumuah : defaults.jumuah,
    jumuahTime: parseUserTime_(s.jumuahTime) === null ? "" : formatClock_(parseUserTime_(s.jumuahTime), true),
    ramadan: typeof s.ramadan === "boolean" ? s.ramadan : defaults.ramadan,
    hijriAdjustment: int(s.hijriAdjustment, -2, 2, 0),
    reminderMinutes: reminder,
    durationMinutes: int(s.durationMinutes, 1, 240, defaults.durationMinutes),
    showAsFree: typeof s.showAsFree === "boolean" ? s.showAsFree : defaults.showAsFree,
    calendar: typeof s.calendar === "string" && s.calendar ? s.calendar : defaults.calendar,
    dedicatedCalendarId: typeof s.dedicatedCalendarId === "string" ? s.dedicatedCalendarId : "",
    daysAhead: int(s.daysAhead, 1, 60, defaults.daysAhead),
    autoSync: typeof s.autoSync === "boolean" ? s.autoSync : defaults.autoSync,
    setupComplete: s.setupComplete === true && !!normalizeLocation_(s.location),
  };
}

/** User property keys written by version 1 of the add-on. */
const LEGACY_KEYS_ = Object.freeze([
  "latitude", "longitude", "locationName", "calendarId", "method", "reminderMinutes",
  "dailySyncHour", "eventDuration", "onboardingComplete", "lastSyncDate",
]);

/**
 * Converts version 1 settings (one user property per value) to version 2.
 * Returns null when there is nothing to migrate. Version 1 turned a 0-minute
 * reminder into 30 minutes at sync time; here 0 stays 0.
 */
function hasLegacySettings_(props) {
  const p = props || {};
  return LEGACY_KEYS_.some((key) => p[key] !== undefined && p[key] !== null && p[key] !== "");
}

function migrateLegacySettings_(props, hadDailyTrigger) {
  const p = props || {};
  if (!hasLegacySettings_(p)) return null;
  const settings = defaultSettings_();
  const latitude = Number(p.latitude);
  const longitude = Number(p.longitude);
  if (p.latitude && p.longitude && isFinite(latitude) && isFinite(longitude)) {
    const name = String(p.locationName || "");
    const parts = name.split(",").map((part) => part.trim()).filter(Boolean);
    settings.location = normalizeLocation_({
      name: parts.length ? parts[0] : "",
      country: parts.length > 1 ? parts[parts.length - 1] : "",
      latitude: latitude,
      longitude: longitude,
      timezone: "",
    });
  }
  // Version 1 wrote every key with its defaults on any save, even before a city
  // was chosen. Without a location none of the values was a real choice.
  if (!settings.location) return null;
  const method = parseWholeNumber_(p.method);
  if (METHODS_.some((m) => m.id === method)) {
    settings.method = method;
    settings.methodChosen = true;
  }
  const reminder = parseWholeNumber_(p.reminderMinutes);
  if (reminder >= 0) settings.reminderMinutes = reminder;
  const duration = parseWholeNumber_(p.eventDuration);
  if (duration >= 1 && duration <= 240) settings.durationMinutes = duration;
  if (p.calendarId) settings.calendar = String(p.calendarId);
  settings.autoSync = !!hadDailyTrigger;
  settings.setupComplete = !!settings.location && (p.onboardingComplete === "true" || !!p.lastSyncDate);
  return normalizeSettings_(settings);
}

/** Applies a new location. The method and Asr school follow the country unless the user chose them. */
function withLocation_(settings, location) {
  const next = Object.assign({}, settings, { location: normalizeLocation_(location) });
  if (next.location && next.location.countryCode) {
    if (!settings.methodChosen) next.method = suggestMethod_(next.location.countryCode);
    if (!settings.schoolChosen) next.school = suggestSchool_(next.location.countryCode);
  }
  return normalizeSettings_(next);
}

/**
 * Reads form values from an add-on event object.
 * Returns { fieldName: [string, ...] }.
 */
function readFormInputs_(e) {
  const values = {};
  const common = e && e.commonEventObject && e.commonEventObject.formInputs;
  if (common) {
    Object.keys(common).forEach((name) => {
      const input = common[name] || {};
      const strings = input.stringInputs || (input[""] && input[""].stringInputs);
      if (strings && Array.isArray(strings.value)) values[name] = strings.value.map(String);
    });
    return values;
  }
  const legacy = (e && e.formInputs) || {};
  Object.keys(legacy).forEach((name) => {
    values[name] = [].concat(legacy[name]).map(String);
  });
  return values;
}

/**
 * Applies form values to settings. `fields` lists the fields the card showed;
 * a switch or checkbox group that is listed but missing from the values is off
 * or empty, because the add-on platform leaves out unchecked inputs.
 * Returns { settings, errors }. Invalid fields keep their old value.
 */
function applyFormToSettings_(settings, values, fields) {
  const next = JSON.parse(JSON.stringify(settings));
  const errors = [];
  const shown = (name) => fields.indexOf(name) !== -1;
  const first = (name) => (values[name] && values[name].length ? values[name][0] : undefined);

  if (shown(FIELD_.method) && first(FIELD_.method) !== undefined) {
    const method = parseWholeNumber_(first(FIELD_.method));
    if (METHODS_.some((m) => m.id === method)) {
      if (method !== settings.method) next.methodChosen = true;
      next.method = method;
    }
  }
  if (shown(FIELD_.school) && first(FIELD_.school) !== undefined) {
    const school = parseWholeNumber_(first(FIELD_.school));
    if (school === 0 || school === 1) {
      if (school !== settings.school) next.schoolChosen = true;
      next.school = school;
    }
  }
  if (shown(FIELD_.highLatitudeRule) && first(FIELD_.highLatitudeRule) !== undefined) {
    const rule = parseWholeNumber_(first(FIELD_.highLatitudeRule));
    if ([1, 2, 3].indexOf(rule) !== -1) next.highLatitudeRule = rule;
  }
  if (shown(FIELD_.prayers)) {
    const chosen = DAILY_EVENTS_.filter((name) => (values[FIELD_.prayers] || []).indexOf(name) !== -1);
    if (!chosen.some((name) => OBLIGATORY_PRAYERS_.indexOf(name) !== -1)) {
      errors.push("Choose at least one prayer to add to your calendar.");
    } else {
      next.prayers = chosen;
    }
  }
  [FIELD_.jumuah, FIELD_.ramadan, FIELD_.showAsFree, FIELD_.autoSync].forEach((name) => {
    if (shown(name)) next[name] = (values[name] || []).length > 0;
  });
  if (shown(FIELD_.jumuahTime)) {
    const text = String(first(FIELD_.jumuahTime) || "").trim();
    if (!text) {
      next.jumuahTime = "";
    } else if (parseUserTime_(text) === null) {
      errors.push("Enter the Jumu'ah time as HH:MM, for example 13:30.");
    } else {
      next.jumuahTime = formatClock_(parseUserTime_(text), true);
    }
  }
  if (shown(FIELD_.hijriAdjustment) && first(FIELD_.hijriAdjustment) !== undefined) {
    const adjustment = parseWholeNumber_(first(FIELD_.hijriAdjustment));
    if (HIJRI_ADJUSTMENT_CHOICES_.indexOf(adjustment) !== -1) next.hijriAdjustment = adjustment;
  }
  if (shown(FIELD_.reminder) && first(FIELD_.reminder) !== undefined) {
    const text = first(FIELD_.reminder);
    const minutes = parseWholeNumber_(text);
    if (text === "none") next.reminderMinutes = null;
    else if (minutes >= 0 && minutes <= 40320) next.reminderMinutes = minutes;
  }
  if (shown(FIELD_.duration) && first(FIELD_.duration) !== undefined) {
    const minutes = parseWholeNumber_(first(FIELD_.duration));
    if (minutes >= 1 && minutes <= 240) next.durationMinutes = minutes;
  }
  if (shown(FIELD_.calendar) && first(FIELD_.calendar)) {
    next.calendar = first(FIELD_.calendar);
  }
  if (shown(FIELD_.daysAhead) && first(FIELD_.daysAhead) !== undefined) {
    const days = parseWholeNumber_(first(FIELD_.daysAhead));
    if (days >= 1 && days <= 60) next.daysAhead = days;
  }
  DAILY_EVENTS_.forEach((name) => {
    const field = OFFSET_FIELD_PREFIX_ + name;
    if (!shown(field)) return;
    const text = String(first(field) === undefined ? "" : first(field)).trim();
    const minutes = text === "" ? 0 : parseWholeNumber_(text);
    if (!Number.isInteger(minutes) || Math.abs(minutes) > MAX_OFFSET_MINUTES_) {
      errors.push(name + " adjustment must be a whole number of minutes from -60 to 60.");
    } else {
      next.offsets[name] = minutes;
    }
  });
  return { settings: normalizeSettings_(next), errors: errors };
}

/** True when two settings give different calendar events or times. */
function settingsAffectEvents_(before, after) {
  const keys = [
    "location", "method", "school", "highLatitudeRule", "offsets", "prayers", "jumuah", "jumuahTime",
    "ramadan", "hijriAdjustment", "reminderMinutes", "durationMinutes", "showAsFree", "calendar", "daysAhead",
  ];
  return keys.some((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

// ---------------------------------------------------------------------------
// Prayer schedule for one day
// ---------------------------------------------------------------------------

/**
 * The time of one daily event on a day, after the Jumu'ah rule.
 * Returns {slot, title, minutes, epochMs}.
 */
function eventTimeForDay_(day, slot, settings) {
  const time = day.times[slot];
  if (slot === "Dhuhr" && day.weekday === 5 && settings.jumuah) {
    const fixed = parseUserTime_(settings.jumuahTime);
    if (fixed !== null) {
      // Same-day shift from Dhuhr. Daylight saving changes never happen at midday.
      return { slot: slot, title: "Jumu'ah", minutes: fixed, epochMs: time.epochMs + (fixed - time.minutes) * 60000 };
    }
    return { slot: slot, title: "Jumu'ah", minutes: time.minutes, epochMs: time.epochMs };
  }
  return { slot: slot, title: slot, minutes: time.minutes, epochMs: time.epochMs };
}

/** Rows for the home card: every daily time, plus Suhoor and Iftar in Ramadan. */
function scheduleForDay_(day, settings) {
  const rows = DAILY_EVENTS_.map((slot) => eventTimeForDay_(day, slot, settings));
  if (settings.ramadan && isRamadan_(day.hijri)) {
    rows.push({ slot: "Suhoor", title: "Suhoor ends", minutes: day.times.Imsak.minutes, epochMs: day.times.Imsak.epochMs });
    rows.push({ slot: "Iftar", title: "Iftar", minutes: day.times.Maghrib.minutes, epochMs: day.times.Maghrib.epochMs });
  }
  return rows.sort((a, b) => a.epochMs - b.epochMs);
}

/**
 * The next of the five prayers (Sunrise is not a prayer) after nowMs, looking
 * at the given days in order. Returns {title, minutes, epochMs, date} or null.
 */
function findNextPrayer_(days, settings, nowMs) {
  // The earliest prayer after now, not the first in slot order: yesterday's
  // Isha can fall after midnight at high latitudes, before today's Fajr.
  let next = null;
  days.forEach((day) => {
    OBLIGATORY_PRAYERS_.forEach((slot) => {
      const time = eventTimeForDay_(day, slot, settings);
      if (time.epochMs > nowMs && (!next || time.epochMs < next.epochMs)) next = Object.assign({ date: day.date }, time);
    });
  });
  return next;
}

// ---------------------------------------------------------------------------
// Calendar events
// ---------------------------------------------------------------------------

/**
 * Builds the events the calendar should contain for the window.
 * ctx: { window: {start, end}, use24h, locationName }
 * Each spec: { key, slot, date, title, startMs, endMs, timeZone, description,
 *              reminderMinutes, transparent, sig }
 */
function buildDesiredEvents_(days, settings, ctx) {
  const specs = [];
  const timeZone = settings.location && settings.location.timezone ? settings.location.timezone : "";
  const durationMs = settings.durationMinutes * 60000;
  days.forEach((day) => {
    if (day.date < ctx.window.start || day.date > ctx.window.end) return;
    const hijriText = formatHijriDate_(day.hijri);
    DAILY_EVENTS_.forEach((slot) => {
      if (settings.prayers.indexOf(slot) === -1) return;
      const time = eventTimeForDay_(day, slot, settings);
      specs.push(makeEventSpec_({
        slot: slot,
        date: day.date,
        title: time.title,
        startMs: time.epochMs,
        endMs: time.epochMs + durationMs,
        timeZone: timeZone,
        description: describeEvent_(slot, time, day, settings, ctx, hijriText),
        settings: settings,
      }));
    });
    if (settings.ramadan && isRamadan_(day.hijri)) {
      const imsak = day.times.Imsak;
      const fajr = day.times.Fajr;
      specs.push(makeEventSpec_({
        slot: "Suhoor",
        date: day.date,
        title: "Suhoor ends",
        startMs: imsak.epochMs,
        endMs: fajr.epochMs > imsak.epochMs ? fajr.epochMs : imsak.epochMs + 10 * 60000,
        timeZone: timeZone,
        description: describeEvent_("Suhoor", { minutes: imsak.minutes }, day, settings, ctx, hijriText),
        settings: settings,
      }));
      const maghrib = day.times.Maghrib;
      specs.push(makeEventSpec_({
        slot: "Iftar",
        date: day.date,
        title: "Iftar",
        startMs: maghrib.epochMs,
        endMs: maghrib.epochMs + durationMs,
        timeZone: timeZone,
        description: describeEvent_("Iftar", { minutes: maghrib.minutes }, day, settings, ctx, hijriText),
        settings: settings,
      }));
    }
  });
  return specs;
}

function makeEventSpec_(input) {
  const spec = {
    key: input.date + "|" + input.slot,
    slot: input.slot,
    date: input.date,
    title: input.title,
    startMs: input.startMs,
    endMs: input.endMs,
    timeZone: input.timeZone,
    description: input.description,
    reminderMinutes: input.settings.reminderMinutes,
    transparent: input.settings.showAsFree,
  };
  spec.sig = hashString_(JSON.stringify([
    APP_.eventVersion, spec.title, spec.startMs, spec.endMs, spec.timeZone, spec.description,
    spec.reminderMinutes, spec.transparent,
  ]));
  return spec;
}

function describeEvent_(slot, time, day, settings, ctx, hijriText) {
  const place = ctx.locationName || formatPlaceName_(settings.location);
  const clock = (minutes) => formatClock_(minutes, ctx.use24h);
  const lines = [];
  if (slot === "Sunrise") {
    lines.push("Sunrise in " + place + ". The time for Fajr ends at sunrise.");
  } else if (slot === "Suhoor") {
    lines.push("Suhoor ends at Imsak in " + place + ". Fajr is at " + clock(day.times.Fajr.minutes) + ".");
  } else if (slot === "Iftar") {
    lines.push("Iftar at Maghrib in " + place + ".");
  } else if (slot === "Dhuhr" && time.title === "Jumu'ah") {
    const fixed = parseUserTime_(settings.jumuahTime) !== null;
    lines.push(
      "Jumu'ah (Friday prayer) in " + place + "." +
        (fixed ? " Your chosen time. Dhuhr is at " + clock(day.times.Dhuhr.minutes) + "." : "")
    );
  } else {
    lines.push(slot + " prayer time in " + place + ".");
  }
  if (slot !== "Sunrise" && slot !== "Iftar" && slot !== "Suhoor") {
    let method = "Calculation method: " + methodName_(settings.method) + ".";
    if (slot === "Asr") method += " Asr time: " + schoolName_(settings.school) + ".";
    lines.push(method);
  }
  if (hijriText) lines.push("Hijri date: " + hijriText + ".");
  lines.push("");
  lines.push("Times from AlAdhan (aladhan.com). Added by the Prayer Times add-on for Google Calendar.");
  return lines.join("\n");
}

/** The Calendar API event resource for a spec. */
function eventResource_(spec) {
  const resource = {
    summary: spec.title,
    description: spec.description,
    start: { dateTime: toRfc3339_(spec.startMs) },
    end: { dateTime: toRfc3339_(spec.endMs) },
    transparency: spec.transparent ? "transparent" : "opaque",
    // overrides is always sent so a patch also clears an old reminder.
    reminders: {
      useDefault: false,
      overrides: spec.reminderMinutes === null ? [] : [{ method: "popup", minutes: spec.reminderMinutes }],
    },
    extendedProperties: {
      private: {
        [TAG_.app]: "true",
        [TAG_.name]: spec.slot,
        [TAG_.date]: spec.date,
        [TAG_.sig]: spec.sig,
        [TAG_.version]: APP_.eventVersion,
      },
    },
  };
  if (spec.timeZone) {
    resource.start.timeZone = spec.timeZone;
    resource.end.timeZone = spec.timeZone;
  }
  return resource;
}

/** True when the event starts before the instant. False when either is unknown. */
function startsBefore_(event, instantMs) {
  if (!instantMs) return false;
  const start = event && event.start && (event.start.dateTime || event.start.date);
  const startMs = start ? Date.parse(start) : NaN;
  return isFinite(startMs) && startMs < instantMs;
}

function eventTags_(event) {
  return (event && event.extendedProperties && event.extendedProperties.private) || {};
}

/**
 * Plans the changes that make the target calendar match the desired events.
 *
 * existing: the add-on's events in the target calendar from the window start on.
 * others: [{calendarId, events}] for calendars the add-on used before.
 * window: {start, end} dates, and optionally startMs, the instant of the
 * window's first midnight.
 * Only events tagged prayerTimeEvent=true are ever touched. Events dated
 * before the window are history and are left alone; so are version 1 events
 * (no date tag) that start before startMs.
 *
 * Returns ops in the order to run them: per day, deletes, updates, then
 * inserts, so a partial run leaves whole days done. Version 1 events come first
 * and events in other calendars last.
 */
function planSync_(desired, existing, others, window, targetCalendarId) {
  const desiredByKey = {};
  desired.forEach((spec) => {
    desiredByKey[spec.key] = spec;
  });
  const legacy = [];
  const perDay = {};
  const addOp = (date, op) => {
    (perDay[date] = perDay[date] || []).push(op);
  };
  const groups = {};
  const matched = {};

  existing.forEach((event) => {
    const tags = eventTags_(event);
    if (tags[TAG_.app] !== "true" || !event.id) return;
    if (!tags[TAG_.date]) {
      if (!startsBefore_(event, window.startMs)) {
        legacy.push({ type: "delete", calendarId: targetCalendarId, eventId: event.id, date: null, reason: "legacy" });
      }
      return;
    }
    if (tags[TAG_.date] < window.start) return;
    const key = tags[TAG_.date] + "|" + tags[TAG_.name];
    (groups[key] = groups[key] || []).push(event);
  });

  Object.keys(groups).forEach((key) => {
    const events = groups[key];
    const date = key.split("|")[0];
    const spec = desiredByKey[key];
    if (!spec) {
      events.forEach((event) =>
        addOp(date, { type: "delete", calendarId: targetCalendarId, eventId: event.id, date: date, reason: "unwanted" })
      );
      return;
    }
    const keeperIndex = Math.max(0, events.findIndex((event) => eventTags_(event)[TAG_.sig] === spec.sig));
    events.forEach((event, index) => {
      if (index !== keeperIndex) {
        addOp(date, { type: "delete", calendarId: targetCalendarId, eventId: event.id, date: date, reason: "duplicate" });
      }
    });
    const keeper = events[keeperIndex];
    if (eventTags_(keeper)[TAG_.sig] !== spec.sig) {
      addOp(date, { type: "update", calendarId: targetCalendarId, eventId: keeper.id, date: date, spec: spec });
    }
    matched[key] = true;
  });

  desired.forEach((spec) => {
    if (!matched[spec.key]) addOp(spec.date, { type: "insert", calendarId: targetCalendarId, date: spec.date, spec: spec });
  });

  const typeOrder = { delete: 0, update: 1, insert: 2 };
  const ops = legacy.slice();
  Object.keys(perDay)
    .sort()
    .forEach((date) => {
      perDay[date]
        .sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
        .forEach((op) => ops.push(op));
    });

  // Another name for the target calendar (such as "primary") must never be cleaned as an old calendar.
  const targetEventIds = {};
  existing.forEach((event) => {
    if (event.id) targetEventIds[event.id] = true;
  });
  (others || []).forEach((other) => {
    if (other.calendarId === targetCalendarId) return;
    (other.events || []).forEach((event) => {
      const tags = eventTags_(event);
      if (tags[TAG_.app] !== "true" || !event.id || targetEventIds[event.id]) return;
      if (tags[TAG_.date] ? tags[TAG_.date] < window.start : startsBefore_(event, window.startMs)) return;
      ops.push({ type: "delete", calendarId: other.calendarId, eventId: event.id, date: null, reason: "moved" });
    });
  });
  return ops;
}

/** Delete plan for "Remove events": every tagged event, past and future. */
function planRemoval_(calendars) {
  const ops = [];
  const seen = {};
  calendars.forEach((calendar) => {
    (calendar.events || []).forEach((event) => {
      const key = calendar.calendarId + "/" + event.id;
      if (eventTags_(event)[TAG_.app] === "true" && event.id && !seen[key]) {
        seen[key] = true;
        ops.push({ type: "delete", calendarId: calendar.calendarId, eventId: event.id, date: null, reason: "remove" });
      }
    });
  });
  return ops;
}

/**
 * Builds the UrlFetchApp request for one op. The token is added by the caller.
 */
function calendarRequestForOp_(op) {
  const base = APP_.calendarApiUrl + "/calendars/" + encodeURIComponent(op.calendarId) + "/events";
  if (op.type === "insert") {
    return { url: base, method: "post", payload: JSON.stringify(eventResource_(op.spec)) };
  }
  if (op.type === "update") {
    return {
      url: base + "/" + encodeURIComponent(op.eventId),
      method: "patch",
      payload: JSON.stringify(eventResource_(op.spec)),
    };
  }
  if (op.type === "delete") {
    return { url: base + "/" + encodeURIComponent(op.eventId), method: "delete" };
  }
  throw new Error("Unknown calendar operation: " + op.type);
}

/**
 * Classifies a Calendar API response.
 * Returns {ok, retry, stop, message}: retry for rate limits and server errors,
 * stop for errors that will not go away during this run.
 */
function classifyCalendarResponse_(op, code, bodyText) {
  if (code >= 200 && code < 300) return { ok: true };
  if (op.type === "delete" && (code === 404 || code === 410)) return { ok: true };
  let reason = "";
  let message = "";
  try {
    const body = JSON.parse(bodyText);
    const error = body && body.error;
    reason = (error && error.errors && error.errors[0] && error.errors[0].reason) || (error && error.status) || "";
    message = (error && error.message) || "";
  } catch (err) {
    message = "";
  }
  const rateLimited = code === 429 || (code === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(reason));
  if (rateLimited) {
    // Rejected before it was applied, so even an insert is safe to send again.
    return { ok: false, retry: true, stop: false, message: message || "Google Calendar is busy (HTTP " + code + ")." };
  }
  if (code >= 500) {
    // The request may have been applied. Sending an insert again could create the event twice.
    return {
      ok: false,
      retry: op.type !== "insert",
      stop: false,
      message: "Google Calendar did not confirm some changes (HTTP " + code + "). The next sync checks them.",
    };
  }
  if (code === 403 && /quotaExceeded/.test(reason)) {
    return {
      ok: false,
      retry: false,
      stop: true,
      message: "Google Calendar's limit for adding events was reached. Try again in a few hours.",
    };
  }
  if (code === 401 || code === 403) {
    return {
      ok: false,
      retry: false,
      stop: true,
      message: "Google Calendar refused access (" + (reason || "HTTP " + code) + "). Open the add-on again and allow access.",
    };
  }
  return { ok: false, retry: false, stop: false, message: message || "Google Calendar returned HTTP " + code + "." };
}

/**
 * Sums up a run. statuses[i] is "done", "failed" or undefined (not attempted)
 * for ops[i]. syncedThrough is the last day such that every day from the
 * window start to it is complete.
 */
function summarizeSync_(ops, statuses, window) {
  const summary = { inserted: 0, updated: 0, deleted: 0, failed: 0, pending: 0, syncedThrough: null, complete: false };
  let firstIncompleteDate = null;
  let otherIncomplete = false;
  ops.forEach((op, i) => {
    const status = statuses[i];
    if (status === "done") {
      if (op.type === "insert") summary.inserted++;
      else if (op.type === "update") summary.updated++;
      else summary.deleted++;
      return;
    }
    if (status === "failed") summary.failed++;
    else summary.pending++;
    if (!op.date) {
      otherIncomplete = true;
    } else if (op.type === "insert") {
      // Only a missing insert leaves a day without its events; an update or
      // delete that did not run leaves them there, just not up to date.
      if (firstIncompleteDate === null || op.date < firstIncompleteDate) firstIncompleteDate = op.date;
    }
  });
  summary.complete = summary.failed === 0 && summary.pending === 0;
  if (firstIncompleteDate === null || firstIncompleteDate > window.end) {
    summary.syncedThrough = window.end;
  } else if (firstIncompleteDate > window.start) {
    summary.syncedThrough = addDays_(firstIncompleteDate, -1);
  }
  summary.cleanupPending = otherIncomplete;
  return summary;
}

/** The notification shown after a sync. */
function syncMessage_(summary) {
  if (summary.complete) {
    const changes = summary.inserted + summary.updated + summary.deleted;
    if (changes === 0) return "Your calendar is up to date through " + formatShortDate_(summary.syncedThrough) + ".";
    return "Calendar updated through " + formatShortDate_(summary.syncedThrough) + ": " + describeChanges_(summary) + ".";
  }
  const done = summary.syncedThrough ? "Added prayer times through " + formatShortDate_(summary.syncedThrough) + ". " : "";
  return done + "Some changes are not done yet. Select Sync now again to finish.";
}

function describeChanges_(summary) {
  const parts = [];
  if (summary.inserted) parts.push(summary.inserted + " added");
  if (summary.updated) parts.push(summary.updated + " updated");
  if (summary.deleted) parts.push(summary.deleted + " removed");
  return parts.join(", ");
}

/** "yyyy-MM-dd HH:mm" text for Utilities.parseDate. */
function localDateTimeText_(dateText, minutes) {
  parseIsoDate_(dateText);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) throw new Error("Invalid minutes: " + minutes);
  return dateText + " " + pad2_(Math.floor(minutes / 60)) + ":" + pad2_(minutes % 60);
}

/**
 * The time zone AlAdhan reports for coordinates (meta.timezone), from a
 * calendar response. Throws a user error when there is none.
 */
function parseAladhanTimeZone_(json) {
  const first = json && json.code === 200 && Array.isArray(json.data) ? json.data[0] : null;
  const zone = first && first.meta && first.meta.timezone;
  if (zone) return String(zone);
  const detail = json && typeof json.data === "string" ? " (" + json.data + ")" : "";
  throw userError_("Could not find the time zone for these coordinates" + detail + ". Try searching for a nearby city.");
}

/** True for the "not found" and "gone" errors the Calendar service throws for a missing calendar. */
function isNotFoundMessage_(text) {
  return /\bnot found\b|\b404\b|\b410\b|\bgone\b|resource has been deleted/i.test(String(text || ""));
}

/** "5 minutes", "1 minute", "1 hour", "2 hours". */
function minutesLabel_(minutes) {
  if (minutes >= 60 && minutes % 60 === 0) return minutes / 60 + (minutes === 60 ? " hour" : " hours");
  return minutes + (minutes === 1 ? " minute" : " minutes");
}

/** Splits a list into chunks of at most `size` items. */
function chunk_(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
