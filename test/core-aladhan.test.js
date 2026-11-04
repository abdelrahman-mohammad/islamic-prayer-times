"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddOn } = require("./helpers/load");
const tz = require("./helpers/tz");
const isoFixture = require("./fixtures/aladhan-iso-budapest-2026-11.json");
const plainFixture = require("./fixtures/aladhan-plain-budapest-2026-03.json");

loadAddOn();

const clone = (value) => JSON.parse(JSON.stringify(value));
const budapest = { name: "Budapest", latitude: 47.4984, longitude: 19.0405, timezone: "Europe/Budapest" };

test("applyOffsets_ adds minutes locally and moves Imsak with Fajr", () => {
  const days = parseAladhanCalendar_(isoFixture);
  assert.equal(applyOffsets_(days, {}), days, "no offsets, no copy");
  assert.equal(applyOffsets_(days, undefined), days);
  const moved = applyOffsets_(days, { Fajr: 2, Sunrise: -1, Asr: 4, Isha: -6 });
  const before = days[0].times;
  const after = moved[0].times;
  assert.deepEqual(after.Fajr, { minutes: before.Fajr.minutes + 2, epochMs: before.Fajr.epochMs + 2 * 60000 });
  assert.deepEqual(after.Imsak, { minutes: before.Imsak.minutes + 2, epochMs: before.Imsak.epochMs + 2 * 60000 });
  assert.equal(after.Sunrise.epochMs, before.Sunrise.epochMs - 60000);
  assert.deepEqual(after.Dhuhr, before.Dhuhr);
  assert.equal(after.Isha.minutes, before.Isha.minutes - 6);
  assert.equal(days[0].times.Fajr.minutes, before.Fajr.minutes, "the input is not changed");
  const clamped = applyOffsets_(days, { Fajr: 500 });
  assert.equal(clamped[0].times.Fajr.epochMs, before.Fajr.epochMs + 60 * 60000, "at most 60 minutes");
  const wrap = applyOffsets_([{ date: "2026-11-04", times: Object.assign({}, before, { Isha: { minutes: 1430, epochMs: 0 } }) }], { Isha: 20 });
  assert.equal(wrap[0].times.Isha.minutes, 10, "the clock wraps past midnight");
});

test("buildAladhanMonthUrl_ uses https and the calendar endpoint", () => {
  const settings = Object.assign(defaultSettings_(), { method: 2, school: 1, highLatitudeRule: 1 });
  settings.offsets.Isha = 3;
  assert.equal(
    buildAladhanMonthUrl_(2026, 11, budapest, settings),
    "https://api.aladhan.com/v1/calendar/2026/11?latitude=47.4984&longitude=19.0405&method=2&school=1" +
      "&latitudeAdjustmentMethod=1&timezonestring=Europe%2FBudapest&iso8601=true"
  );
  assert.doesNotMatch(buildAladhanMonthUrl_(2026, 11, budapest, settings), /tune=/, "methods keep AlAdhan's own tune values");
});

test("buildAladhanMonthUrl_ leaves out an unknown time zone", () => {
  const url = buildAladhanMonthUrl_(2026, 1, { latitude: 1.5, longitude: -2.25, timezone: "" }, defaultSettings_());
  assert.match(url, /^https:\/\/api\.aladhan\.com\/v1\/calendar\/2026\/1\?latitude=1\.5&longitude=-2\.25&method=3&school=0/);
  assert.doesNotMatch(url, /timezonestring/);
  assert.match(url, /school=0/);
});

test("parseAladhanCalendar_ reads ISO times without a time zone converter", () => {
  const days = parseAladhanCalendar_(isoFixture, null);
  assert.equal(days.length, 3);
  const first = days[0];
  assert.equal(first.date, "2026-11-04");
  assert.equal(first.weekday, 3);
  assert.equal(first.timezone, "Europe/Budapest");
  assert.deepEqual(first.hijri, { day: 23, month: 5, year: 1448 });
  assert.deepEqual(first.times.Fajr, { minutes: 5 * 60 + 11, epochMs: Date.UTC(2026, 10, 4, 4, 11) });
  assert.deepEqual(first.times.Imsak, { minutes: 5 * 60 + 1, epochMs: Date.UTC(2026, 10, 4, 4, 1) });
  assert.deepEqual(first.times.Isha, { minutes: 18 * 60 + 10, epochMs: Date.UTC(2026, 10, 4, 17, 10) });
  assert.equal(days[2].weekday, 5);
  assert.deepEqual(Object.keys(first.times), ["Imsak", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]);
});

