"use strict";

/**
 * Whole add-on flows, run against fake Apps Script services
 * (test/helpers/environment.js) and a strict fake CardService
 * (test/helpers/card-service.js). These catch runtime errors, wrong method
 * names and broken flows. They do not show how Google renders the cards, and
 * the fake APIs answer from documentation, not from the live services.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddOn } = require("./helpers/load");
const { installEnvironment, PRIMARY_ID } = require("./helpers/environment");
const ui = require("./helpers/card-service");
const tz = require("./helpers/tz");

loadAddOn();

const ZONE = "Europe/Budapest";
// 13:00 in Budapest on Wednesday 4 November 2026.
const NOV_4_1PM = Date.UTC(2026, 10, 4, 12, 0);

function start(t, options) {
  const opts = Object.assign({ now: NOV_4_1PM }, options);
  t.mock.timers.enable({ apis: ["Date"], now: opts.now });
  const env = installEnvironment(Object.assign({ clock: t.mock.timers }, opts));
  t.after(() => {
    env.uninstall();
  });
  return env;
}

/** Every action any card used names a global function. */
function assertActionsExist(env) {
  env.cardLog.actions.forEach((action) => {
    assert.equal(typeof globalThis[action.props.functionName], "function", action.props.functionName);
  });
}

function settingsOf(env) {
  return JSON.parse(env.userProperties.getProperty("settings.v2"));
}

function stateOf(env) {
  return JSON.parse(env.userProperties.getProperty("syncState.v2"));
}

function addOnCalendar(env) {
  return [...env.calendars.values()].find((c) => c.createdByAddOn);
}

/** Runs setup with the suggested location and the default preferences. */
function completeSetup(env, changes) {
  const step1 = onHomepage({});
  const step2 = ui.shownCard(ui.click(step1, "Use"));
  Object.keys(changes || {}).forEach((field) => ui.change(step2, field, changes[field]));
  const done = ui.click(step2, "Add to my calendar");
  return { step1, step2, done, home: ui.shownCard(done) };
}

function writes(env) {
  return env.requests.filter((r) => r.url.includes("/calendar/v3/") && r.method !== "get").length;
}

test("first open shows setup step 1 with a location suggested from the calendar time zone", (t) => {
  const env = start(t);
  const card = onHomepage({ commonEventObject: { hostApp: "CALENDAR" } });
  assert.equal(card.name, "location");
  assert.equal(card.title, "Set up Prayer Times");
  assert.equal(card.subtitle, "Step 1 of 2: your location");
  const text = ui.cardText(card);
  assert.match(text, /Suggested location/);
  assert.match(text, /<b>Budapest<\/b>/);
  assert.match(text, /\bHungary\b/);
  assert.match(text, /Based on your calendar's time zone, Europe\/Budapest/);
  assert.match(text, /Open-Meteo\.com/, "Open-Meteo's terms ask for a link next to location data");
  assert.deepEqual(card.fieldNames, ["locationQuery"], "no API key field");
  assertActionsExist(env);
});

test("setup takes two steps and fills 30 days of a new Prayer Times calendar", (t) => {
  const env = start(t);
  const step1 = onHomepage({});
  const step2 = ui.shownCard(ui.click(step1, "Use"));
  assert.equal(step2.name, "preferences");
  assert.equal(step2.subtitle, "Step 2 of 2: your preferences");
  assert.equal(ui.selectedValue(step2, "method"), "3", "Muslim World League for Hungary");
  assert.equal(ui.selectedValue(step2, "school"), "0");
  assert.equal(ui.selectedValue(step2, "calendar"), "dedicated");
  assert.equal(ui.selectedValue(step2, "reminder"), "0");
  assert.match(ui.cardText(step2), /Suggested for Hungary/);

  const done = ui.click(step2, "Add to my calendar");
  assert.equal(done.notification, "Calendar updated through 3 Dec: 150 added.");
  assert.equal(ui.shownCard(done).name, "home");

  const calendar = addOnCalendar(env);
  assert.equal(calendar.summary, "Prayer Times");
  assert.equal(calendar.timeZone, ZONE);
  const events = env.appEventsIn(calendar.id);
  assert.equal(events.length, 150);
  assert.deepEqual(env.eventsIn(PRIMARY_ID), [], "nothing goes to the main calendar");

  const fajr = events.find((e) => e.extendedProperties.private.prayerDate === "2026-11-04" && e.summary === "Fajr");
  assert.equal(fajr.start.timeZone, ZONE);
  assert.equal(fajr.start.dateTime, toRfc3339_(tz.localToEpoch("2026-11-04", 5 * 60 + 12, ZONE)));
  assert.equal(fajr.transparency, "transparent");
  assert.deepEqual(fajr.reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] });
  assert.equal(events.filter((e) => e.summary === "Jumu'ah").length, 4);

  assert.equal(env.triggers.length, 1);
  assert.deepEqual(env.triggers[0].spec, { hour: 3, everyDays: 1, timeZone: ZONE });
  const settings = settingsOf(env);
  assert.equal(settings.setupComplete, true);
  assert.equal(settings.location.timezone, ZONE);
  assert.deepEqual(env.errorsLogged(), []);
  assertActionsExist(env);
});

