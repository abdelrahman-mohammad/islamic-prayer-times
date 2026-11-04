"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddOn } = require("./helpers/load");

loadAddOn();

test("parseAladhanTime_ reads the plain format", () => {
  assert.deepEqual(parseAladhanTime_("05:12 (CET)"), { minutes: 312, epochMs: null, isoDate: null });
  assert.deepEqual(parseAladhanTime_("5:07"), { minutes: 307, epochMs: null, isoDate: null });
  assert.deepEqual(parseAladhanTime_("00:00 (+03)"), { minutes: 0, epochMs: null, isoDate: null });
  assert.equal(parseAladhanTime_("23:59").minutes, 1439);
});

test("parseAladhanTime_ reads ISO 8601 with every offset style", () => {
  const expected = Date.UTC(2026, 10, 4, 4, 12);
  assert.deepEqual(parseAladhanTime_("2026-11-04T05:12:00+01:00"), {
    minutes: 312,
    epochMs: expected,
    isoDate: "2026-11-04",
  });
  assert.equal(parseAladhanTime_("2026-11-04T05:12:00+0100").epochMs, expected);
  assert.equal(parseAladhanTime_("2026-11-04T04:12:00Z").epochMs, expected);
  assert.equal(parseAladhanTime_("2026-11-03T23:12:00-05:00").epochMs, expected);
  assert.equal(parseAladhanTime_("2026-11-04T09:42:00+05:30").epochMs, expected);
  assert.equal(parseAladhanTime_("2026-11-04T05:12+01:00").epochMs, expected);
});

test("parseAladhanTime_ returns null for anything else", () => {
  assert.equal(parseAladhanTime_("25:00"), null);
  assert.equal(parseAladhanTime_("12:60"), null);
  assert.equal(parseAladhanTime_(""), null);
  assert.equal(parseAladhanTime_(null), null);
  assert.equal(parseAladhanTime_(undefined), null);
  assert.equal(parseAladhanTime_("noon"), null);
});

test("parseUserTime_ accepts 24-hour and 12-hour times", () => {
  assert.equal(parseUserTime_("13:30"), 810);
  assert.equal(parseUserTime_("13.30"), 810);
  assert.equal(parseUserTime_(" 9:05 "), 545);
  assert.equal(parseUserTime_("1:30 pm"), 810);
  assert.equal(parseUserTime_("1:30PM"), 810);
  assert.equal(parseUserTime_("12:00 am"), 0);
  assert.equal(parseUserTime_("12:15 pm"), 735);
  assert.equal(parseUserTime_("00:00"), 0);
  assert.equal(parseUserTime_("23:59"), 1439);
});

test("parseUserTime_ rejects invalid input", () => {
  ["24:00", "13:60", "13", "abc", "", "13:3", "0:30 pm", "13:30 pm", "-1:00"].forEach((text) => {
    assert.equal(parseUserTime_(text), null, text);
  });
  assert.equal(parseUserTime_(null), null);
});

test("formatClock_ writes 24-hour and 12-hour clocks", () => {
  assert.equal(formatClock_(312, true), "05:12");
  assert.equal(formatClock_(312, false), "5:12 AM");
  assert.equal(formatClock_(0, true), "00:00");
  assert.equal(formatClock_(0, false), "12:00 AM");
  assert.equal(formatClock_(720, false), "12:00 PM");
  assert.equal(formatClock_(810, false), "1:30 PM");
  assert.equal(formatClock_(1439, true), "23:59");
  assert.equal(formatClock_(1440 + 5, true), "00:05");
  assert.equal(formatClock_(-5, true), "23:55");
});

test("formatDuration_ writes short durations", () => {
  assert.equal(formatDuration_(0), "less than a minute");
  assert.equal(formatDuration_(0.4), "less than a minute");
  assert.equal(formatDuration_(1), "1 min");
  assert.equal(formatDuration_(45), "45 min");
  assert.equal(formatDuration_(60), "1 h");
  assert.equal(formatDuration_(125), "2 h 5 min");
  assert.equal(formatDuration_(-3), "less than a minute");
});

test("toRfc3339_ writes UTC without milliseconds", () => {
  assert.equal(toRfc3339_(Date.UTC(2026, 10, 4, 4, 12)), "2026-11-04T04:12:00Z");
  assert.equal(toRfc3339_(Date.UTC(2026, 10, 4, 4, 12, 30, 999)), "2026-11-04T04:12:30Z");
});