test("parseAladhanCalendar_ converts plain times with the location's time zone across DST", () => {
  const days = parseAladhanCalendar_(plainFixture, tz.localToEpoch);
  assert.deepEqual(days.map((d) => d.date), ["2026-03-28", "2026-03-29", "2026-03-30"]);
  // 28 March: CET, UTC+1.
  assert.equal(days[0].times.Fajr.epochMs, Date.UTC(2026, 2, 28, 3, 16));
  assert.equal(days[0].times.Isha.epochMs, Date.UTC(2026, 2, 28, 18, 33));
  // 29 March: CEST, UTC+2, from 03:00 local.
  assert.equal(days[1].times.Fajr.epochMs, Date.UTC(2026, 2, 29, 3, 13));
  assert.equal(days[1].times.Dhuhr.epochMs, Date.UTC(2026, 2, 29, 10, 52));
  assert.equal(days[2].times.Maghrib.epochMs, Date.UTC(2026, 2, 30, 17, 2));
  assert.deepEqual(days[1].hijri, { day: 10, month: 10, year: 1447 });
});

test("the converter is ignored for ISO times, so both paths agree", () => {
  const plainDays = parseAladhanCalendar_(plainFixture, tz.localToEpoch);
  const asIso = clone(plainFixture);
  asIso.data.forEach((entry, i) => {
    Object.keys(entry.timings).forEach((name) => {
      const parsed = plainDays[i].times[name];
      if (parsed) entry.timings[name] = tz.toLocalIso(parsed.epochMs, "Europe/Budapest");
    });
  });
  const isoDays = parseAladhanCalendar_(asIso, () => {
    throw new Error("converter must not be called for ISO times");
  });
  assert.deepEqual(isoDays, plainDays);
});

test("a plain Isha after midnight belongs to the next day", () => {
  const fixture = clone(plainFixture);
  fixture.data = [fixture.data[0]];
  fixture.data[0].timings.Maghrib = "22:40 (CEST)";
  fixture.data[0].timings.Isha = "00:55 (CEST)";
  const day = parseAladhanCalendar_(fixture, tz.localToEpoch)[0];
  assert.equal(day.times.Isha.minutes, 55);
  assert.equal(day.times.Isha.epochMs, tz.localToEpoch("2026-03-29", 55, "Europe/Budapest"));
  assert.ok(day.times.Isha.epochMs > day.times.Maghrib.epochMs);
});

test("times past midnight are placed on the right day, judged against Dhuhr", () => {
  const fixture = clone(plainFixture);
  fixture.data = [fixture.data[2]]; // 30 March 2026, CEST, Dhuhr 12:51
  Object.assign(fixture.data[0].timings, { Imsak: "23:40 (CEST)", Fajr: "23:50 (CEST)", Maghrib: "00:20 (CEST)", Isha: "01:10 (CEST)" });
  const day = parseAladhanCalendar_(fixture, tz.localToEpoch)[0];
  assert.equal(day.times.Fajr.epochMs, tz.localToEpoch("2026-03-29", 23 * 60 + 50, "Europe/Budapest"), "Fajr before midnight is the evening before");
  assert.equal(day.times.Imsak.epochMs, tz.localToEpoch("2026-03-29", 23 * 60 + 40, "Europe/Budapest"));
  assert.equal(day.times.Maghrib.epochMs, tz.localToEpoch("2026-03-31", 20, "Europe/Budapest"), "Maghrib after midnight is the next day");
  assert.equal(day.times.Isha.epochMs, tz.localToEpoch("2026-03-31", 70, "Europe/Budapest"));
  assert.equal(day.times.Sunrise.epochMs, tz.localToEpoch("2026-03-30", 6 * 60 + 48, "Europe/Budapest"));

  const iso = clone(isoFixture);
  iso.data = [iso.data[0]];
  // An ISO time past midnight that still carries the day's own date.
  iso.data[0].timings.Isha = "2026-11-04T00:30:00+01:00";
  iso.data[0].timings.Fajr = "2026-11-04T23:55:00+01:00";
  const isoDay = parseAladhanCalendar_(iso)[0];
  assert.equal(isoDay.times.Isha.epochMs, Date.UTC(2026, 10, 4, 23, 30));
  assert.equal(isoDay.times.Fajr.epochMs, Date.UTC(2026, 10, 3, 22, 55));
  // A rolled ISO date is trusted as it is.
  iso.data[0].timings.Isha = "2026-11-05T00:30:00+01:00";
  assert.equal(parseAladhanCalendar_(iso)[0].times.Isha.epochMs, Date.UTC(2026, 10, 4, 23, 30));
});