test("the home card shows today's times, the next prayer, the Hijri date and the Qibla", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  assert.equal(home.subtitle, "Budapest, Hungary");
  const text = ui.cardText(home);
  assert.match(text, /<b>Wednesday 4 November<\/b>/);
  assert.match(text, /23 Jumada al-Ula 1448 AH/);
  assert.match(text, /<b>Asr at 14:18<\/b>/);
  assert.match(text, /in 1 h 18 min/);
  assert.match(text, /140° southeast/);
  assert.match(text, /Prayer Times<\/b> through Thursday 3 December/);
  assert.match(text, /New days are added automatically every night/);

  const rows = ui.widgetsOf(home).filter((w) => w.type === "DecoratedText" && DAILY_EVENTS_.includes(w.props.topLabel));
  assert.deepEqual(rows.map((w) => w.props.topLabel), ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]);
  assert.match(rows[0].props.text, /#5f6368/, "past times are greyed");
  assert.equal(rows[3].props.text, "<b>14:18</b>", "the next prayer is bold");
  assert.equal(rows[5].props.text, "18:11");
  assert.equal(home.footer.primary.props.text, "Sync now");
  assert.equal(home.footer.secondary.props.text, "Settings");
});

test("the home card follows the calendar's 12-hour clock and notes a different time zone", (t) => {
  const env = start(t, { use24h: false, calendarTimeZone: "Europe/London" });
  env.geocodeResults.london = { results: [] };
  const step1 = onHomepage({});
  assert.doesNotMatch(ui.cardText(step1), /Suggested location/, "no suggestion without a match");
  const results = ui.shownCard(ui.click(step1, "Search", { locationQuery: "Budapest" }));
  const step2 = ui.shownCard(ui.click(results, "Select"));
  const home = ui.shownCard(ui.click(step2, "Add to my calendar"));
  const text = ui.cardText(home);
  assert.match(text, /<b>Asr at 2:18 PM<\/b>/);
  assert.match(text, /Times are local to Budapest \(Europe\/Budapest\)\. Your calendar shows events in its own time zone, Europe\/London\./);
});

test("syncing again changes nothing", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const before = writes(env);
  const again = ui.click(home, "Sync now");
  assert.equal(again.notification, "Your calendar is up to date through 3 Dec.");
  assert.equal(writes(env), before);
  assert.equal(ui.shownCard(again).name, "home");
});

test("settings save as they change and the next sync applies them", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  assert.equal(settingsCard.name, "settings");
  assert.equal(settingsCard.subtitle, "Changes are saved as you make them");

  const saved = ui.change(settingsCard, "method", "2");
  assert.equal(saved.notification, "Saved. Select Sync now to update your calendar.");
  assert.equal(settingsOf(env).method, 2);
  assert.equal(settingsOf(env).methodChosen, true);
  assert.equal(stateOf(env).pendingChanges, true);

  const back = ui.shownCard(ui.click(settingsCard, "Done"));
  assert.equal(settingsOf(env).method, 2, "Done keeps the change");
  assert.match(ui.cardText(back), /Your settings changed\./);

  const synced = ui.click(back, "Sync now");
  assert.equal(synced.notification, "Calendar updated through 3 Dec: 150 updated.");
  assert.equal(stateOf(env).pendingChanges, false);
  const fajr = env.appEventsIn(addOnCalendar(env).id)[0];
  assert.match(fajr.description, /Islamic Society of North America/);
});

