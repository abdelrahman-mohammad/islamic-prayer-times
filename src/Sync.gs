/**
 * Sync.gs: makes the calendar match the settings, removes the add-on's
 * events, and manages the daily automatic sync.
 *
 * A sync looks at today and the following days (30 by default), compares the
 * events that should exist with the add-on's events that do exist, and only
 * changes the difference. Events are matched by their private extended
 * properties, never by title, so the user's own events are never touched.
 */

/** Card actions must answer within 30 seconds. */
const CARD_TIME_BUDGET_MS_ = 22 * 1000;
/** A time-driven trigger may run for up to 6 minutes. */
const TRIGGER_TIME_BUDGET_MS_ = 4 * 60 * 1000;
const SYNC_HANDLER_ = "syncPrayerTimes";

function withUserLock_(work) {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(3000)) throw userError_("Prayer Times is already updating your calendar. Try again in a minute.");
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}

/** Runs one sync and returns its summary (see summarizeSync_) plus errors. */
function syncCalendar_(budgetMs) {
  const deadline = Date.now() + budgetMs;
  return withUserLock_(() => {
    let settings = loadSettings_();
    if (!settings.location) throw userError_("Choose your location first.");
    settings = ensureLocationTimeZone_(settings);
    // The settings the events are built from. A change saved after this is still pending at the end.
    const used = settings;
    const zone = settings.location.timezone;
    const prefs = getCalendarPrefs_();
    const window = syncWindow_(todayInZone_(zone), settings.daysAhead);
    const days = loadPrayerDays_(settings, window.start, window.end);
    const desired = buildDesiredEvents_(days, settings, { window: window, use24h: prefs.use24h });

    const dedicated = settings.calendar === DEDICATED_CALENDAR_;
    let calendarId = canonicalCalendarId_(dedicated ? ensureDedicatedCalendar_(settings) : settings.calendar);
    // List from a day early: after a move west, today's events made for the old
    // place can end before midnight here. planSync_ leaves older events alone.
    window.startMs = localToEpoch_(window.start, 0, zone);
    const timeMin = toRfc3339_(localToEpoch_(addDays_(window.start, -1), 0, zone));
    let existing = listAddOnEvents_(calendarId, timeMin);
    if (existing === null && dedicated) {
      console.log("The Prayer Times calendar was deleted; creating a new one.");
      calendarId = createDedicatedCalendar_(settings);
      existing = [];
    }
    if (existing === null) throw userError_("The calendar chosen in Settings no longer exists. Choose another one.");
    const current = loadSettings_();

    // Calendars used before: their upcoming events move to the current calendar.
    const known = uniqueCalendarIds_(loadState_().calendarIds).filter((id) => id !== calendarId);
    const others = [];
    const stillThere = [calendarId];
    known.forEach((id) => {
      const events = listEventsOrSkip_(id, timeMin);
      if (events === undefined) stillThere.push(id); // could not be read now; try again next time
      else if (events !== null) {
        others.push({ calendarId: id, events: events });
        stillThere.push(id);
      }
    });

    const ops = planSync_(desired, existing, others, window, calendarId);
    const run = runCalendarOps_(ops, deadline);
    const summary = summarizeSync_(ops, run.statuses, window);
    saveState_(Object.assign(loadState_(), {
      lastSyncAt: new Date().toISOString(),
      syncedThrough: summary.syncedThrough || "",
      calendarId: calendarId,
      calendarName: calendarDisplayName_(calendarId, current),
      calendarIds: stillThere,
      // A setting changed while this sync ran is not in the calendar yet.
      pendingChanges: settingsAffectEvents_(used, loadSettings_()),
      lastError: run.errors.length ? run.errors[0] : summary.complete ? "" : "The last sync did not finish.",
    }));
    return Object.assign({ errors: run.errors }, summary);
  });
}

/**
 * Lists the add-on's events in a calendar other than the current one.
 * Returns null if the calendar is gone, and undefined if it cannot be read
 * now (for example, access was removed), so one old calendar cannot stop a sync.
 */
function listEventsOrSkip_(calendarId, timeMin) {
  try {
    return listAddOnEvents_(calendarId, timeMin);
  } catch (err) {
    console.warn("Skipping calendar " + calendarId + ": " + err);
    return undefined;
  }
}

/** Deletes every event the add-on created, in every calendar it used, and turns off the daily sync. */
function removeAllEvents_(budgetMs) {
  const deadline = Date.now() + budgetMs;
  return withUserLock_(() => {
    const settings = loadSettings_();
    const state = loadState_();
    const ids = uniqueCalendarIds_(
      state.calendarIds.concat([settings.calendar, settings.dedicatedCalendarId]).filter((id) => id !== DEDICATED_CALENDAR_)
    );

    const calendars = [];
    const errors = [];
    ids.forEach((id) => {
      const events = listEventsOrSkip_(id, null);
      if (events === undefined) errors.push("Could not read the calendar " + calendarDisplayName_(id, settings) + ".");
      else if (events !== null) calendars.push({ calendarId: id, events: events });
    });
    const ops = planRemoval_(calendars);
    const run = runCalendarOps_(ops, deadline);
    const removed = run.statuses.filter((status) => status === "done").length;
    const allErrors = errors.concat(run.errors);

    settings.autoSync = false;
    saveSettings_(settings);
    removeSyncTrigger_();
    saveState_(Object.assign(loadState_(), {
      syncedThrough: "",
      pendingChanges: false,
      lastError: allErrors.length ? allErrors[0] : "",
    }));
    return { removed: removed, remaining: ops.length - removed, errors: allErrors };
  });
}

function syncTriggers_() {
  return ScriptApp.getProjectTriggers().filter((trigger) => trigger.getHandlerFunction() === SYNC_HANDLER_);
}

function hasSyncTrigger_() {
  try {
    return syncTriggers_().length > 0;
  } catch (err) {
    console.warn("Could not read triggers: " + err);
    return false;
  }
}

function removeSyncTrigger_() {
  syncTriggers_().forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  updateState_({ triggerTimeZone: "" });
}

/**
 * Keeps exactly one daily trigger while automatic sync is on, running at
 * 3 AM in the location's time zone. Add-ons may run time-driven triggers at
 * most once an hour.
 */
function updateSyncTrigger_(settings) {
  const wanted = settings.autoSync && settings.setupComplete && settings.location;
  const triggers = syncTriggers_();
  if (!wanted) {
    if (triggers.length) removeSyncTrigger_();
    return;
  }
  // Without the location's time zone the hour would be wrong; keep what exists until it is known.
  const zone = settings.location.timezone;
  if (!zone) return;
  if (triggers.length === 1 && loadState_().triggerTimeZone === zone) return;
  triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger(SYNC_HANDLER_).timeBased().atHour(APP_.syncHour).everyDays(1).inTimezone(zone).create();
  updateState_({ triggerTimeZone: zone });
}
