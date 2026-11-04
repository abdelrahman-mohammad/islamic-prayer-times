/**
 * Code.gs: entry points.
 *
 *   onHomepage        the add-on's homepage trigger (appsscript.json)
 *   syncPrayerTimes   the daily time-driven trigger; version 1 used the same name
 *   on...             card actions named in Cards.gs
 *
 * Card actions load data, call Settings.gs and Sync.gs, and choose the card to
 * show. Any error ends as a notification instead of a broken card.
 */

function onHomepage(e) {
  try {
    const settings = loadSettings_();
    if (!settings.setupComplete) return firstSetupCard_(settings);
    // The model looks up a missing time zone, which the trigger needs.
    const model = homeModel_(settings);
    try {
      updateSyncTrigger_(model.settings);
    } catch (err) {
      console.warn("Could not check the daily trigger: " + err);
    }
    return buildHomeCard_(model);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return buildErrorCard_(errorMessage_(err));
  }
}

/** The daily automatic sync. Errors are recorded for the home card instead of thrown. */
function syncPrayerTimes() {
  const settings = loadSettings_();
  if (!settings.setupComplete || !settings.location || !settings.autoSync) {
    console.log("Automatic sync skipped: setup is not finished or automatic updates are off.");
    removeSyncTrigger_();
    return;
  }
  try {
    console.log("Automatic sync: " + syncMessage_(syncCalendar_(TRIGGER_TIME_BUDGET_MS_)));
    // Moves a version 1 trigger, or one in an old time zone, to 3 AM local time.
    updateSyncTrigger_(loadSettings_());
  } catch (err) {
    console.error("Automatic sync failed: " + (err && err.stack ? err.stack : err));
    try {
      updateState_({ lastError: errorMessage_(err) });
    } catch (ignored) {
      // The error is already in the execution log.
    }
  }
}

// ---------------------------------------------------------------------------
// Setup and location
// ---------------------------------------------------------------------------

function onSearchLocation(e) {
  return handleAction_(() => {
    const mode = param_(e, "mode") || "setup";
    const query = firstValue_(e, FIELD_.locationQuery).trim();
    const places = searchPlaces_(query);
    const card = buildLocationCard_(locationModel_(mode, { query: query, places: places }));
    return respond_(CardService.newNavigation().updateCard(card));
  });
}

function onSelectPlace(e) {
  return handleAction_(() => {
    let place;
    try {
      place = JSON.parse(param_(e, "place"));
    } catch (err) {
      throw userError_("That place could not be read. Search again.");
    }
    return applyLocation_(param_(e, "mode"), placeToLocation_(place), false);
  });
}

function onShowCoordinates(e) {
  return handleAction_(() =>
    respond_(CardService.newNavigation().pushCard(buildCoordinatesCard_(param_(e, "mode") || "setup")))
  );
}

function onSaveCoordinates(e) {
  return handleAction_(() => {
    const coordinates = parseCoordinates_(firstValue_(e, FIELD_.coordinates));
    if (!coordinates) return notify_("Enter the coordinates as latitude, longitude. For example: 47.4979, 19.0402");
    const name = firstValue_(e, FIELD_.placeName).trim().slice(0, 60);
    const location = { name: name, latitude: coordinates.latitude, longitude: coordinates.longitude, timezone: "" };
    location.timezone = lookUpTimeZone_(location, loadSettings_());
    return applyLocation_(param_(e, "mode"), location, true);
  });
}