test("turning a prayer off removes only its events, and Sunrise can be added", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  ui.change(settingsCard, "prayers", ["Fajr", "Sunrise", "Dhuhr", "Maghrib", "Isha"]);
  const result = ui.click(settingsCard, "Sync now");
  assert.equal(result.notification, "Calendar updated through 3 Dec: 30 added, 30 removed.");
  const events = env.appEventsIn(addOnCalendar(env).id);
  assert.equal(events.filter((e) => e.summary === "Asr").length, 0);
  assert.equal(events.filter((e) => e.summary === "Sunrise").length, 30);
  assert.equal(events.length, 150);
});

test("choosing no prayer is refused and keeps the old choice", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  const result = ui.change(settingsCard, "prayers", []);
  assert.equal(result.notification, "Choose at least one prayer to add to your calendar.");
  assert.deepEqual(settingsOf(env).prayers, ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
});

test("the user's own events are never touched, even with prayer names in the title", (t) => {
  const env = start(t);
  const own = env.addEvent(PRIMARY_ID, {
    summary: "Fajr Prayer at the mosque",
    start: { dateTime: "2026-11-05T04:00:00Z" },
    end: { dateTime: "2026-11-05T05:00:00Z" },
  });
  completeSetup(env, { calendar: PRIMARY_ID });
  const events = env.eventsIn(PRIMARY_ID);
  assert.deepEqual(events.find((e) => e.id === own.id), own);
  assert.equal(env.appEventsIn(PRIMARY_ID).length, 150, "the sync does not stop at the user's event");
  assert.equal(addOnCalendar(env), undefined, "no calendar is created when the main calendar is chosen");
});

test("version 1 settings, trigger and events are migrated", (t) => {
  const env = start(t);
  env.userProperties.setProperties({
    latitude: "47.4979",
    longitude: "19.0402",
    locationName: "Budapest, Hungary",
    calendarId: "primary",
    method: "2",
    reminderMinutes: "0",
    dailySyncHour: "0",
    eventDuration: "30",
    onboardingComplete: "true",
    lastSyncDate: "2026-11-04T00:00:00.000Z",
  });
  env.scriptProperties.setProperty("GEOAPIFY_API_KEY", "shared-secret");
  env.addLegacyTrigger();
  ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].forEach((name, i) => {
    env.addEvent(PRIMARY_ID, {
      summary: name + " Prayer",
      start: { dateTime: `2026-11-04T${String(4 + 3 * i).padStart(2, "0")}:00:00Z` },
      end: { dateTime: `2026-11-04T${String(4 + 3 * i).padStart(2, "0")}:30:00Z` },
      extendedProperties: { private: { prayerTimeEvent: "true", prayerName: name } },
    });
  });
  const yesterday = env.addEvent(PRIMARY_ID, {
    summary: "Isha Prayer",
    start: { dateTime: "2026-11-03T17:00:00Z" },
    end: { dateTime: "2026-11-03T17:30:00Z" },
    extendedProperties: { private: { prayerTimeEvent: "true", prayerName: "Isha" } },
  });

  const home = onHomepage({});
  assert.equal(home.name, "home", "migrated users skip setup");
  const settings = settingsOf(env);
  assert.equal(settings.method, 2);
  assert.equal(settings.reminderMinutes, 0, "a 0-minute reminder stays 0");
  assert.equal(settings.durationMinutes, 30);
  assert.equal(settings.calendar, "primary");
  assert.equal(settings.autoSync, true);
  assert.equal(settings.location.timezone, ZONE, "looked up from AlAdhan");
  assert.equal(env.userProperties.getProperty("latitude"), null);
  assert.equal(env.userProperties.getProperty("dailySyncHour"), null);
  assert.equal(env.scriptProperties.getProperty("GEOAPIFY_API_KEY"), null);
  assert.equal(env.triggers.length, 1);
  assert.deepEqual(env.triggers[0].spec, { hour: 3, everyDays: 1, timeZone: ZONE });

  syncPrayerTimes();
  const events = env.eventsIn(PRIMARY_ID);
  assert.equal(events.filter((e) => / Prayer$/.test(e.summary) && e.id !== yesterday.id).length, 0, "version 1 events in the window are replaced");
  assert.ok(events.some((e) => e.id === yesterday.id), "events before today are left alone");
  const fresh = env.appEventsIn(PRIMARY_ID).filter((e) => e.extendedProperties.private.prayerDate);
  assert.equal(fresh.length, 150);
  assert.ok(fresh.every((e) => e.reminders.overrides[0].minutes === 0));
  assert.ok(fresh.every((e) => Date.parse(e.end.dateTime) - Date.parse(e.start.dateTime) === 30 * 60000));
});

