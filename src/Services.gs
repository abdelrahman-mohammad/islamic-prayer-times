/**
 * Services.gs: calls to the AlAdhan and Open-Meteo APIs and to Google Calendar.
 *
 * Both outside APIs are free and need no key. They limit requests per IP
 * address, and Apps Script shares its IP addresses with many other scripts,
 * so every call retries briefly on HTTP 429 and server errors, and results
 * are cached per user for six hours (the CacheService maximum).
 */

const HTTP_RETRY_DELAYS_MS_ = [1000, 2500];
const CACHE_SECONDS_ = 6 * 60 * 60;
const CALENDAR_PREFS_CACHE_KEY_ = "calendarPrefs.v1";
const CALENDAR_BATCH_SIZE_ = 10;
const CALENDAR_MAX_ATTEMPTS_ = 4;

// ---------------------------------------------------------------------------
// HTTP and cache
// ---------------------------------------------------------------------------

/**
 * GETs a URL and parses the JSON body. Retries on network errors, HTTP 429
 * and 5xx. Other HTTP errors return their JSON body, because both APIs
 * describe errors in it.
 */
function fetchJson_(url, serviceName) {
  let lastError = null;
  for (let attempt = 0; attempt <= HTTP_RETRY_DELAYS_MS_.length; attempt++) {
    if (attempt > 0) Utilities.sleep(HTTP_RETRY_DELAYS_MS_[attempt - 1]);
    let response;
    try {
      response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Accept: "application/json" } });
    } catch (err) {
      lastError = userError_(serviceName + " could not be reached. Check your connection and try again.");
      console.warn(serviceName + " fetch failed: " + err);
      continue;
    }
    const code = response.getResponseCode();
    if (code === 429) {
      lastError = userError_(serviceName + " is busy right now. Try again in a minute.");
      continue;
    }
    if (code >= 500) {
      lastError = userError_(serviceName + " is not available right now (HTTP " + code + "). Try again later.");
      continue;
    }
    try {
      return JSON.parse(response.getContentText());
    } catch (err) {
      throw userError_(serviceName + " sent an unreadable response (HTTP " + code + "). Try again later.");
    }
  }
  throw lastError;
}

/**
 * Returns a cached value, or produces and caches it. `check` is stored with
 * the value and compared on read, so a hash collision in the key cannot
 * return the wrong data.
 */