/** Saves a new location and shows the next card. `pushed` is true when a card sits on top. */
function applyLocation_(mode, location, pushed) {
  const before = loadSettings_();
  const after = saveSettings_(withLocation_(before, location));
  if (!after.location) throw userError_("That location is not valid. Search again.");
  if (after.setupComplete && settingsAffectEvents_(before, after)) {
    updateState_({ pendingChanges: true });
    updateSyncTrigger_(after);
  }
  const message = "Location set to " + formatPlaceName_(after.location) + ".";
  const navigation = CardService.newNavigation();
  if (mode === "setup") {
    if (pushed) navigation.popCard();
    return respond_(navigation.updateCard(buildPreferencesCard_(settingsModel_(after))), message);
  }
  // From Settings the location card is pushed on top of the settings card.
  navigation.popCard();
  if (pushed) navigation.popCard();
  return respond_(navigation.updateCard(buildSettingsCard_(settingsModel_(after))), message);
}

function onBackToLocation(e) {
  return handleAction_(() =>
    respond_(CardService.newNavigation().updateCard(buildLocationCard_(locationModel_("setup"))))
  );
}

/** Setup step 1, "Keep": goes on to step 2 with the location already chosen. */
function onKeepLocation(e) {
  return handleAction_(() =>
    respond_(CardService.newNavigation().updateCard(buildPreferencesCard_(settingsModel_(loadSettings_()))))
  );
}

function onFinishSetup(e) {
  return handleAction_(() => {
    const saved = saveForm_(e);
    if (saved.errors.length) return notify_(saved.errors[0]);
    if (!saved.settings.location) return notify_("Choose your location first.");
    const settings = saveSettings_(Object.assign({}, saved.settings, { setupComplete: true }));
    let message;
    try {
      const summary = syncCalendar_(CARD_TIME_BUDGET_MS_);
      message = syncMessage_(summary) + (summary.errors.length ? " " + summary.errors[0] : "");
    } catch (err) {
      console.error(err && err.stack ? err.stack : err);
      message = "Your settings are saved, but the calendar was not updated. " + errorMessage_(err);
      updateState_({ lastError: errorMessage_(err) });
    }
    try {
      // The sync may have looked up the time zone, which the trigger needs.
      updateSyncTrigger_(loadSettings_());
    } catch (err) {
      console.warn("Could not create the daily trigger: " + err);
    }
    return respond_(CardService.newNavigation().updateCard(buildHomeCard_(homeModel_(loadSettings_()))), message);
  });
}

// ---------------------------------------------------------------------------
// Home and settings
// ---------------------------------------------------------------------------

function onRefreshHome(e) {
  return handleAction_(() => {
    const settings = loadSettings_();
    const card = settings.setupComplete ? buildHomeCard_(homeModel_(settings)) : firstSetupCard_(settings);
    return respond_(CardService.newNavigation().updateCard(card));
  });
}

function onSyncNow(e) {
  return handleAction_(() => {
    const saved = saveForm_(e);
    if (saved.errors.length) return notify_(saved.errors[0]);
    const summary = syncCalendar_(CARD_TIME_BUDGET_MS_);
    const message = syncMessage_(summary) + (summary.errors.length ? " " + summary.errors[0] : "");
    if (param_(e, "view") === "settings") return notify_(message);
    return respond_(CardService.newNavigation().updateCard(buildHomeCard_(homeModel_(loadSettings_()))), message);
  });
}

function onOpenSettings(e) {
  return handleAction_(() =>
    respond_(CardService.newNavigation().updateCard(buildSettingsCard_(settingsModel_(loadSettings_()))))
  );
}

function onCloseSettings(e) {
  return handleAction_(() => {
    const saved = saveForm_(e);
    if (saved.errors.length) return notify_(saved.errors[0]);
    return respond_(CardService.newNavigation().updateCard(buildHomeCard_(homeModel_(saved.settings))));
  });
}

/** Every settings input runs this on change, so settings save without a Save button. */
function onSettingChange(e) {
  return handleAction_(() => {
    const saved = saveForm_(e);
    if (saved.errors.length) return notify_(saved.errors[0]);
    if (saved.mosqueOffsets.length) {
      // Show the new adjustment in its box.
      const card = buildSettingsCard_(settingsModel_(saved.settings));
      return respond_(CardService.newNavigation().updateCard(card), saved.mosqueOffsets.join(" ") + " Select Sync now to update your calendar.");
    }
    return notify_(saved.settings.setupComplete && saved.affectsEvents ? "Saved. Select Sync now to update your calendar." : "Saved.");
  });
}