test("a migrated user who saves Settings keeps their events in the main calendar", (t) => {
  const env = start(t);
  env.userProperties.setProperties({
    latitude: "47.4979", longitude: "19.0402", locationName: "Budapest, Hungary", calendarId: "primary",
    method: "3", reminderMinutes: "15", eventDuration: "15", onboardingComplete: "true",
  });
  env.addLegacyTrigger();
  const home = onHomepage({});
  syncPrayerTimes();
  assert.equal(env.appEventsIn(PRIMARY_ID).length, 150);
  assert.deepEqual(stateOf(env).calendarIds, [PRIMARY_ID], "the real ID is stored, not the alias");

  // The calendar dropdown shows the main calendar by its real ID, so any save stores that ID.
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  assert.equal(ui.selectedValue(settingsCard, "calendar"), PRIMARY_ID);
  ui.change(settingsCard, "reminder", "10");
  assert.equal(settingsOf(env).calendar, PRIMARY_ID);
  const result = ui.click(settingsCard, "Sync now");
  assert.equal(result.notification, "Calendar updated through 3 Dec: 150 updated.");
  assert.equal(env.appEventsIn(PRIMARY_ID).length, 150);
  assert.equal(ui.click(ui.shownCard(ui.click(settingsCard, "Done")), "Sync now").notification, "Your calendar is up to date through 3 Dec.");
});

test("search results show city, region and country, and the country picks the method", (t) => {
  const env = start(t);
  const step1 = onHomepage({});
  const results = ui.shownCard(ui.click(step1, "Search", { locationQuery: "Springfield" }));
  assert.equal(results.name, "location");
  const rows = ui.widgetsOf(results).filter((w) => w.type === "DecoratedText" && w.props.button && w.props.button.props.text === "Select");
  assert.deepEqual(
    rows.map((w) => [w.props.text, w.props.bottomLabel]),
    [
      ["<b>Springfield</b>", "Illinois, United States"],
      ["<b>Springfield</b>", "Missouri, United States"],
      ["<b>Springfield</b>", "Massachusetts, United States"],
      ["<b>Springfield</b>", "Australia"],
    ]
  );
  const step2 = ui.shownCard(ui.click(results, "Select", null, 1));
  assert.equal(ui.selectedValue(step2, "method"), "2", "ISNA for the United States");
  assert.match(ui.cardText(step2), /Springfield, Missouri, United States/);
  assert.match(ui.cardText(step2), /Time zone: America\/Chicago/);
});

test("a search with a qualifier the geocoder does not know retries without it", (t) => {
  const env = start(t);
  const step1 = onHomepage({});
  const results = ui.shownCard(ui.click(step1, "Search", { locationQuery: "Springfield, IL" }));
  const searches = env.requests.filter((r) => r.url.includes("geocoding-api")).map((r) => new URL(r.url).searchParams.get("name"));
  assert.deepEqual(searches.slice(-2), ["Springfield, IL", "Springfield"]);
  assert.match(ui.cardText(results), /Illinois, United States/);
});

