"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddOn } = require("./helpers/load");
const tz = require("./helpers/tz");
const { aladhanMonth } = require("./helpers/aladhan");

loadAddOn();

const ZONE = "Europe/Budapest";
const budapest = {
  name: "Budapest",
  region: "Budapest",
  country: "Hungary",
  countryCode: "HU",
  latitude: 47.4984,
  longitude: 19.0405,
  timezone: ZONE,
};

function settingsWith(changes) {
  return normalizeSettings_(Object.assign(defaultSettings_(), { location: budapest, setupComplete: true }, changes || {}));
}

function daysFor(months) {
  return months.flatMap(([year, month]) =>
    parseAladhanCalendar_(aladhanMonth(year, month, { timeZone: ZONE, latitude: 47.4984, longitude: 19.0405 }), tz.localToEpoch)
  );
}

const novDec = daysFor([[2026, 11], [2026, 12]]);
const ramadan = daysFor([[2027, 2], [2027, 3]]);
const window30 = syncWindow_("2026-11-04", 30);
const ctx = { window: window30, use24h: true };

function day(days, date) {
  return days.find((d) => d.date === date);
}

test("eventTimeForDay_ names Friday's Dhuhr Jumu'ah and can move it", () => {
  const friday = day(novDec, "2026-11-06");
  const thursday = day(novDec, "2026-11-05");
  assert.equal(eventTimeForDay_(friday, "Dhuhr", settingsWith()).title, "Jumu'ah");
  assert.equal(eventTimeForDay_(thursday, "Dhuhr", settingsWith()).title, "Dhuhr");
  assert.equal(eventTimeForDay_(friday, "Dhuhr", settingsWith({ jumuah: false })).title, "Dhuhr");
  assert.equal(eventTimeForDay_(friday, "Asr", settingsWith()).title, "Asr");

  const fixed = eventTimeForDay_(friday, "Dhuhr", settingsWith({ jumuahTime: "13:30" }));
  assert.equal(fixed.minutes, 13 * 60 + 30);
  assert.equal(fixed.epochMs, tz.localToEpoch("2026-11-06", 13 * 60 + 30, ZONE));
  const atDhuhr = eventTimeForDay_(friday, "Dhuhr", settingsWith());
  assert.equal(atDhuhr.epochMs, friday.times.Dhuhr.epochMs);
});

