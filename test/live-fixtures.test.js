"use strict";

/**
 * The parsers against real responses, captured from the live AlAdhan and
 * Open-Meteo APIs on 4 November 2026 (test/fixtures/live/, trimmed to a few
 * days). The other fixtures are written by hand; these show the real format.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddOn } = require("./helpers/load");
const tz = require("./helpers/tz");

loadAddOn();

const live = (name) => require("./fixtures/live/" + name);

test("live AlAdhan: iso8601=true gives ISO times with the location's offset", () => {
  const json = live("aladhan-budapest-2026-11-iso.json");
  const days = parseAladhanCalendar_(json);
  const nov4 = days.find((d) => d.date === "2026-11-04");
  assert.equal(json.data[1].timings.Fajr, "2026-11-04T04:47:00+01:00");
  assert.equal(nov4.times.Fajr.epochMs, Date.UTC(2026, 10, 4, 3, 47));
  assert.equal(nov4.times.Fajr.minutes, 4 * 60 + 47);
  assert.equal(nov4.timezone, "Europe/Budapest");
  assert.equal(nov4.weekday, 3);
  assert.deepEqual(nov4.hijri, { day: 24, month: 5, year: 1448 });
  assert.equal(formatHijriDate_(nov4.hijri), "24 Jumada al-Ula 1448 AH");
});

test("live AlAdhan: the plain format gives the same instants as the ISO format", () => {
  const iso = parseAladhanCalendar_(live("aladhan-budapest-2026-11-iso.json"));
  const plain = parseAladhanCalendar_(live("aladhan-budapest-2026-11-plain.json"), tz.localToEpoch);
  assert.equal(live("aladhan-budapest-2026-11-plain.json").data[1].timings.Fajr, "04:47 (CET)");
  assert.deepEqual(plain, iso);
});

test("live AlAdhan: daylight saving time changes the offset on 29 March", () => {
  const days = parseAladhanCalendar_(live("aladhan-budapest-2026-03-dst.json"));
  assert.deepEqual(days.map((d) => d.date), ["2026-03-28", "2026-03-29", "2026-03-30"]);
  assert.equal(days[0].times.Fajr.epochMs, Date.UTC(2026, 2, 28, 2, 45)); // 03:45 +01:00
  assert.equal(days[1].times.Fajr.epochMs, Date.UTC(2026, 2, 29, 2, 43)); // 04:43 +02:00
});

test("live AlAdhan: Isha after midnight in Oslo carries the day's own date and is moved to the next day", () => {
  const json = live("aladhan-oslo-2026-06-iso.json");
  assert.equal(json.data[0].timings.Isha, "2026-06-20T00:11:00+02:00", "AlAdhan does not roll the date");
  const days = parseAladhanCalendar_(json);
  days.forEach((day) => {
    assert.ok(day.times.Isha.epochMs > day.times.Maghrib.epochMs, day.date + ": Isha after Maghrib");
    assert.ok(day.times.Isha.epochMs - day.times.Maghrib.epochMs < 6 * 3600000, day.date + ": on the same night");
  });
  assert.equal(days[0].times.Isha.epochMs, Date.UTC(2026, 5, 20, 22, 11)); // 21 June 00:11 +02:00
  // The home card's next prayer just after midnight is the previous day's Isha.
  const settings = Object.assign(defaultSettings_(), { location: { name: "Oslo", latitude: 59.9139, longitude: 10.7522, timezone: "Europe/Oslo" } });
  const justAfterMidnight = Date.UTC(2026, 5, 20, 22, 5); // 21 June 00:05 in Oslo
  const next = findNextPrayer_(days, settings, justAfterMidnight);
  assert.equal(next.title, "Isha");
  assert.equal(next.date, "2026-06-20");
});

test("live AlAdhan: method 13 has its own offsets, and a tune value replaces them", () => {
  const plain = live("aladhan-istanbul-2026-11-method13.json").data[0];
  const tuned = live("aladhan-istanbul-2026-11-method13-tune-dhuhr.json").data[0];
  assert.equal(plain.meta.offset.Dhuhr, 5);
  assert.equal(String(tuned.meta.offset.Dhuhr), "1", "tune=...,1,... replaced the method's +5");
  assert.equal(Date.parse(tuned.timings.Dhuhr) - Date.parse(plain.timings.Dhuhr), -4 * 60000);
  // So the add-on never sends tune, and adds the user's minutes itself.
  assert.doesNotMatch(buildAladhanMonthUrl_(2026, 11, { latitude: 41.0082, longitude: 28.9784, timezone: "Europe/Istanbul" }, defaultSettings_()), /tune=/);
  const days = parseAladhanCalendar_(live("aladhan-istanbul-2026-11-method13.json"));
  const adjusted = applyOffsets_(days, { Dhuhr: 1 });
  assert.equal(adjusted[0].times.Dhuhr.epochMs - days[0].times.Dhuhr.epochMs, 60000, "+1 on top of the method's +5");
});

test("live AlAdhan: without timezonestring the time zone comes from the coordinates", () => {
  assert.equal(parseAladhanTimeZone_(live("aladhan-makkah-no-timezone.json")), "Asia/Riyadh");
});

test("live AlAdhan: a bad request returns code 400 with a message", () => {
  const json = live("aladhan-error-400.json");
  assert.throws(() => parseAladhanCalendar_(json), /geographical coordinates/);
  assert.throws(() => parseAladhanTimeZone_(json), /geographical coordinates/);
});

test("live AlAdhan: every method the add-on offers exists, with the same ID", () => {
  const offered = live("aladhan-methods.json").data;
  const ids = Object.values(offered).map((m) => m.id);
  METHODS_.forEach((m) => assert.ok(ids.includes(m.id), "method " + m.id));
  assert.ok(!ids.includes(6), "there is no method 6");
  const byId = Object.fromEntries(Object.values(offered).map((m) => [m.id, m.name]));
  assert.match(byId[13], /experimental/);
  assert.match(methodName_(13), /experimental/);
  assert.match(byId[16], /experimental/);
  assert.match(methodName_(16), /experimental/);
});

test("live Open-Meteo: results keep city, region, country and time zone", () => {
  const places = parseGeocodeResults_(live("open-meteo-springfield.json"));
  assert.ok(places.length >= 4);
  assert.deepEqual(
    places.slice(0, 3).map((p) => formatPlaceName_(p)),
    ["Springfield, Missouri, United States", "Springfield, Illinois, United States", "Springfield, Massachusetts, United States"]
  );
  assert.equal(places[1].timezone, "America/Chicago");
  const budapest = parseGeocodeResults_(live("open-meteo-budapest.json"));
  assert.equal(pickPlaceForTimeZone_(budapest, "Europe/Budapest").countryCode, "HU");
  assert.equal(formatPlaceName_(budapest[0]), "Budapest, Hungary");
});

test("live Open-Meteo: only populated places are kept when there are any", () => {
  const raw = live("open-meteo-springfield-il.json").results;
  assert.deepEqual(raw.map((r) => r.feature_code), ["PPLA", "PRK", "AIRP"]);
  const places = parseGeocodeResults_(live("open-meteo-springfield-il.json"));
  assert.deepEqual(places.map((p) => formatPlaceName_(p)), ["Springfield, Illinois, United States"]);
  // A search that finds no populated place still shows what it found.
  const onlyAirport = { results: raw.filter((r) => r.feature_code === "AIRP") };
  assert.equal(parseGeocodeResults_(onlyAirport).length, 1);
});

test("live Open-Meteo: no results and errors", () => {
  assert.deepEqual(parseGeocodeResults_(live("open-meteo-no-results.json")), []);
  assert.throws(() => parseGeocodeResults_(live("open-meteo-error-400.json")), /Parameter count must be between 1 and 100/);
});