test("a search without results says so and keeps the query", (t) => {
  const env = start(t);
  const results = ui.shownCard(ui.click(onHomepage({}), "Search", { locationQuery: "Atlantis" }));
  const text = ui.cardText(results);
  assert.match(text, /No results/);
  assert.match(text, /No places found for Atlantis\./);
  assert.equal(ui.findInput(results, "locationQuery").props.value, "Atlantis");
  const short = ui.click(results, "Search", { locationQuery: "A" });
  assert.equal(short.notification, "Type at least 2 letters of your city's name.");
});

test("a busy geocoder gives a clear message after retrying", (t) => {
  const env = start(t);
  const step1 = onHomepage({});
  env.fail(/geocoding-api/, [{ code: 429 }, { code: 429 }, { code: 429 }]);
  const result = ui.click(step1, "Search", { locationQuery: "Springfield" });
  assert.equal(result.notification, "The location search (Open-Meteo) is busy right now. Try again in a minute.");
  assert.equal(env.sleptMs, 3500);
});

test("a failing suggestion does not block setup", (t) => {
  const env = start(t);
  env.fail(/geocoding-api/, [{ exception: "DNS error" }, { exception: "DNS error" }, { exception: "DNS error" }]);
  const card = onHomepage({});
  assert.equal(card.name, "location");
  assert.doesNotMatch(ui.cardText(card), /Suggested location/);
});

test("coordinates can be entered instead, and AlAdhan supplies the time zone", (t) => {
  const env = start(t);
  const step1 = onHomepage({});
  const coordinatesCard = ui.shownCard(ui.click(step1, "Enter coordinates"));
  assert.equal(coordinatesCard.name, "coordinates");
  const bad = ui.click(coordinatesCard, "Save", { coordinates: "somewhere" });
  assert.equal(bad.notification, "Enter the coordinates as latitude, longitude. For example: 47.4979, 19.0402");
  const saved = ui.click(coordinatesCard, "Save", { coordinates: "21.4225, 39.8262", placeName: "Makkah" });
  assert.deepEqual(saved.navigation.map((op) => op.op), ["popCard", "updateCard"]);
  assert.equal(ui.shownCard(saved).name, "preferences");
  assert.equal(saved.notification, "Location set to Makkah.");
  const location = settingsOf(env).location;
  assert.deepEqual([location.latitude, location.longitude, location.timezone], [21.4225, 39.8262, "Asia/Riyadh"]);
});

test("a long first sync stops in time and the next sync finishes it", (t) => {
  const env = start(t);
  env.latencyMs = 4000; // every parallel batch of Calendar requests takes 4 seconds
  const step2 = ui.shownCard(ui.click(onHomepage({}), "Use"));
  const startedAt = Date.now();
  const done = ui.click(step2, "Add to my calendar");
  assert.ok(Date.now() - startedAt < 30000, "the card action answers within 30 seconds");
  assert.equal(done.notification, "Added prayer times through 13 Nov. Some changes are not done yet. Select Sync now again to finish.");
  const calendar = addOnCalendar(env);
  assert.equal(env.appEventsIn(calendar.id).length, 50);
  const home = ui.shownCard(done);
  assert.match(ui.cardText(home), /through Friday 13 November/);
  assert.match(ui.cardText(home), /Last sync problem: The last sync did not finish\./);

  env.latencyMs = 0;
  const finished = ui.click(home, "Sync now");
  assert.equal(finished.notification, "Calendar updated through 3 Dec: 100 added.");
  assert.equal(env.appEventsIn(calendar.id).length, 150);
  assert.doesNotMatch(ui.cardText(ui.shownCard(finished)), /Last sync problem/);
});

test("rate-limited calendar writes are retried with backoff", (t) => {
  const env = start(t);
  const rateLimit = JSON.stringify({ error: { code: 403, message: "Rate Limit Exceeded", errors: [{ reason: "rateLimitExceeded" }] } });
  env.fail(/calendar\/v3\/calendars\/[^/]+\/events/, [{ code: 403, body: rateLimit }, { code: 429 }, { code: 503 }]);
  const { done } = completeSetup(env);
  assert.equal(done.notification, "Calendar updated through 3 Dec: 150 added.");
  assert.equal(env.appEventsIn(addOnCalendar(env).id).length, 150);
  assert.ok(env.sleptMs >= 1000);
});