test("scheduleForDay_ lists every daily time and adds Suhoor and Iftar in Ramadan", () => {
  const normal = scheduleForDay_(day(novDec, "2026-11-04"), settingsWith());
  assert.deepEqual(normal.map((r) => r.title), ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]);
  const fasting = scheduleForDay_(day(ramadan, "2027-02-10"), settingsWith());
  assert.deepEqual(fasting.map((r) => r.title), ["Suhoor ends", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Iftar", "Isha"]);
  const off = scheduleForDay_(day(ramadan, "2027-02-10"), settingsWith({ ramadan: false }));
  assert.equal(off.length, 6);
});

test("findNextPrayer_ skips Sunrise and rolls over to tomorrow's Fajr", () => {
  const today = day(novDec, "2026-11-04");
  const tomorrow = day(novDec, "2026-11-05");
  const s = settingsWith();
  const beforeFajr = today.times.Fajr.epochMs - 60000;
  assert.equal(findNextPrayer_([today, tomorrow], s, beforeFajr).title, "Fajr");
  const afterFajr = today.times.Fajr.epochMs + 60000;
  assert.equal(findNextPrayer_([today, tomorrow], s, afterFajr).title, "Dhuhr", "Sunrise is not a prayer");
  const atAsr = today.times.Asr.epochMs;
  assert.equal(findNextPrayer_([today, tomorrow], s, atAsr).title, "Maghrib");
  const night = today.times.Isha.epochMs + 60000;
  const next = findNextPrayer_([today, tomorrow], s, night);
  assert.equal(next.title, "Fajr");
  assert.equal(next.date, "2026-11-05");
  assert.equal(findNextPrayer_([today], s, night), null);
  const friday = day(novDec, "2026-11-06");
  const jumuah = findNextPrayer_([day(novDec, "2026-11-05"), friday], s, friday.times.Fajr.epochMs + 1);
  assert.equal(jumuah.title, "Jumu'ah");
});

test("buildDesiredEvents_ makes one event per selected prayer per day", () => {
  const specs = buildDesiredEvents_(novDec, settingsWith(), ctx);
  assert.equal(specs.length, 30 * 5);
  assert.equal(specs[0].key, "2026-11-04|Fajr");
  assert.equal(specs[specs.length - 1].key, "2026-12-03|Isha");
  assert.equal(new Set(specs.map((s) => s.key)).size, specs.length, "keys are unique");
  const fridays = specs.filter((s) => s.title === "Jumu'ah").map((s) => s.date);
  assert.deepEqual(fridays, ["2026-11-06", "2026-11-13", "2026-11-20", "2026-11-27"]);
  specs.forEach((spec) => {
    assert.ok(spec.date >= window30.start && spec.date <= window30.end);
    assert.equal(spec.endMs - spec.startMs, 15 * 60000);
    assert.equal(spec.timeZone, ZONE);
    assert.equal(spec.transparent, true);
    assert.equal(spec.reminderMinutes, 0);
    assert.match(spec.sig, /^[0-9a-f]{8}$/);
  });
});

test("buildDesiredEvents_ honours the prayer choice, Sunrise and duration", () => {
  const specs = buildDesiredEvents_(novDec, settingsWith({ prayers: ["Fajr", "Sunrise"], durationMinutes: 5 }), ctx);
  assert.equal(specs.length, 60);
  assert.deepEqual([...new Set(specs.map((s) => s.title))], ["Fajr", "Sunrise"]);
  assert.equal(specs[1].endMs - specs[1].startMs, 5 * 60000);
});

test("buildDesiredEvents_ adds Suhoor and Iftar only on Ramadan days", () => {
  const window = syncWindow_("2027-02-05", 7); // 5 to 11 Feb; Ramadan starts on the 8th here.
  const specs = buildDesiredEvents_(ramadan, settingsWith(), { window, use24h: true });
  const suhoor = specs.filter((s) => s.slot === "Suhoor");
  const iftar = specs.filter((s) => s.slot === "Iftar");
  assert.deepEqual(suhoor.map((s) => s.date), ["2027-02-08", "2027-02-09", "2027-02-10", "2027-02-11"]);
  assert.equal(iftar.length, 4);
  const d = day(ramadan, "2027-02-08");
  assert.equal(suhoor[0].title, "Suhoor ends");
  assert.equal(suhoor[0].startMs, d.times.Imsak.epochMs);
  assert.equal(suhoor[0].endMs, d.times.Fajr.epochMs);
  assert.equal(iftar[0].startMs, d.times.Maghrib.epochMs);

  const shifted = applyHijriAdjustment_(ramadan, -1);
  const later = buildDesiredEvents_(shifted, settingsWith({ hijriAdjustment: -1 }), { window, use24h: true });
  assert.equal(later.find((s) => s.slot === "Suhoor").date, "2027-02-09", "a -1 adjustment starts Ramadan a day later");
  const none = buildDesiredEvents_(ramadan, settingsWith({ ramadan: false }), { window, use24h: true });
  assert.equal(none.filter((s) => s.slot === "Suhoor" || s.slot === "Iftar").length, 0);
});

test("event descriptions name the place, method and Hijri date without emojis", () => {
  const specs = buildDesiredEvents_(novDec, settingsWith({ prayers: ["Fajr", "Sunrise", "Dhuhr", "Asr"], jumuahTime: "13:30" }), ctx);
  const fajr = specs.find((s) => s.key === "2026-11-04|Fajr");
  assert.match(fajr.description, /^Fajr prayer time in Budapest, Hungary\./);
  assert.match(fajr.description, /Calculation method: Muslim World League\./);
  assert.match(fajr.description, /Hijri date: 23 Jumada al-Ula 1448 AH\./);
  assert.match(fajr.description, /Times from AlAdhan \(aladhan\.com\)/);
  const asr = specs.find((s) => s.key === "2026-11-04|Asr");
  assert.match(asr.description, /Asr time: Standard\./);
  const sunrise = specs.find((s) => s.key === "2026-11-04|Sunrise");
  assert.match(sunrise.description, /^Sunrise in Budapest, Hungary\. The time for Fajr ends at sunrise\./);
  const jumuah = specs.find((s) => s.key === "2026-11-06|Dhuhr");
  assert.equal(jumuah.title, "Jumu'ah");
  assert.match(jumuah.description, /Your chosen time\. Dhuhr is at \d\d:\d\d\./);
  specs.forEach((spec) => assert.doesNotMatch(spec.description + spec.title, /\p{Extended_Pictographic}/u));
});

test("event signatures change only when the event would change", () => {
  const base = buildDesiredEvents_(novDec, settingsWith(), ctx);
  const again = buildDesiredEvents_(novDec, settingsWith(), ctx);
  assert.deepEqual(again.map((s) => s.sig), base.map((s) => s.sig));
  const free = buildDesiredEvents_(novDec, settingsWith({ showAsFree: false }), ctx);
  assert.ok(free.every((s, i) => s.sig !== base[i].sig));
  const reminder = buildDesiredEvents_(novDec, settingsWith({ reminderMinutes: 10 }), ctx);
  assert.ok(reminder.every((s, i) => s.sig !== base[i].sig));
  const clock = buildDesiredEvents_(novDec, settingsWith({ jumuahTime: "13:30" }), Object.assign({}, ctx, { use24h: false }));
  const jumuahIndex = base.findIndex((s) => s.key === "2026-11-06|Dhuhr");
  assert.notEqual(clock[jumuahIndex].sig, base[jumuahIndex].sig);
});

test("eventResource_ is a valid Calendar API event with the add-on's tags", () => {
  const spec = buildDesiredEvents_(novDec, settingsWith({ reminderMinutes: 10 }), ctx)[0];
  const resource = eventResource_(spec);
  assert.equal(resource.summary, "Fajr");
  assert.equal(resource.start.dateTime, toRfc3339_(spec.startMs));
  assert.equal(resource.start.timeZone, ZONE);
  assert.equal(resource.end.dateTime, toRfc3339_(spec.endMs));
  assert.equal(resource.transparency, "transparent");
  assert.deepEqual(resource.reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] });
  assert.deepEqual(resource.extendedProperties, {
    private: {
      prayerTimeEvent: "true",
      prayerName: "Fajr",
      prayerDate: "2026-11-04",
      prayerSig: spec.sig,
      prayerVersion: "2",
    },
  });
  const busy = eventResource_(buildDesiredEvents_(novDec, settingsWith({ showAsFree: false, reminderMinutes: null }), ctx)[0]);
  assert.equal(busy.transparency, "opaque");
  assert.deepEqual(busy.reminders, { useDefault: false, overrides: [] });
  Object.keys(resource.extendedProperties.private).forEach((key) => assert.ok(key.length <= 44, key));
});