test("parseAladhanTimeZone_ reads meta.timezone", () => {
  assert.equal(parseAladhanTimeZone_(isoFixture), "Europe/Budapest");
  assert.throws(() => parseAladhanTimeZone_({ code: 400, status: "BAD_REQUEST", data: "Invalid latitude" }), /coordinates \(Invalid latitude\)\. Try searching/);
  assert.throws(() => parseAladhanTimeZone_(null), /Could not find the time zone/);
});

test("parseAladhanCalendar_ reports API errors and bad data", () => {
  assert.throws(() => parseAladhanCalendar_({ code: 400, status: "BAD_REQUEST", data: "Please specify a valid latitude." }), /valid latitude/);
  assert.throws(() => parseAladhanCalendar_({ code: 500, status: "ERROR" }), /AlAdhan returned an error: ERROR/);
  assert.throws(() => parseAladhanCalendar_(null), /empty response/);
  const missing = clone(isoFixture);
  delete missing.data[1].timings.Asr;
  assert.throws(() => parseAladhanCalendar_(missing), /no Asr time for 2026-11-05/);
  const noZone = clone(plainFixture);
  delete noZone.data[0].meta.timezone;
  assert.throws(() => parseAladhanCalendar_(noZone, tz.localToEpoch), /without a time zone/);
});

test("a day without a usable Hijri date gets hijri: null", () => {
  const fixture = clone(isoFixture);
  delete fixture.data[0].date.hijri;
  assert.equal(parseAladhanCalendar_(fixture)[0].hijri, null);
});

test("missingDates_ finds gaps", () => {
  const days = parseAladhanCalendar_(isoFixture);
  assert.deepEqual(missingDates_(days, ["2026-11-04", "2026-11-05", "2026-11-06"]), []);
  assert.deepEqual(missingDates_(days, ["2026-11-03", "2026-11-05", "2026-11-07"]), ["2026-11-03", "2026-11-07"]);
});

test("applyHijriAdjustment_ shifts Hijri dates by whole days", () => {
  const days = parseAladhanCalendar_(isoFixture);
  assert.equal(applyHijriAdjustment_(days, 0), days);
  const plusOne = applyHijriAdjustment_(days, 1);
  assert.deepEqual(plusOne.map((d) => d.hijri && d.hijri.day), [24, 25, null]);
  const minusOne = applyHijriAdjustment_(days, -1);
  assert.deepEqual(minusOne.map((d) => d.hijri && d.hijri.day), [null, 23, 24]);
  // The input is not changed.
  assert.equal(days[0].hijri.day, 23);
  assert.equal(plusOne[0].times, days[0].times);
});

test("formatHijriDate_ and isRamadan_", () => {
  assert.equal(formatHijriDate_({ day: 23, month: 5, year: 1448 }), "23 Jumada al-Ula 1448 AH");
  assert.equal(formatHijriDate_({ day: 1, month: 9, year: 1448 }), "1 Ramadan 1448 AH");
  assert.equal(formatHijriDate_({ day: 10, month: 12, year: 1447 }), "10 Dhu al-Hijjah 1447 AH");
  assert.equal(formatHijriDate_(null), "");
  assert.equal(isRamadan_({ day: 1, month: 9, year: 1448 }), true);
  assert.equal(isRamadan_({ day: 1, month: 10, year: 1448 }), false);
  assert.equal(isRamadan_(null), false);
});