test("Calendar's daily limit stops the sync with a clear message", (t) => {
  const env = start(t);
  const quota = JSON.stringify({ error: { code: 403, message: "Calendar usage limits exceeded.", errors: [{ reason: "quotaExceeded" }] } });
  env.fail(/calendar\/v3\/calendars\/[^/]+\/events/, [{ code: 403, body: quota }]);
  const { done } = completeSetup(env);
  assert.match(done.notification, /Some changes are not done yet/);
  assert.match(done.notification, /Google Calendar's limit for adding events was reached\. Try again in a few hours\./);
  assert.ok(env.appEventsIn(addOnCalendar(env).id).length < 150);
});

test("moving to another calendar moves the upcoming events, and Remove clears every calendar", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const prayerCalendar = addOnCalendar(env);
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  ui.change(settingsCard, "calendar", PRIMARY_ID);
  const moved = ui.click(settingsCard, "Sync now");
  assert.equal(moved.notification, "Calendar updated through 3 Dec: 150 added, 150 removed.");
  assert.equal(env.appEventsIn(PRIMARY_ID).length, 150);
  assert.equal(env.appEventsIn(prayerCalendar.id).length, 0);
  assert.deepEqual(stateOf(env).calendarIds, [PRIMARY_ID, prayerCalendar.id]);

  // An older event from an earlier sync, before today.
  env.addEvent(prayerCalendar.id, {
    summary: "Isha",
    start: { dateTime: "2026-10-01T17:00:00Z" },
    end: { dateTime: "2026-10-01T17:15:00Z" },
    extendedProperties: { private: { prayerTimeEvent: "true", prayerName: "Isha", prayerDate: "2026-10-01" } },
  });
  const own = env.addEvent(PRIMARY_ID, { summary: "Dentist", start: { dateTime: "2026-11-05T09:00:00Z" }, end: { dateTime: "2026-11-05T10:00:00Z" } });

  const confirm = ui.shownCard(ui.click(settingsCard, "Remove prayer events"));
  assert.equal(confirm.name, "confirmRemove");
  assert.match(ui.cardText(confirm), /from <b>Personal, Prayer Times<\/b>/);
  const removed = ui.click(confirm, "Remove events");
  assert.equal(removed.notification, "Removed 151 events. Automatic updates are off.");
  assert.deepEqual(removed.navigation.map((op) => op.op), ["popCard", "updateCard"]);
  assert.equal(env.appEventsIn(PRIMARY_ID).length, 0);
  assert.equal(env.appEventsIn(prayerCalendar.id).length, 0);
  assert.deepEqual(env.eventsIn(PRIMARY_ID), [own]);
  assert.equal(settingsOf(env).autoSync, false);
  assert.equal(env.triggers.length, 0);
});

test("an old calendar that cannot be read does not stop a sync or a removal", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const prayerCalendar = addOnCalendar(env);
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  ui.change(settingsCard, "calendar", PRIMARY_ID);
  ui.click(settingsCard, "Sync now");
  prayerCalendar.listError = "GoogleJsonResponseException: API call to calendar.events.list failed with error: Forbidden";

  assert.equal(ui.click(settingsCard, "Sync now").notification, "Your calendar is up to date through 3 Dec.");
  assert.deepEqual(stateOf(env).calendarIds, [PRIMARY_ID, prayerCalendar.id], "kept, to try again later");

  const confirm = ui.shownCard(ui.click(settingsCard, "Remove prayer events"));
  const removed = ui.click(confirm, "Remove events");
  assert.equal(removed.notification, "Removed 150 events. Automatic updates are off. Could not read the calendar Prayer Times.");
  assert.equal(env.appEventsIn(PRIMARY_ID).length, 0);
});