/** An existing calendar event as the Calendar API lists it. */
function existingEvent(id, spec, tagChanges) {
  const tags = Object.assign({}, eventResource_(spec).extendedProperties.private, tagChanges || {});
  Object.keys(tags).forEach((key) => tags[key] === undefined && delete tags[key]);
  return { id, start: { dateTime: toRfc3339_(spec.startMs) }, extendedProperties: { private: tags } };
}

test("planSync_ inserts everything into an empty calendar, day by day", () => {
  const desired = buildDesiredEvents_(novDec, settingsWith(), ctx);
  const ops = planSync_(desired, [], [], window30, "cal");
  assert.equal(ops.length, 150);
  assert.ok(ops.every((op) => op.type === "insert" && op.calendarId === "cal"));
  const dates = ops.map((op) => op.date);
  assert.deepEqual(dates, [...dates].sort());
});

test("planSync_ does nothing when the calendar already matches", () => {
  const desired = buildDesiredEvents_(novDec, settingsWith(), ctx);
  const existing = desired.map((spec, i) => existingEvent("e" + i, spec));
  assert.deepEqual(planSync_(desired, existing, [], window30, "cal"), []);
});

test("planSync_ updates changed events and deletes unwanted ones", () => {
  const before = buildDesiredEvents_(novDec, settingsWith(), ctx);
  const existing = before.map((spec, i) => existingEvent("e" + i, spec));
  const after = buildDesiredEvents_(novDec, settingsWith({ prayers: ["Fajr", "Dhuhr", "Maghrib", "Isha"], method: 2 }), ctx);
  const ops = planSync_(after, existing, [], window30, "cal");
  const byType = (type) => ops.filter((op) => op.type === type);
  assert.equal(byType("delete").length, 30, "every Asr event goes");
  assert.equal(byType("update").length, 120, "the method change touches the rest");
  assert.equal(byType("insert").length, 0);
  assert.ok(byType("update").every((op) => op.eventId && op.spec));
  // Within a day: deletes, then updates.
  const firstDay = ops.filter((op) => op.date === "2026-11-04").map((op) => op.type);
  assert.deepEqual(firstDay, ["delete", "update", "update", "update", "update"]);
});