function cached_(key, check, produce) {
  const cache = CacheService.getUserCache();
  const hit = cache.get(key);
  if (hit) {
    try {
      const entry = JSON.parse(hit);
      if (entry && entry.check === check) return entry.value;
    } catch (err) {
      console.warn("Ignoring unreadable cache entry " + key);
    }
  }
  const value = produce();
  try {
    cache.put(key, JSON.stringify({ check: check, value: value }), CACHE_SECONDS_);
  } catch (err) {
    console.warn("Could not cache " + key + ": " + err);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Open-Meteo geocoding
// ---------------------------------------------------------------------------

function searchPlaces_(query) {
  const text = String(query || "").trim();
  if (text.length < 2) throw userError_("Type at least 2 letters of your city's name.");
  let places = geocode_(text);
  const fallback = fallbackQuery_(text);
  if (!places.length && fallback) places = geocode_(fallback);
  return places;
}

function geocode_(text) {
  const url = buildGeocodeUrl_(text, 10);
  return cached_("geo:" + hashString_(url), url, () =>
    parseGeocodeResults_(fetchJson_(url, "The location search (Open-Meteo)"))
  );
}

/** A place in the calendar's time zone, or null. Never throws: it is only a suggestion. */
function suggestPlaceForTimeZone_(timeZone) {
  const city = timeZoneCityName_(timeZone);
  if (!city) return null;
  try {
    return pickPlaceForTimeZone_(geocode_(city), timeZone);
  } catch (err) {
    console.warn("No location suggestion for " + timeZone + ": " + err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// AlAdhan prayer times
// ---------------------------------------------------------------------------

/** Converts a local wall time at the location to an instant. */
function localToEpoch_(dateText, minutes, timeZone) {
  return Utilities.parseDate(localDateTimeText_(dateText, minutes), timeZone, "yyyy-MM-dd HH:mm").getTime();
}

function todayInZone_(timeZone) {
  return Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd");
}

function fetchPrayerMonth_(year, month, settings) {
  const url = buildAladhanMonthUrl_(year, month, settings.location, settings);
  return cached_("aladhan:" + hashString_(url), url, () =>
    parseAladhanCalendar_(fetchJson_(url, "The prayer times service (AlAdhan)"), localToEpoch_)
  );
}

/**
 * Prayer days from start to end, inclusive, with the Hijri adjustment applied.
 * Throws if AlAdhan left out a day, so a sync never deletes events because of
 * missing data.
 */
function loadPrayerDays_(settings, startDate, endDate) {
  let days = [];
  monthsForRange_(startDate, endDate, settings.hijriAdjustment).forEach((m) => {
    days = days.concat(fetchPrayerMonth_(m.year, m.month, settings));
  });
  days = applyOffsets_(applyHijriAdjustment_(days, settings.hijriAdjustment), settings.offsets);
  const missing = missingDates_(days, datesBetween_(startDate, endDate));
  if (missing.length) {
    throw userError_("AlAdhan did not return prayer times for " + missing.join(", ") + ". Try again later.");
  }
  return days.filter((day) => day.date >= startDate && day.date <= endDate);
}

/**
 * Asks AlAdhan for the time zone of coordinates. It works the time zone out
 * when none is given and reports it in meta.timezone.
 */
function lookUpTimeZone_(location, settings) {
  const now = new Date();
  const url = buildAladhanMonthUrl_(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    Object.assign({}, location, { timezone: "" }),
    settings
  );
  return parseAladhanTimeZone_(fetchJson_(url, "The prayer times service (AlAdhan)"));
}

/** Fills in the location's time zone if it is missing (version 1 data and coordinates). */
function ensureLocationTimeZone_(settings) {
  if (!settings.location || settings.location.timezone) return settings;
  const zone = lookUpTimeZone_(settings.location, settings);
  const latest = loadSettings_();
  if (!latest.location) return settings;
  latest.location.timezone = zone;
  return saveSettings_(latest);
}

// ---------------------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------------------

/** The user's calendar time zone and clock format. Never throws. */
function getCalendarPrefs_() {
  return cached_(CALENDAR_PREFS_CACHE_KEY_, "v1", () => {
    const prefs = { timeZone: "", use24h: true };
    try {
      prefs.timeZone = String(Calendar.Settings.get("timezone").value || "");
    } catch (err) {
      console.warn("Could not read the calendar time zone: " + err);
    }
    try {
      prefs.use24h = String(Calendar.Settings.get("format24HourTime").value) !== "false";
    } catch (err) {
      console.warn("Could not read the calendar clock format: " + err);
    }
    return prefs;
  });
}

/** Calendars the user owns, which are the ones the add-on may write to. */
function listOwnedCalendars_() {
  const calendars = [];
  let pageToken = null;
  do {
    const options = { minAccessRole: "owner", maxResults: 250 };
    if (pageToken) options.pageToken = pageToken;
    const page = Calendar.CalendarList.list(options);
    (page.items || []).forEach((item) => {
      calendars.push({
        id: item.id,
        name: item.summaryOverride || item.summary || item.id,
        primary: item.primary === true,
      });
    });
    pageToken = page.nextPageToken || null;
  } while (pageToken);
  return calendars;
}

/**
 * The real ID of a calendar. "primary" is another name for the user's main
 * calendar; comparing it with the real ID would make one calendar look like two.
 */
function canonicalCalendarId_(calendarId) {
  if (calendarId !== "primary") return calendarId;
  try {
    return Calendar.CalendarList.get("primary").id || calendarId;
  } catch (err) {
    console.warn("Could not look up the main calendar's ID: " + err);
    return calendarId;
  }
}

/** Real calendar IDs without repeats, in order. */
function uniqueCalendarIds_(ids) {
  const result = [];
  ids.filter(Boolean).forEach((id) => {
    const real = canonicalCalendarId_(id);
    if (result.indexOf(real) === -1) result.push(real);
  });
  return result;
}

function isNotFoundError_(err) {
  return isNotFoundMessage_(err && err.message ? err.message : err);
}

/**
 * The ID of the add-on's own "Prayer Times" calendar, created on first use.
 * If the user deletes it, the sync notices (the event list returns 404) and
 * calls createDedicatedCalendar_ again.
 */
function ensureDedicatedCalendar_(settings) {
  return settings.dedicatedCalendarId || createDedicatedCalendar_(settings);
}

function createDedicatedCalendar_(settings) {
  const resource = {
    summary: APP_.calendarName,
    description: "Prayer times added by the Prayer Times add-on. You can hide or delete this calendar at any time.",
  };
  if (settings.location && settings.location.timezone) resource.timeZone = settings.location.timezone;
  const created = Calendar.Calendars.insert(resource);
  const latest = loadSettings_();
  latest.dedicatedCalendarId = created.id;
  saveSettings_(latest);
  return created.id;
}

function calendarDisplayName_(calendarId, settings) {
  if (calendarId === settings.dedicatedCalendarId) return APP_.calendarName;
  try {
    const entry = Calendar.CalendarList.get(calendarId);
    return entry.summaryOverride || entry.summary || calendarId;
  } catch (err) {
    return calendarId === "primary" ? "your main calendar" : calendarId;
  }
}

/**
 * The add-on's events in a calendar, found by their private extended
 * property. timeMin limits the list to events that end after it; null lists
 * every event. Returns null if the calendar no longer exists.
 */
function listAddOnEvents_(calendarId, timeMin) {
  const events = [];
  let pageToken = null;
  try {
    do {
      const options = {
        privateExtendedProperty: TAG_.app + "=true",
        singleEvents: true,
        showDeleted: false,
        maxResults: 2500,
        fields: "items(id,start,extendedProperties),nextPageToken",
      };
      if (timeMin) options.timeMin = timeMin;
      if (pageToken) options.pageToken = pageToken;
      const page = Calendar.Events.list(calendarId, options);
      (page.items || []).forEach((item) => events.push(item));
      pageToken = page.nextPageToken || null;
    } while (pageToken);
  } catch (err) {
    if (isNotFoundError_(err)) return null;
    throw err;
  }
  return events;
}

/**
 * Runs inserts, updates and deletes against the Calendar REST API, a few at a
 * time in parallel with UrlFetchApp.fetchAll. Rate-limited requests are
 * retried with backoff. Stops early when the time budget runs out, so a card
 * action always answers within the add-on's 30-second limit.
 *
 * Returns { statuses: ["done" | "failed" | undefined, ...], errors: [...] }.
 */
function runCalendarOps_(ops, deadlineMs) {
  const statuses = new Array(ops.length);
  const errors = [];
  if (!ops.length) return { statuses: statuses, errors: errors };
  const token = ScriptApp.getOAuthToken();
  let queue = ops.map((op, index) => ({ op: op, index: index, attempts: 0 }));
  let backoffMs = 0;
  let stopped = false;

  while (queue.length && !stopped) {
    if (Date.now() + backoffMs + 4000 > deadlineMs) break;
    if (backoffMs) Utilities.sleep(backoffMs + Math.floor(Math.random() * 250));
    const batch = queue.slice(0, CALENDAR_BATCH_SIZE_);
    queue = queue.slice(batch.length);
    const requests = batch.map((item) => {
      const request = calendarRequestForOp_(item.op);
      const options = {
        url: request.url,
        method: request.method,
        headers: { Authorization: "Bearer " + token },
        muteHttpExceptions: true,
      };
      if (request.payload) {
        options.contentType = "application/json";
        options.payload = request.payload;
      }
      return options;
    });

    let responses = null;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch (err) {
      console.warn("Calendar batch failed: " + err);
    }
    const retry = [];
    batch.forEach((item, i) => {
      const response = responses ? responses[i] : null;
      // Without a response an insert may still have reached Calendar, so it is
      // not sent again in this run; the next sync lists the calendar first.
      const result = response
        ? classifyCalendarResponse_(item.op, response.getResponseCode(), response.getContentText())
        : {
            ok: false,
            retry: item.op.type !== "insert",
            stop: false,
            message: "Google Calendar could not be reached. The next sync checks the new events.",
          };
      if (result.ok) {
        statuses[item.index] = "done";
      } else if (result.retry && item.attempts + 1 < CALENDAR_MAX_ATTEMPTS_) {
        item.attempts++;
        retry.push(item);
      } else {
        statuses[item.index] = "failed";
        if (errors.indexOf(result.message) === -1) errors.push(result.message);
        if (result.stop) stopped = true;
      }
    });
    if (retry.length) {
      queue = retry.concat(queue);
      backoffMs = Math.min(8000, backoffMs ? backoffMs * 2 : 1000);
    } else {
      backoffMs = 0;
    }
  }
  return { statuses: statuses, errors: errors };
}