test("if the user deletes the Prayer Times calendar, the next sync makes a new one", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const first = addOnCalendar(env);
  env.calendars.delete(first.id);
  const result = ui.click(home, "Sync now");
  assert.equal(result.notification, "Calendar updated through 3 Dec: 150 added.");
  const second = addOnCalendar(env);
  assert.notEqual(second.id, first.id);
  assert.equal(settingsOf(env).dedicatedCalendarId, second.id);
  assert.equal(env.appEventsIn(second.id).length, 150);
});

test("a chosen calendar that was deleted gives a clear message", (t) => {
  const env = start(t);
  const { home } = completeSetup(env, { calendar: "family@group.calendar.google.com" });
  env.calendars.delete("family@group.calendar.google.com");
  assert.equal(ui.click(home, "Sync now").notification, "The calendar chosen in Settings no longer exists. Choose another one.");
});

test("reset clears the settings, keeps the events and starts setup again", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  const confirm = ui.shownCard(ui.click(settingsCard, "Reset add-on"));
  const reset = ui.click(confirm, "Reset");
  assert.equal(reset.notification, "Prayer Times was reset.");
  assert.deepEqual(reset.navigation.map((op) => op.op), ["popToRoot", "updateCard"]);
  assert.equal(ui.shownCard(reset).name, "location");
  assert.equal(env.userProperties.getProperty("settings.v2"), null);
  assert.equal(env.triggers.length, 0);
  assert.equal(env.appEventsIn(addOnCalendar(env).id).length, 150);
  assert.equal(onHomepage({}).name, "location");
});

test("the daily trigger keeps the window filled and records failures instead of throwing", (t) => {
  const env = start(t);
  completeSetup(env);
  const calendar = addOnCalendar(env);
  t.mock.timers.tick(24 * 60 * 60 * 1000); // the next day, 13:00
  syncPrayerTimes();
  const dates = env.appEventsIn(calendar.id).map((e) => e.extendedProperties.private.prayerDate);
  assert.ok(dates.includes("2026-12-04"), "one more day is added");
  assert.equal(dates.filter((d) => d === "2026-11-04").length, 5, "yesterday stays");
  assert.equal(stateOf(env).syncedThrough, "2026-12-04");

  env.clearCache();
  t.mock.timers.tick(31 * 24 * 60 * 60 * 1000); // a new month that is not cached
  env.fail(/api\.aladhan\.com/, [{ code: 500 }, { code: 500 }, { code: 500 }]);
  assert.doesNotThrow(() => syncPrayerTimes());
  assert.equal(stateOf(env).lastError, "The prayer times service (AlAdhan) is not available right now (HTTP 500). Try again later.");
  assert.match(ui.cardText(onHomepage({})), /Last sync problem: The prayer times service \(AlAdhan\)/);
});

test("the trigger does nothing and removes itself when automatic updates are off", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  ui.change(settingsCard, "autoSync", false);
  assert.equal(env.triggers.length, 0, "turning the switch off removes the trigger at once");
  env.addLegacyTrigger();
  const before = writes(env);
  syncPrayerTimes();
  assert.equal(writes(env), before);
  assert.equal(env.triggers.length, 0);
  ui.change(settingsCard, "autoSync", true);
  assert.equal(env.triggers.length, 1);
});

test("Ramadan adds Suhoor and Iftar, and the home card shows them", (t) => {
  const env = start(t, { now: Date.UTC(2027, 1, 10, 12, 0) });
  const { done, home } = completeSetup(env);
  // 10 Feb to 11 Mar 2027; Ramadan ends on 9 Mar in this data.
  assert.equal(done.notification, "Calendar updated through 11 Mar: 206 added.");
  const events = env.appEventsIn(addOnCalendar(env).id);
  assert.equal(events.filter((e) => e.summary === "Suhoor ends").length, 28);
  assert.equal(events.filter((e) => e.summary === "Iftar").length, 28);
  const text = ui.cardText(home);
  assert.match(text, /3 Ramadan 1448 AH\. Ramadan Mubarak\./);
  const labels = ui.widgetsOf(home).filter((w) => w.type === "DecoratedText").map((w) => w.props.topLabel);
  assert.ok(labels.includes("Suhoor ends") && labels.includes("Iftar"));
});