test("planSync_ removes duplicates and keeps the event that already matches", () => {
  const desired = buildDesiredEvents_(novDec, settingsWith(), ctx).slice(0, 1);
  const spec = desired[0];
  const existing = [existingEvent("stale", spec, { prayerSig: "00000000" }), existingEvent("good", spec)];
  const ops = planSync_(desired, existing, [], syncWindow_("2026-11-04", 1), "cal");
  assert.deepEqual(ops.map((op) => [op.type, op.eventId]), [["delete", "stale"]]);
  const twoStale = [existingEvent("a", spec, { prayerSig: "1" }), existingEvent("b", spec, { prayerSig: "2" })];
  const ops2 = planSync_(desired, twoStale, [], syncWindow_("2026-11-04", 1), "cal");
  assert.deepEqual(ops2.map((op) => [op.type, op.eventId]), [["delete", "b"], ["update", "a"]]);
});

test("planSync_ leaves past events and other people's events alone", () => {
  const desired = buildDesiredEvents_(novDec, settingsWith(), ctx);
  const existing = desired.map((spec, i) => existingEvent("e" + i, spec));
  const yesterday = Object.assign({}, desired[0], { key: "2026-11-03|Fajr", date: "2026-11-03" });
  existing.push(existingEvent("past", yesterday));
  existing.push({ id: "mine", summary: "Fajr Prayer with family", extendedProperties: { private: {} } });
  existing.push({ id: "other-app", extendedProperties: { private: { prayerTimeEvent: "yes" } } });
  existing.push({ id: "shared", extendedProperties: { shared: { prayerTimeEvent: "true" } } });
  assert.deepEqual(planSync_(desired, existing, [], window30, "cal"), []);
});

test("planSync_ deletes version 1 events first and old calendars' events last", () => {
  const desired = buildDesiredEvents_(novDec, settingsWith(), ctx).slice(0, 2);
  const legacy = { id: "v1", extendedProperties: { private: { prayerTimeEvent: "true", prayerName: "Fajr" } } };
  const oldCalendarEvents = [
    existingEvent("moved-future", desired[0]),
    existingEvent("moved-past", Object.assign({}, desired[0], { date: "2026-10-01", key: "2026-10-01|Fajr" })),
    { id: "moved-v1", extendedProperties: { private: { prayerTimeEvent: "true" } } },
  ];
  const ops = planSync_(desired, [legacy], [{ calendarId: "old", events: oldCalendarEvents }], syncWindow_("2026-11-04", 1), "cal");
  assert.deepEqual(
    ops.map((op) => [op.type, op.calendarId, op.eventId || op.spec.key]),
    [
      ["delete", "cal", "v1"],
      ["insert", "cal", "2026-11-04|Fajr"],
      ["insert", "cal", "2026-11-04|Dhuhr"],
      ["delete", "old", "moved-future"],
      ["delete", "old", "moved-v1"],
    ]
  );
});