function onOpenLocationSearch(e) {
  return handleAction_(() =>
    respond_(CardService.newNavigation().pushCard(buildLocationCard_(locationModel_("settings"))))
  );
}

function onCancel(e) {
  return handleAction_(() => respond_(CardService.newNavigation().popCard()));
}

function onConfirmRemoveEvents(e) {
  return handleAction_(() => {
    const settings = loadSettings_();
    const state = loadState_();
    const names = [];
    state.calendarIds.forEach((id) => {
      const name = calendarDisplayName_(id, settings);
      if (names.indexOf(name) === -1) names.push(name);
    });
    return respond_(CardService.newNavigation().pushCard(buildConfirmRemoveCard_({ calendarNames: names })));
  });
}

function onRemoveEvents(e) {
  return handleAction_(() => {
    const result = removeAllEvents_(CARD_TIME_BUDGET_MS_);
    let message = result.removed === 1 ? "Removed 1 event." : "Removed " + result.removed + " events.";
    if (result.remaining) message += " " + result.remaining + " are left. Select Remove prayer events again to finish.";
    else message += " Automatic updates are off.";
    if (result.errors.length) message += " " + result.errors[0];
    const card = buildSettingsCard_(settingsModel_(loadSettings_()));
    return respond_(CardService.newNavigation().popCard().updateCard(card), message);
  });
}

function onConfirmReset(e) {
  return handleAction_(() => respond_(CardService.newNavigation().pushCard(buildConfirmResetCard_())));
}

