/**
 * Settings.gs: storage for the user's settings and sync state.
 *
 * Everything lives in User Properties, which belong to the signed-in user.
 * One user's settings can never change another user's. Version 1 of the
 * add-on kept a Geoapify API key in Script Properties, which every user shares;
 * that key is no longer used and is deleted on migration.
 */

function loadSettings_() {
  const props = PropertiesService.getUserProperties();
  const raw = props.getProperty(APP_.settingsKey);
  if (raw) {
    try {
      return normalizeSettings_(JSON.parse(raw));
    } catch (err) {
      console.warn("Stored settings could not be read, using defaults: " + err);
      return defaultSettings_();
    }
  }
  return migrateFromVersion1_(props);
}

function saveSettings_(settings) {
  const normalized = normalizeSettings_(settings);
  PropertiesService.getUserProperties().setProperty(APP_.settingsKey, JSON.stringify(normalized));
  return normalized;
}

/** Moves version 1 settings (one property per value) to the version 2 format. */
function migrateFromVersion1_(props) {
  const migrated = migrateLegacySettings_(props.getProperties(), hasSyncTrigger_());
  if (!migrated) return defaultSettings_();
  saveSettings_(migrated);
  LEGACY_KEYS_.forEach((key) => props.deleteProperty(key));
  removeSharedApiKey_();
  return migrated;
}

/** Deletes the Geoapify key that version 1 stored for all users. */
function removeSharedApiKey_() {
  try {
    PropertiesService.getScriptProperties().deleteProperty("GEOAPIFY_API_KEY");
  } catch (err) {
    console.warn("Could not delete the old GEOAPIFY_API_KEY script property: " + err);
  }
}

function defaultState_() {
  return {
    lastSyncAt: "",
    syncedThrough: "",
    calendarId: "",
    calendarName: "",
    // Every calendar the add-on has written to, so its events can be removed later.
    calendarIds: [],
    pendingChanges: false,
    lastError: "",
    triggerTimeZone: "",
  };
}

function loadState_() {
  const raw = PropertiesService.getUserProperties().getProperty(APP_.stateKey);
  const state = defaultState_();
  if (!raw) return state;
  try {
    const stored = JSON.parse(raw);
    Object.keys(state).forEach((key) => {
      if (stored[key] !== undefined && stored[key] !== null) state[key] = stored[key];
    });
    if (!Array.isArray(state.calendarIds)) state.calendarIds = [];
  } catch (err) {
    console.warn("Stored sync state could not be read: " + err);
  }
  return state;
}

function saveState_(state) {
  PropertiesService.getUserProperties().setProperty(APP_.stateKey, JSON.stringify(state));
  return state;
}

function updateState_(changes) {
  return saveState_(Object.assign(loadState_(), changes));
}

/** Clears settings and state and stops the daily sync. Calendar events are kept. */
function resetAddOn_() {
  removeSyncTrigger_();
  const props = PropertiesService.getUserProperties();
  props.deleteProperty(APP_.settingsKey);
  props.deleteProperty(APP_.stateKey);
  LEGACY_KEYS_.forEach((key) => props.deleteProperty(key));
  try {
    CacheService.getUserCache().remove(CALENDAR_PREFS_CACHE_KEY_);
  } catch (err) {
    console.warn("Could not clear the cache: " + err);
  }
}