test("parseWholeNumber_ only accepts whole numbers", () => {
  assert.equal(parseWholeNumber_("0"), 0);
  assert.equal(parseWholeNumber_("-10"), -10);
  assert.equal(parseWholeNumber_("+5"), 5);
  assert.equal(parseWholeNumber_(" 7 "), 7);
  assert.equal(parseWholeNumber_(30), 30);
  ["", "5.5", "5 min", "abc", null, undefined, "1e3"].forEach((value) => {
    assert.ok(Number.isNaN(parseWholeNumber_(value)), String(value));
  });
});

test("hashString_ is FNV-1a 32-bit", () => {
  assert.equal(hashString_(""), "811c9dc5");
  assert.equal(hashString_("a"), "e40c292c");
  assert.equal(hashString_("foobar"), "bf9cf968");
  assert.notEqual(hashString_("Fajr|2026-11-04"), hashString_("Fajr|2026-11-05"));
});

test("escapeHtml_ escapes card markup", () => {
  assert.equal(escapeHtml_('Tom & "Jerry" <b>'), "Tom &amp; &quot;Jerry&quot; &lt;b&gt;");
  assert.equal(escapeHtml_(null), "");
});

test("toQueryString_ skips empty values and encodes the rest", () => {
  assert.equal(toQueryString_({ a: 1, b: "", c: null, d: undefined, e: "Europe/Budapest", f: 0 }), "a=1&e=Europe%2FBudapest&f=0");
});

test("localDateTimeText_ writes the text Utilities.parseDate reads", () => {
  assert.equal(localDateTimeText_("2026-11-04", 0), "2026-11-04 00:00");
  assert.equal(localDateTimeText_("2026-11-04", 5 * 60 + 7), "2026-11-04 05:07");
  assert.equal(localDateTimeText_("2026-11-04", 1439), "2026-11-04 23:59");
  assert.throws(() => localDateTimeText_("2026-11-04", 1440), /Invalid minutes/);
  assert.throws(() => localDateTimeText_("2026-11-04", 1.5), /Invalid minutes/);
  assert.throws(() => localDateTimeText_("04-11-2026", 0), /Invalid date/);
});

test("isNotFoundMessage_ recognises a missing calendar", () => {
  assert.equal(isNotFoundMessage_("GoogleJsonResponseException: API call to calendar.events.list failed with error: Not Found"), true);
  assert.equal(isNotFoundMessage_("API call failed with error: Resource has been deleted"), true);
  assert.equal(isNotFoundMessage_("Request failed: 404"), true);
  assert.equal(isNotFoundMessage_("API call failed with error: Forbidden"), false);
  assert.equal(isNotFoundMessage_("calendar 4041@group.calendar.google.com is busy"), false);
  assert.equal(isNotFoundMessage_(undefined), false);
});

test("minutesLabel_ writes minutes and hours", () => {
  assert.equal(minutesLabel_(1), "1 minute");
  assert.equal(minutesLabel_(15), "15 minutes");
  assert.equal(minutesLabel_(60), "1 hour");
  assert.equal(minutesLabel_(120), "2 hours");
  assert.equal(minutesLabel_(90), "90 minutes");
});

test("chunk_ splits lists", () => {
  assert.deepEqual(chunk_([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk_([], 3), []);
});

test("offsetFromMosqueTime_ works out the adjustment from the mosque's time", () => {
  assert.deepEqual(offsetFromMosqueTime_("Fajr", 5 * 60 + 12, "05:20"), { minutes: 8 });
  assert.deepEqual(offsetFromMosqueTime_("Fajr", 5 * 60 + 12, "5:09 am"), { minutes: -3 });
  assert.deepEqual(offsetFromMosqueTime_("Isha", 23 * 60 + 50, "00:10"), { minutes: 20 }, "across midnight");
  assert.deepEqual(offsetFromMosqueTime_("Isha", 10, "23:55"), { minutes: -15 });
  assert.match(offsetFromMosqueTime_("Asr", 14 * 60, "16:00").error, /more than 60 minutes from the calculated 14:00/);
  assert.match(offsetFromMosqueTime_("Asr", 14 * 60, "soon").error, /as HH:MM/);
  assert.equal(formatOffset_(8), "+8 min");
  assert.equal(formatOffset_(-3), "-3 min");
  assert.equal(formatOffset_(0), "0 min");
});
