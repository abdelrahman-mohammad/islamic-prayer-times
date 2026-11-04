"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddOn } = require("./helpers/load");

const gas = loadAddOn();

test("parseIsoDate_ accepts real dates and rejects impossible ones", () => {
  assert.deepEqual(parseIsoDate_("2026-11-04"), { year: 2026, month: 11, day: 4 });
  assert.deepEqual(parseIsoDate_("2024-02-29"), { year: 2024, month: 2, day: 29 });
  assert.throws(() => parseIsoDate_("2026-02-29"), /Invalid date/);
  assert.throws(() => parseIsoDate_("2026-13-01"), /Invalid date/);
  assert.throws(() => parseIsoDate_("04-11-2026"), /Invalid date/);
  assert.throws(() => parseIsoDate_(""), /Invalid date/);
});

test("addDays_ crosses month, year and leap-day boundaries", () => {
  assert.equal(addDays_("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays_("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays_("2027-01-01", -1), "2026-12-31");
  assert.equal(addDays_("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays_("2028-02-29", 1), "2028-03-01");
  assert.equal(addDays_("2026-03-28", 2), "2026-03-30");
  assert.equal(addDays_("2026-11-04", 0), "2026-11-04");
  assert.equal(addDays_("2026-11-04", 29), "2026-12-03");
});

test("weekdayOf_ returns 0 for Sunday through 6 for Saturday", () => {
  assert.equal(weekdayOf_("2026-11-01"), 0);
  assert.equal(weekdayOf_("2026-11-04"), 3);
  assert.equal(weekdayOf_("2026-11-06"), 5);
  assert.equal(weekdayOf_("2026-03-29"), 0);
  assert.equal(weekdayOf_("2000-01-01"), 6);
});

test("daysBetween_ and datesBetween_ count whole days", () => {
  assert.equal(daysBetween_("2026-11-04", "2026-12-03"), 29);
  assert.equal(daysBetween_("2026-12-03", "2026-11-04"), -29);
  assert.equal(daysBetween_("2026-03-28", "2026-03-30"), 2);
  assert.deepEqual(datesBetween_("2026-12-30", "2027-01-02"), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.deepEqual(datesBetween_("2026-11-04", "2026-11-04"), ["2026-11-04"]);
});

test("monthsCovering_ lists each month once, across years", () => {
  assert.deepEqual(monthsCovering_("2026-11-04", "2026-12-03"), [
    { year: 2026, month: 11 },
    { year: 2026, month: 12 },
  ]);
  assert.deepEqual(monthsCovering_("2026-12-15", "2027-01-13"), [
    { year: 2026, month: 12 },
    { year: 2027, month: 1 },
  ]);
  assert.deepEqual(monthsCovering_("2026-11-04", "2026-11-04"), [{ year: 2026, month: 11 }]);
});

test("monthsForRange_ adds a margin for the Hijri adjustment", () => {
  assert.deepEqual(monthsForRange_("2026-11-01", "2026-11-30", 0), [{ year: 2026, month: 11 }]);
  assert.deepEqual(monthsForRange_("2026-11-01", "2026-11-30", 1), [
    { year: 2026, month: 10 },
    { year: 2026, month: 11 },
    { year: 2026, month: 12 },
  ]);
  assert.deepEqual(monthsForRange_("2026-11-05", "2026-11-20", -2), [{ year: 2026, month: 11 }]);
});

test("aladhanDateToIso_ converts DD-MM-YYYY", () => {
  assert.equal(aladhanDateToIso_("04-11-2026"), "2026-11-04");
  assert.throws(() => aladhanDateToIso_("2026-11-04"), /Unexpected date/);
  assert.throws(() => aladhanDateToIso_("31-02-2026"), /Invalid date/);
});

test("syncWindow_ covers today and the following days", () => {
  assert.deepEqual(syncWindow_("2026-11-04", 30), { start: "2026-11-04", end: "2026-12-03" });
  assert.deepEqual(syncWindow_("2026-11-04", 7), { start: "2026-11-04", end: "2026-11-10" });
  assert.deepEqual(syncWindow_("2026-11-04", 1), { start: "2026-11-04", end: "2026-11-04" });
  assert.deepEqual(syncWindow_("2026-11-04", 0), { start: "2026-11-04", end: "2026-11-04" });
});

test("formatLongDate_ and formatShortDate_ write English dates", () => {
  assert.equal(formatLongDate_("2026-11-04"), "Wednesday 4 November");
  assert.equal(formatLongDate_("2026-11-04", true), "Wednesday 4 November 2026");
  assert.equal(formatShortDate_("2026-12-03"), "3 Dec");
});

test("the loader exposes const declarations too", () => {
  assert.equal(gas("APP_").aladhanBaseUrl, "https://api.aladhan.com/v1");
  assert.equal(gas("FIELD_").method, "method");
});