test("planSync_ never cleans the target calendar under another name", () => {
  const desired = buildDesiredEvents_(novDec, settingsWith(), ctx).slice(0, 2);
  const existing = desired.map((spec, i) => existingEvent("e" + i, spec));
  // "primary" and the real ID are the same calendar, so the same events come back twice.
  assert.deepEqual(planSync_(desired, existing, [{ calendarId: "primary", events: existing }], syncWindow_("2026-11-04", 1), "me@example.com"), []);
  assert.deepEqual(planSync_(desired, existing, [{ calendarId: "cal", events: [existingEvent("x", desired[0])] }], syncWindow_("2026-11-04", 1), "cal"), []);
});

test("planRemoval_ deletes an event once even if its calendar is listed twice", () => {
  const event = { id: "1", extendedProperties: { private: { prayerTimeEvent: "true" } } };
  const ops = planRemoval_([{ calendarId: "a", events: [event] }, { calendarId: "a", events: [event] }]);
  assert.equal(ops.length, 1);
});

test("planSync_ deletes events past a shorter window", () => {
  const thirty = buildDesiredEvents_(novDec, settingsWith(), ctx);
  const existing = thirty.map((spec, i) => existingEvent("e" + i, spec));
  const window7 = syncWindow_("2026-11-04", 7);
  const seven = buildDesiredEvents_(novDec, settingsWith({ daysAhead: 7 }), { window: window7, use24h: true });
  const ops = planSync_(seven, existing, [], window7, "cal");
  assert.equal(ops.length, 23 * 5);
  assert.ok(ops.every((op) => op.type === "delete" && op.date > window7.end));
});

test("planRemoval_ deletes every tagged event in every calendar", () => {
  const ops = planRemoval_([
    { calendarId: "a", events: [{ id: "1", extendedProperties: { private: { prayerTimeEvent: "true" } } }, { id: "2" }] },
    { calendarId: "b", events: [{ id: "3", extendedProperties: { private: { prayerTimeEvent: "true", prayerDate: "2020-01-01" } } }] },
  ]);
  assert.deepEqual(ops.map((op) => [op.calendarId, op.eventId]), [["a", "1"], ["b", "3"]]);
});

test("calendarRequestForOp_ builds REST requests", () => {
  const spec = buildDesiredEvents_(novDec, settingsWith(), ctx)[0];
  const insert = calendarRequestForOp_({ type: "insert", calendarId: "abc@group.calendar.google.com", spec });
  assert.equal(insert.url, "https://www.googleapis.com/calendar/v3/calendars/abc%40group.calendar.google.com/events");
  assert.equal(insert.method, "post");
  assert.deepEqual(JSON.parse(insert.payload), eventResource_(spec));
  const update = calendarRequestForOp_({ type: "update", calendarId: "primary", eventId: "e/1", spec });
  assert.equal(update.url, "https://www.googleapis.com/calendar/v3/calendars/primary/events/e%2F1");
  assert.equal(update.method, "patch");
  const del = calendarRequestForOp_({ type: "delete", calendarId: "primary", eventId: "e1" });
  assert.deepEqual(del, { url: "https://www.googleapis.com/calendar/v3/calendars/primary/events/e1", method: "delete" });
  assert.throws(() => calendarRequestForOp_({ type: "move" }), /Unknown calendar operation/);
});

