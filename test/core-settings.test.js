"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddOn } = require("./helpers/load");

loadAddOn();

const budapest = {
  name: "Budapest",
  region: "Budapest",
  country: "Hungary",
  countryCode: "HU",
  latitude: 47.4984,
  longitude: 19.0405,
  timezone: "Europe/Budapest",
};

/** Builds V8 add-on form inputs from {field: [values]}. */
function formEvent(values) {
  const formInputs = {};
  Object.keys(values).forEach((name) => {
    formInputs[name] = { stringInputs: { value: values[name] } };
  });
  return { commonEventObject: { formInputs } };
}

test("defaultSettings_ uses a dedicated calendar, the five prayers and a reminder at prayer time", () => {
  const s = defaultSettings_();
  assert.deepEqual(s.prayers, ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
  assert.equal(s.calendar, "dedicated");
  assert.equal(s.reminderMinutes, 0);
  assert.equal(s.method, 3);
  assert.equal(s.showAsFree, true);
  assert.equal(s.autoSync, true);
  assert.equal(s.setupComplete, false);
  assert.deepEqual(normalizeSettings_(s), s);
});

test("normalizeSettings_ keeps 0 and null reminders and drops invalid values", () => {
  assert.equal(normalizeSettings_({ reminderMinutes: 0 }).reminderMinutes, 0);
  assert.equal(normalizeSettings_({ reminderMinutes: null }).reminderMinutes, null);
  assert.equal(normalizeSettings_({ reminderMinutes: "x" }).reminderMinutes, 0);
  assert.equal(normalizeSettings_({ method: 0 }).method, 0, "Jafari is method 0, not missing");
  assert.equal(normalizeSettings_({ method: 6 }).method, 3);
  assert.equal(normalizeSettings_({ school: 1 }).school, 1);
  assert.equal(normalizeSettings_({ school: 2 }).school, 0);
  assert.equal(normalizeSettings_({ highLatitudeRule: 9 }).highLatitudeRule, 3);
  assert.deepEqual(normalizeSettings_({ prayers: ["Isha", "Fajr", "Nope"] }).prayers, ["Fajr", "Isha"]);
  assert.deepEqual(normalizeSettings_({ prayers: [] }).prayers, ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
  assert.equal(normalizeSettings_({ jumuahTime: "1:30 pm" }).jumuahTime, "13:30");
  assert.equal(normalizeSettings_({ jumuahTime: "soon" }).jumuahTime, "");
  assert.equal(normalizeSettings_({ offsets: { Fajr: 90, Isha: -2 } }).offsets.Fajr, 60);
  assert.equal(normalizeSettings_({ offsets: { Fajr: 90, Isha: -2 } }).offsets.Isha, -2);
  assert.equal(normalizeSettings_({ location: { latitude: 100, longitude: 0 } }).location, null);
  assert.equal(normalizeSettings_({ setupComplete: true }).setupComplete, false, "setup needs a location");
  assert.equal(normalizeSettings_({ setupComplete: true, location: budapest }).setupComplete, true);
  assert.deepEqual(normalizeSettings_(null), defaultSettings_());
});

test("migrateLegacySettings_ converts version 1 user properties", () => {
  const migrated = migrateLegacySettings_(
    {
      latitude: "47.4979",
      longitude: "19.0402",
      locationName: "Budapest, Hungary",
      calendarId: "primary",
      method: "2",
      reminderMinutes: "0",
      dailySyncHour: "0",
      eventDuration: "45",
      onboardingComplete: "true",
      lastSyncDate: "2026-11-01T01:00:00.000Z",
    },
    true
  );
  assert.deepEqual(migrated.location, {
    name: "Budapest",
    region: "",
    country: "Hungary",
    countryCode: "",
    latitude: 47.4979,
    longitude: 19.0402,
    timezone: "",
  });
  assert.equal(migrated.method, 2);
  assert.equal(migrated.methodChosen, true);
  assert.equal(migrated.reminderMinutes, 0, "a 0-minute reminder stays 0");
  assert.equal(migrated.durationMinutes, 45);
  assert.equal(migrated.calendar, "primary");
  assert.equal(migrated.autoSync, true);
  assert.equal(migrated.setupComplete, true);
});

test("migrateLegacySettings_ handles partial and empty version 1 data", () => {
  assert.equal(migrateLegacySettings_({}, false), null);
  assert.equal(migrateLegacySettings_({ unrelated: "x" }, false), null);
  const partial = migrateLegacySettings_({ method: "5", onboardingComplete: "true" }, false);
  assert.equal(partial.location, null);
  assert.equal(partial.method, 5);
  assert.equal(partial.setupComplete, false);
  assert.equal(partial.autoSync, false);
  assert.equal(partial.reminderMinutes, 0);
  const odd = migrateLegacySettings_({ latitude: "abc", longitude: "1", reminderMinutes: "soon", method: "77" }, false);
  assert.equal(odd.location, null);
  assert.equal(odd.method, 3);
});

test("withLocation_ suggests method and school unless the user chose them", () => {
  const pakistan = Object.assign({}, budapest, { name: "Lahore", country: "Pakistan", countryCode: "PK", timezone: "Asia/Karachi" });
  const suggested = withLocation_(defaultSettings_(), pakistan);
  assert.equal(suggested.method, 1);
  assert.equal(suggested.school, 1);
  const chosen = withLocation_(Object.assign(defaultSettings_(), { method: 15, methodChosen: true, school: 0, schoolChosen: true }), pakistan);
  assert.equal(chosen.method, 15);
  assert.equal(chosen.school, 0);
  const noCountry = withLocation_(Object.assign(defaultSettings_(), { method: 15 }), { latitude: 1, longitude: 2 });
  assert.equal(noCountry.method, 15, "coordinates without a country keep the method");
  assert.equal(noCountry.location.name, "1.0000, 2.0000");
});

test("readFormInputs_ reads V8 and legacy event objects", () => {
  assert.deepEqual(readFormInputs_(formEvent({ method: ["2"], prayers: ["Fajr", "Isha"] })), {
    method: ["2"],
    prayers: ["Fajr", "Isha"],
  });
  assert.deepEqual(readFormInputs_({ formInputs: { method: ["5"], jumuah: "on" } }), { method: ["5"], jumuah: ["on"] });
  assert.deepEqual(readFormInputs_({ commonEventObject: { formInputs: { a: { "": { stringInputs: { value: ["1"] } } } } } }), {
    a: ["1"],
  });
  assert.deepEqual(readFormInputs_(undefined), {});
});

test("applyFormToSettings_ turns off switches and empties checkboxes that are not sent", () => {
  const before = Object.assign(defaultSettings_(), { location: budapest });
  const fields = ["jumuah", "ramadan", "showAsFree", "autoSync", "method"];
  const { settings, errors } = applyFormToSettings_(before, readFormInputs_(formEvent({ method: ["3"] })), fields);
  assert.deepEqual(errors, []);
  assert.equal(settings.jumuah, false);
  assert.equal(settings.ramadan, false);
  assert.equal(settings.showAsFree, false);
  assert.equal(settings.autoSync, false);
  // Fields the card did not show keep their values.
  assert.equal(settings.reminderMinutes, 0);
  assert.deepEqual(settings.prayers, before.prayers);
});

test("applyFormToSettings_ saves every field and marks explicit choices", () => {
  const before = Object.assign(defaultSettings_(), { location: budapest });
  const values = {
    method: ["2"],
    school: ["1"],
    highLatitudeRule: ["1"],
    prayers: ["Fajr", "Sunrise", "Isha"],
    jumuah: ["on"],
    jumuahTime: ["1:15 pm"],
    hijriAdjustment: ["-1"],
    reminder: ["none"],
    duration: ["30"],
    calendar: ["abc@group.calendar.google.com"],
    daysAhead: ["14"],
    offset_Fajr: ["2"],
    offset_Isha: ["-3"],
    offset_Asr: [""],
  };
  const fields = Object.keys(values).concat(["ramadan", "showAsFree", "autoSync"]);
  const { settings, errors } = applyFormToSettings_(before, readFormInputs_(formEvent(values)), fields);
  assert.deepEqual(errors, []);
  assert.equal(settings.method, 2);
  assert.equal(settings.methodChosen, true);
  assert.equal(settings.school, 1);
  assert.equal(settings.schoolChosen, true);
  assert.equal(settings.highLatitudeRule, 1);
  assert.deepEqual(settings.prayers, ["Fajr", "Sunrise", "Isha"]);
  assert.equal(settings.jumuah, true);
  assert.equal(settings.jumuahTime, "13:15");
  assert.equal(settings.hijriAdjustment, -1);
  assert.equal(settings.reminderMinutes, null);
  assert.equal(settings.durationMinutes, 30);
  assert.equal(settings.calendar, "abc@group.calendar.google.com");
  assert.equal(settings.daysAhead, 14);
  assert.deepEqual(settings.offsets, { Fajr: 2, Sunrise: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: -3 });
  assert.equal(settings.ramadan, false);
});

test("applyFormToSettings_ keeps the method choice flag off when the method did not change", () => {
  const before = Object.assign(defaultSettings_(), { location: budapest, method: 3 });
  const { settings } = applyFormToSettings_(before, { method: ["3"], school: ["0"] }, ["method", "school"]);
  assert.equal(settings.methodChosen, false);
  assert.equal(settings.schoolChosen, false);
});

test("applyFormToSettings_ reports invalid values and keeps the old ones", () => {
  const before = Object.assign(defaultSettings_(), { location: budapest, jumuahTime: "13:30" });
  before.offsets.Fajr = 4;
  const values = { prayers: ["Sunrise"], jumuahTime: ["half past one"], offset_Fajr: ["2.5"], offset_Isha: ["90"], reminder: ["0"] };
  const { settings, errors } = applyFormToSettings_(before, values, Object.keys(values));
  assert.deepEqual(errors, [
    "Choose at least one prayer to add to your calendar.",
    "Enter the Jumu'ah time as HH:MM, for example 13:30.",
    "Fajr adjustment must be a whole number of minutes from -60 to 60.",
    "Isha adjustment must be a whole number of minutes from -60 to 60.",
  ]);
  assert.deepEqual(settings.prayers, before.prayers);
  assert.equal(settings.jumuahTime, "13:30");
  assert.equal(settings.offsets.Fajr, 4);
  assert.equal(settings.reminderMinutes, 0, "a reminder at prayer time is saved as 0");
});

test("applyFormToSettings_ ignores unknown dropdown values", () => {
  const before = Object.assign(defaultSettings_(), { location: budapest });
  const values = { method: ["6"], school: ["7"], highLatitudeRule: ["0"], hijriAdjustment: ["5"], duration: ["0"], daysAhead: ["90"] };
  const { settings, errors } = applyFormToSettings_(before, values, Object.keys(values));
  assert.deepEqual(errors, []);
  assert.equal(settings.method, 3);
  assert.equal(settings.school, 0);
  assert.equal(settings.highLatitudeRule, 3);
  assert.equal(settings.hijriAdjustment, 0);
  assert.equal(settings.durationMinutes, 15);
  assert.equal(settings.daysAhead, 30);
});

test("settingsAffectEvents_ ignores changes that do not touch events", () => {
  const a = Object.assign(defaultSettings_(), { location: budapest });
  assert.equal(settingsAffectEvents_(a, Object.assign({}, a, { autoSync: false, setupComplete: true })), false);
  assert.equal(settingsAffectEvents_(a, Object.assign({}, a, { method: 2 })), true);
  assert.equal(settingsAffectEvents_(a, Object.assign({}, a, { offsets: Object.assign({}, a.offsets, { Asr: 1 }) })), true);
});
