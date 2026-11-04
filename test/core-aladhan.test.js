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

test("buildTuneParam_ follows AlAdhan's order and moves Imsak with Fajr", () => {
  assert.equal(buildTuneParam_({}), "0,0,0,0,0,0,0,0,0");
  assert.equal(
    buildTuneParam_({ Fajr: 2, Sunrise: -1, Dhuhr: 3, Asr: 4, Maghrib: 5, Isha: -6 }),
    "2,2,-1,3,4,5,0,-6,0"
  );
  assert.equal(buildTuneParam_({ Fajr: 500, Isha: -500, Asr: "x" }), "60,60,0,0,0,0,0,-60,0");
  assert.equal(buildTuneParam_(undefined), "0,0,0,0,0,0,0,0,0");
});

test("buildAladhanMonthUrl_ uses https and the calendar endpoint", () => {
  const settings = Object.assign(defaultSettings_(), { method: 2, school: 1, highLatitudeRule: 1 });
  settings.offsets.Isha = 3;
  assert.equal(
    buildAladhanMonthUrl_(2026, 11, budapest, settings),
    "https://api.aladhan.com/v1/calendar/2026/11?latitude=47.4984&longitude=19.0405&method=2&school=1" +
      "&latitudeAdjustmentMethod=1&tune=0%2C0%2C0%2C0%2C0%2C0%2C0%2C3%2C0" +
      "&timezonestring=Europe%2FBudapest&iso8601=true"
  );
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