test("classifyCalendarResponse_ separates retries, stops and plain failures", () => {
  const insert = { type: "insert" };
  const del = { type: "delete" };
  const body = (reason, message) => JSON.stringify({ error: { code: 403, message: message || "", errors: [{ reason }] } });
  assert.deepEqual(classifyCalendarResponse_(insert, 200, "{}"), { ok: true });
  assert.deepEqual(classifyCalendarResponse_(del, 204, ""), { ok: true });
  assert.deepEqual(classifyCalendarResponse_(del, 410, ""), { ok: true }, "already deleted");
  assert.deepEqual(classifyCalendarResponse_(del, 404, ""), { ok: true });
  assert.equal(classifyCalendarResponse_(insert, 404, "").ok, false);
  assert.equal(classifyCalendarResponse_(insert, 403, body("rateLimitExceeded")).retry, true);
  assert.equal(classifyCalendarResponse_(insert, 403, body("userRateLimitExceeded")).retry, true);
  assert.equal(classifyCalendarResponse_(insert, 429, "").retry, true);
  assert.equal(classifyCalendarResponse_(insert, 503, "<html>").retry, true);
  const quota = classifyCalendarResponse_(insert, 403, body("quotaExceeded"));
  assert.equal(quota.stop, true);
  assert.match(quota.message, /limit for adding events/);
  const denied = classifyCalendarResponse_(insert, 403, body("insufficientPermissions", "Insufficient Permission"));
  assert.equal(denied.stop, true);
  assert.match(denied.message, /insufficientPermissions/);
  const bad = classifyCalendarResponse_(insert, 400, JSON.stringify({ error: { message: "Invalid start time." } }));
  assert.deepEqual([bad.ok, bad.retry, bad.stop, bad.message], [false, false, false, "Invalid start time."]);
});

test("summarizeSync_ reports how far the calendar is complete", () => {
  const window = syncWindow_("2026-11-04", 3);
  const ops = [
    { type: "delete", date: null },
    { type: "insert", date: "2026-11-04" },
    { type: "update", date: "2026-11-05" },
    { type: "insert", date: "2026-11-06" },
    { type: "delete", date: "2026-11-09" },
  ];
  const all = summarizeSync_(ops, ops.map(() => "done"), window);
  assert.deepEqual(all, {
    inserted: 2, updated: 1, deleted: 2, failed: 0, pending: 0, syncedThrough: "2026-11-06", complete: true, cleanupPending: false,
  });
  const partial = summarizeSync_(ops, ["done", "done", "failed", undefined, undefined], window);
  assert.equal(partial.syncedThrough, "2026-11-04");
  assert.equal(partial.failed, 1);
  assert.equal(partial.pending, 2);
  assert.equal(partial.complete, false);
  assert.equal(summarizeSync_(ops, [undefined, "failed"], window).syncedThrough, null);
  const lateCleanup = summarizeSync_(ops, ["done", "done", "done", "done", undefined], window);
  assert.equal(lateCleanup.syncedThrough, "2026-11-06", "a pending delete after the window does not shorten it");
  assert.equal(summarizeSync_(ops, [undefined, "done", "done", "done", "done"], window).cleanupPending, true);
  assert.equal(summarizeSync_([], [], window).syncedThrough, "2026-11-06");
});

test("syncMessage_ explains the result", () => {
  const window = syncWindow_("2026-11-04", 30);
  assert.equal(syncMessage_(summarizeSync_([], [], window)), "Your calendar is up to date through 3 Dec.");
  const done = summarizeSync_([{ type: "insert", date: "2026-11-04" }, { type: "delete", date: null }], ["done", "done"], window);
  assert.equal(syncMessage_(done), "Calendar updated through 3 Dec: 1 added, 1 removed.");
  const partial = summarizeSync_([{ type: "insert", date: "2026-11-04" }, { type: "insert", date: "2026-11-20" }], ["done"], window);
  assert.equal(syncMessage_(partial), "Added prayer times through 19 Nov. Some changes are not done yet. Select Sync now again to finish.");
  const none = summarizeSync_([{ type: "insert", date: "2026-11-04" }], [], window);
  assert.equal(syncMessage_(none), "Some changes are not done yet. Select Sync now again to finish.");
});