function onResetAddOn(e) {
  return handleAction_(() => {
    resetAddOn_();
    const card = buildLocationCard_(locationModel_("setup"));
    return respond_(CardService.newNavigation().popToRoot().updateCard(card), "Prayer Times was reset.");
  });
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

function firstSetupCard_(settings) {
  if (settings.location) return buildPreferencesCard_(settingsModel_(settings));
  return buildLocationCard_(locationModel_("setup"));
}

function locationModel_(mode, extra) {
  const model = Object.assign(
    { mode: mode, current: null, suggestion: null, calendarTimeZone: "", query: "", places: null },
    extra || {}
  );
  if (mode === "setup") model.current = loadSettings_().location;
  if (mode === "setup" && !model.places && !model.current) {
    const prefs = getCalendarPrefs_();
    model.calendarTimeZone = prefs.timeZone;
    model.suggestion = prefs.timeZone ? suggestPlaceForTimeZone_(prefs.timeZone) : null;
  }
  return model;
}

function homeModel_(settings) {
  const model = {
    settings: settings,
    state: loadState_(),
    prefs: getCalendarPrefs_(),
    nowMs: Date.now(),
    today: "",
    days: [],
    nextDays: [],
    error: "",
  };
  try {
    model.settings = ensureLocationTimeZone_(settings);
    model.today = todayInZone_(model.settings.location.timezone);
    // Yesterday too: its Isha can fall after midnight, before today's Fajr.
    const days = loadPrayerDays_(model.settings, addDays_(model.today, -1), addDays_(model.today, 1));
    model.nextDays = days;
    model.days = days.slice(1);
  } catch (err) {
    console.warn("Could not load today's prayer times: " + err);
    model.error = errorMessage_(err);
  }
  return model;
}

function settingsModel_(settings) {
  const model = { settings: settings, state: loadState_(), calendars: [], rawToday: null, use24h: true };
  try {
    model.calendars = listOwnedCalendars_();
  } catch (err) {
    console.warn("Could not list calendars: " + err);
  }
  try {
    model.use24h = getCalendarPrefs_().use24h;
    model.rawToday = rawToday_(settings);
  } catch (err) {
    console.warn("Could not load today's calculated times: " + err);
  }
  return model;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Saves the form values the card sent. The card lists its fields in the
 * "fields" action parameter, so unchecked switches and empty checkbox groups
 * are saved as off and empty.
 */
function saveForm_(e) {
  const fields = String(param_(e, "fields") || "").split(",").filter(Boolean);
  const before = loadSettings_();
  if (!fields.length) return { settings: before, errors: [], affectsEvents: false, mosqueOffsets: [] };
  const values = readFormInputs_(e);
  const mosque = mosqueTimesToOffsets_(before, values, fields);
  if (mosque.errors.length) return { settings: before, errors: mosque.errors, affectsEvents: false, mosqueOffsets: [] };
  const result = applyFormToSettings_(before, values, fields);
  const chosen = result.settings.calendar;
  if (chosen !== before.calendar && canonicalCalendarId_(chosen) === canonicalCalendarId_(before.calendar)) {
    // "primary" and the main calendar's ID are the same calendar.
    result.settings.calendar = before.calendar;
  }
  const after = saveSettings_(result.settings);
  const affectsEvents = settingsAffectEvents_(before, after);
  if (after.setupComplete && affectsEvents) updateState_({ pendingChanges: true });
  if (after.setupComplete && before.autoSync !== after.autoSync) updateSyncTrigger_(after);
  return { settings: after, errors: result.errors, affectsEvents: affectsEvents, mosqueOffsets: mosque.messages };
}

/** Today's times at the location before the user's minute adjustments. */
function rawToday_(settings) {
  if (!settings.location || !settings.location.timezone) return null;
  const today = todayInZone_(settings.location.timezone);
  return loadPrayerDays_(Object.assign({}, settings, { offsets: {} }), today, today)[0];
}

/**
 * Turns "mosque time today" inputs into minute adjustments: each filled
 * mosque_<prayer> value becomes the offset_<prayer> value. Changes values and
 * fields in place. Returns {errors, messages}.
 */
function mosqueTimesToOffsets_(settings, values, fields) {
  const result = { errors: [], messages: [] };
  const filled = DAILY_EVENTS_.filter((name) => {
    const v = values[MOSQUE_FIELD_PREFIX_ + name];
    return fields.indexOf(MOSQUE_FIELD_PREFIX_ + name) !== -1 && v && String(v[0]).trim();
  });
  if (!filled.length) return result;
  const today = rawToday_(settings);
  if (!today) {
    result.errors.push("Today's calculated times are not available yet. Select Sync now, then try again.");
    return result;
  }
  filled.forEach((name) => {
    const offset = offsetFromMosqueTime_(name, today.times[name].minutes, values[MOSQUE_FIELD_PREFIX_ + name][0]);
    if (offset.error) return result.errors.push(offset.error);
    values[OFFSET_FIELD_PREFIX_ + name] = [String(offset.minutes)];
    if (fields.indexOf(OFFSET_FIELD_PREFIX_ + name) === -1) fields.push(OFFSET_FIELD_PREFIX_ + name);
    result.messages.push(name + " adjustment set to " + formatOffset_(offset.minutes) + ".");
  });
  return result;
}

function handleAction_(work) {
  try {
    return work();
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return notify_(errorMessage_(err));
  }
}

function param_(e, name) {
  const parameters = (e && e.commonEventObject && e.commonEventObject.parameters) || (e && e.parameters) || {};
  return parameters[name];
}

function firstValue_(e, field) {
  const values = readFormInputs_(e)[field];
  return values && values.length ? String(values[0]) : "";
}

function notify_(message) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(message))
    .build();
}

function respond_(navigation, message) {
  const builder = CardService.newActionResponseBuilder().setNavigation(navigation);
  if (message) builder.setNotification(CardService.newNotification().setText(message));
  return builder.build();
}