test("Jumu'ah at a fixed time, busy events, no reminder and Hanafi Asr reach the events", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  assert.equal(ui.change(settingsCard, "jumuahTime", "1:30 pm").notification, "Saved. Select Sync now to update your calendar.");
  ui.change(settingsCard, "showAsFree", false);
  ui.change(settingsCard, "reminder", "none");
  ui.change(settingsCard, "school", "1");
  assert.equal(ui.change(settingsCard, "offset_Fajr", "2.5").notification, "Fajr adjustment must be a whole number of minutes from -60 to 60.");
  ui.change(settingsCard, "offset_Fajr", "2");
  ui.click(settingsCard, "Sync now");

  const events = env.appEventsIn(addOnCalendar(env).id);
  const jumuah = events.find((e) => e.extendedProperties.private.prayerDate === "2026-11-06" && e.summary === "Jumu'ah");
  assert.equal(jumuah.start.dateTime, toRfc3339_(tz.localToEpoch("2026-11-06", 13 * 60 + 30, ZONE)));
  assert.ok(events.every((e) => e.transparency === "opaque"));
  assert.ok(events.every((e) => e.reminders.overrides.length === 0));
  const asr = events.find((e) => e.extendedProperties.private.prayerDate === "2026-11-04" && e.summary === "Asr");
  assert.equal(asr.start.dateTime, toRfc3339_(tz.localToEpoch("2026-11-04", 14 * 60 + 18 + 45, ZONE)), "the fake adds 45 minutes for Hanafi");
  const fajr = events.find((e) => e.extendedProperties.private.prayerDate === "2026-11-04" && e.summary === "Fajr");
  assert.equal(fajr.start.dateTime, toRfc3339_(tz.localToEpoch("2026-11-04", 5 * 60 + 12 + 2, ZONE)), "tune moves Fajr");
  const aladhanUrls = env.requests.filter((r) => r.url.includes("api.aladhan.com")).map((r) => r.url);
  assert.ok(aladhanUrls.some((url) => /school=1/.test(url) && /tune=2%2C2%2C/.test(url)));
});

test("a second sync running at the same time is refused", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  env.lockBusy = true;
  assert.equal(ui.click(home, "Sync now").notification, "Prayer Times is already updating your calendar. Try again in a minute.");
});

test("events are found across pages of results", (t) => {
  const env = start(t);
  env.pageSize = 7;
  const { home } = completeSetup(env);
  assert.equal(ui.click(home, "Sync now").notification, "Your calendar is up to date through 3 Dec.");
});

test("if AlAdhan is down the home card still opens and offers to try again", (t) => {
  const env = start(t);
  completeSetup(env);
  env.clearCache();
  env.fail(/api\.aladhan\.com/, [{ code: 503 }, { code: 503 }, { code: 503 }]);
  const home = onHomepage({});
  assert.equal(home.name, "home");
  assert.match(ui.cardText(home), /not available right now \(HTTP 503\)/);
  const retry = ui.click(home, "Try again");
  assert.match(ui.cardText(ui.shownCard(retry)), /Next prayer/);
});

test("changing the location from Settings returns to Settings", (t) => {
  const env = start(t);
  const { home } = completeSetup(env);
  const settingsCard = ui.shownCard(ui.click(home, "Settings"));
  const search = ui.shownCard(ui.click(settingsCard, "Change"));
  assert.equal(search.title, "Change location");
  const results = ui.shownCard(ui.click(search, "Search", { locationQuery: "Springfield" }));
  const picked = ui.click(results, "Select", null, 2);
  assert.deepEqual(picked.navigation.map((op) => op.op), ["popCard", "updateCard"]);
  assert.equal(ui.shownCard(picked).name, "settings");
  assert.equal(settingsOf(env).location.region, "Massachusetts");
  assert.equal(settingsOf(env).method, 2, "the method follows the new country");
  assert.equal(env.triggers[0].spec.timeZone, "America/New_York", "the trigger follows the new time zone");
  assert.equal(stateOf(env).pendingChanges, true);
  assert.equal(ui.click(search, "Cancel").navigation[0].op, "popCard");
});
