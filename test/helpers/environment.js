"use strict";

/**
 * Fake Apps Script services for running whole add-on flows in Node.js:
 * PropertiesService, CacheService, LockService, Utilities, Session, ScriptApp,
 * UrlFetchApp (with fake AlAdhan, Open-Meteo and Calendar REST endpoints) and
 * the advanced Calendar service. They share one in-memory calendar store.
 *
 * The fakes enforce the limits that matter here: string property values up
 * to 9 KB, cache values up to 100 KB for up to 6 hours, one time-driven
 * trigger per user, fetches only to URLs in the manifest's urlFetchWhitelist
 * and only over https, and valid Calendar event resources. They answer the
 * way the documentation describes; they are not the real services.
 */

const fs = require("fs");
const path = require("path");
const tz = require("./tz");
const { aladhanMonth } = require("./aladhan");
const { createCardService } = require("./card-service");

const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "appsscript.json"), "utf8"));
const FIXTURES = path.join(__dirname, "..", "fixtures");
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));

const PRIMARY_ID = "user@example.com";
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function response(code, body) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { getResponseCode: () => code, getContentText: () => text };
}

function apiError(code, reason, message) {
  return response(code, { error: { code, message, errors: [{ domain: "global", reason, message }] } });
}

function checkOptions(options, allowed, where) {
  Object.keys(options || {}).forEach((key) => {
    if (!allowed.includes(key)) throw new Error(`${where}: unknown option ${key}`);
    if (options[key] === undefined) throw new Error(`${where}: option ${key} is undefined`);
  });
}

/**
 * Creates the fakes and puts them on globalThis.
 * options: { calendarTimeZone, use24h, clock (node:test mock timers) }
 */
function installEnvironment(options) {
  const opts = Object.assign({ calendarTimeZone: "Europe/Budapest", use24h: true, clock: null }, options);
  const clock = opts.clock;
  const env = {
    requests: [],
    logs: [],
    failures: [],
    latencyMs: 0,
    pageSize: 0,
    sleptMs: 0,
    fetchAllCalls: 0,
    lockBusy: false,
    fetchAllThrows: 0,
    geocodeResults: {
      budapest: fixture("open-meteo-budapest.json"),
      springfield: fixture("open-meteo-springfield.json"),
    },
  };

  // Properties -------------------------------------------------------------
  function makeProperties() {
    const store = new Map();
    const check = (key, value) => {
      if (typeof value !== "string") throw new Error(`Property ${key} must be a string, got ${typeof value}`);
      if (Buffer.byteLength(value, "utf8") > 9 * 1024) throw new Error(`Property ${key} is larger than 9 KB`);
    };
    const api = {
      getProperty: (key) => (store.has(key) ? store.get(key) : null),
      setProperty: (key, value) => {
        check(key, value);
        store.set(key, value);
        return api;
      },
      setProperties: (values, deleteAllOthers) => {
        if (deleteAllOthers) store.clear();
        Object.keys(values).forEach((key) => api.setProperty(key, values[key]));
        return api;
      },
      getProperties: () => Object.fromEntries(store),
      getKeys: () => [...store.keys()],
      deleteProperty: (key) => {
        store.delete(key);
        return api;
      },
      deleteAllProperties: () => {
        store.clear();
        return api;
      },
    };
    return api;
  }
  env.userProperties = makeProperties();
  env.scriptProperties = makeProperties();

  // Cache -------------------------------------------------------------------
  const cacheStore = new Map();
  const checkKey = (key) => {
    if (typeof key !== "string" || !key || key.length > 250) throw new Error("Bad cache key: " + key);
  };
  env.cache = {
    get: (key) => {
      checkKey(key);
      const entry = cacheStore.get(key);
      return entry && entry.expires > Date.now() ? entry.value : null;
    },
    put: (key, value, seconds) => {
      checkKey(key);
      if (typeof value !== "string") throw new Error("Cache values must be strings");
      if (Buffer.byteLength(value, "utf8") > 100 * 1024) throw new Error("Cache value larger than 100 KB: " + key);
      const ttl = seconds === undefined ? 600 : seconds;
      if (ttl > 21600) throw new Error("Cache expiration is at most 6 hours");
      cacheStore.set(key, { value, expires: Date.now() + ttl * 1000 });
    },
    remove: (key) => {
      cacheStore.delete(key);
    },
  };
  env.clearCache = () => cacheStore.clear();

  // Triggers ------------------------------------------------------------------
  env.triggers = [];
  let triggerSeq = 0;
  const makeTrigger = (handler, spec) => {
    const trigger = { id: "trigger-" + ++triggerSeq, spec };
    trigger.getHandlerFunction = () => handler;
    trigger.getUniqueId = () => trigger.id;
    return trigger;
  };
  env.addLegacyTrigger = () => env.triggers.push(makeTrigger("syncPrayerTimes", { hour: 1, everyDays: 1 }));
  const ScriptApp = {
    getOAuthToken: () => "test-token",
    getProjectTriggers: () => env.triggers.slice(),
    deleteTrigger: (trigger) => {
      const index = env.triggers.indexOf(trigger);
      if (index === -1) throw new Error("Unknown trigger");
      env.triggers.splice(index, 1);
    },
    newTrigger: (handler) => ({
      timeBased: () => {
        const spec = {};
        const builder = {
          atHour: (hour) => {
            if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("atHour needs 0 to 23");
            spec.hour = hour;
            return builder;
          },
          everyDays: (n) => {
            spec.everyDays = n;
            return builder;
          },
          everyHours: (n) => {
            spec.everyHours = n;
            return builder;
          },
          everyMinutes: () => {
            throw new Error("Add-ons cannot run time-driven triggers more often than once an hour");
          },
          inTimezone: (zone) => {
            spec.timeZone = zone;
            return builder;
          },
          nearMinute: (minute) => {
            spec.minute = minute;
            return builder;
          },
          create: () => {
            if (env.triggers.length) throw new Error("Add-ons can only have one time-driven trigger per user");
            const trigger = makeTrigger(handler, spec);
            env.triggers.push(trigger);
            return trigger;
          },
        };
        return builder;
      },
    }),
  };

  // Calendar store ------------------------------------------------------------
  env.calendars = new Map();
  let eventSeq = 0;
  env.addCalendar = (id, summary, extra) => {
    env.calendars.set(id, Object.assign({ id, summary, accessRole: "owner", primary: false, events: new Map() }, extra || {}));
  };
  env.addCalendar(PRIMARY_ID, "Personal", { primary: true });
  env.addCalendar("family@group.calendar.google.com", "Family");
  env.addCalendar("holidays@group.v.calendar.google.com", "Holidays", { accessRole: "reader" });
  const calendarFor = (id) => env.calendars.get(id === "primary" ? PRIMARY_ID : id) || null;
  const notFound = () => new Error("GoogleJsonResponseException: API call to calendar failed with error: Not Found");
  env.addEvent = (calendarId, resource) => {
    const event = JSON.parse(JSON.stringify(resource));
    event.id = event.id || "ev" + ++eventSeq;
    calendarFor(calendarId).events.set(event.id, event);
    return event;
  };
  env.eventsIn = (calendarId) => {
    const calendar = calendarFor(calendarId);
    return calendar ? [...calendar.events.values()] : [];
  };
  env.appEventsIn = (calendarId) =>
    env.eventsIn(calendarId).filter((e) => e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.prayerTimeEvent === "true");

  function validateEvent(resource) {
    if (typeof resource.summary !== "string" || !resource.summary) throw new Error("Event without a summary");
    ["start", "end"].forEach((key) => {
      if (!resource[key] || !RFC3339.test(resource[key].dateTime)) throw new Error(`Event ${key}.dateTime is not RFC 3339: ${JSON.stringify(resource[key])}`);
    });
    if (Date.parse(resource.end.dateTime) <= Date.parse(resource.start.dateTime)) throw new Error("Event ends before it starts");
    if (!["opaque", "transparent"].includes(resource.transparency)) throw new Error("Bad transparency " + resource.transparency);
    const reminders = resource.reminders;
    if (!reminders || reminders.useDefault !== false || !Array.isArray(reminders.overrides) || reminders.overrides.length > 5) {
      throw new Error("Bad reminders " + JSON.stringify(reminders));
    }
    reminders.overrides.forEach((r) => {
      if (r.method !== "popup" || !Number.isInteger(r.minutes) || r.minutes < 0 || r.minutes > 40320) throw new Error("Bad reminder " + JSON.stringify(r));
    });
    const tags = resource.extendedProperties && resource.extendedProperties.private;
    if (!tags) throw new Error("Event without private extended properties");
    Object.keys(tags).forEach((key) => {
      if (key.length > 44 || typeof tags[key] !== "string" || tags[key].length > 1024) throw new Error("Bad extended property " + key);
    });
  }

  function calendarRest(url, method, request) {
    if (!request.headers || request.headers.Authorization !== "Bearer test-token") return apiError(401, "required", "Login Required");
    const match = /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(url.pathname);
    if (!match) return apiError(404, "notFound", "Not Found");
    const calendar = calendarFor(decodeURIComponent(match[1]));
    const eventId = match[2] ? decodeURIComponent(match[2]) : null;
    if (!calendar) return apiError(404, "notFound", "Not Found");
    if (calendar.accessRole !== "owner") return apiError(403, "forbidden", "Forbidden");
    const body = () => {
      if (request.contentType !== "application/json") throw new Error("Calendar writes must send application/json");
      return JSON.parse(request.payload);
    };
    if (method === "post" && !eventId) {
      const resource = body();
      validateEvent(resource);
      return response(200, env.addEvent(calendar.id, resource));
    }
    if (method === "patch" && eventId) {
      const event = calendar.events.get(eventId);
      if (!event) return apiError(404, "notFound", "Not Found");
      const patch = body();
      validateEvent(patch);
      const privateTags = Object.assign({}, event.extendedProperties && event.extendedProperties.private, patch.extendedProperties.private);
      Object.assign(event, patch, { extendedProperties: { private: privateTags } });
      return response(200, event);
    }
    if (method === "delete" && eventId) {
      if (request.payload) throw new Error("DELETE must not send a body");
      if (!calendar.events.has(eventId)) return apiError(410, "deleted", "Resource has been deleted");
      calendar.events.delete(eventId);
      return response(204, "");
    }
    return apiError(405, "methodNotAllowed", "Method not allowed");
  }

  // Fake AlAdhan and Open-Meteo -----------------------------------------------------
  env.zoneForCoordinates = (latitude, longitude) =>
    Math.abs(latitude - 21.42) < 1 && Math.abs(longitude - 39.83) < 1 ? "Asia/Riyadh" : "Europe/Budapest";

  function aladhan(url) {
    const match = /^\/v1\/calendar\/(\d{4})\/(\d{1,2})$/.exec(url.pathname);
    if (!match) return response(404, { code: 404, status: "NOT_FOUND", data: "Unknown endpoint" });
    const q = Object.fromEntries(url.searchParams);
    for (const key of ["latitude", "longitude", "method", "school", "latitudeAdjustmentMethod", "iso8601"]) {
      if (q[key] === undefined) return response(400, { code: 400, status: "BAD_REQUEST", data: "Missing " + key });
    }
    const tune = (q.tune || "0,0,0,0,0,0,0,0,0").split(",").map(Number);
    if (tune.length !== 9 || tune.some((n) => !Number.isInteger(n))) return response(400, { code: 400, status: "BAD_REQUEST", data: "Bad tune" });
    const zone = q.timezonestring || env.zoneForCoordinates(Number(q.latitude), Number(q.longitude));
    const offsets = {
      Imsak: tune[0], Fajr: tune[1], Sunrise: tune[2], Dhuhr: tune[3],
      Asr: tune[4] + (q.school === "1" ? 45 : 0), Maghrib: tune[5], Sunset: tune[6], Isha: tune[7], Midnight: tune[8],
    };
    return response(200, aladhanMonth(Number(match[1]), Number(match[2]), {
      timeZone: zone,
      latitude: Number(q.latitude),
      longitude: Number(q.longitude),
      method: Number(q.method),
      offsets,
      iso: q.iso8601 === "true",
    }));
  }

  function geocode(url) {
    const count = Number(url.searchParams.get("count"));
    if (!(count >= 1 && count <= 100)) return response(400, fixture("open-meteo-error.json"));
    const name = (url.searchParams.get("name") || "").toLowerCase();
    return response(200, env.geocodeResults[name] || { generationtime_ms: 0.3 });
  }

  // UrlFetchApp ----------------------------------------------------------------
  /** Makes the next matching requests fail: env.fail(/open-meteo/, [{code: 429}, ...]). */
  env.fail = (pattern, outcomes) => env.failures.push({ pattern, outcomes: outcomes.slice() });

  function handle(request) {
    const url = request.url;
    const method = (request.method || "get").toLowerCase();
    if (!/^https:\/\//.test(url)) throw new Error("Only https URLs may be fetched: " + url);
    if (!MANIFEST.urlFetchWhitelist.some((prefix) => url.startsWith(prefix))) throw new Error("URL is not in urlFetchWhitelist: " + url);
    if (request.muteHttpExceptions !== true) throw new Error("Fetch without muteHttpExceptions: " + url);
    env.requests.push({ url, method });
    const failure = env.failures.find((f) => f.pattern.test(url) && f.outcomes.length);
    if (failure) {
      const outcome = failure.outcomes.shift();
      if (outcome.exception) throw new Error(outcome.exception);
      return response(outcome.code, outcome.body === undefined ? "" : outcome.body);
    }
    const parsed = new URL(url);
    if (parsed.host === "api.aladhan.com") return aladhan(parsed);
    if (parsed.host === "geocoding-api.open-meteo.com") return geocode(parsed);
    if (parsed.host === "www.googleapis.com") return calendarRest(parsed, method, request);
    throw new Error("No fake for " + url);
  }

  const UrlFetchApp = {
    fetch: (url, params) => handle(Object.assign({ url }, params || {})),
    fetchAll: (requests) => {
      env.fetchAllCalls++;
      if (env.latencyMs && clock) clock.tick(env.latencyMs);
      const responses = requests.map((request) => handle(request));
      // A transport failure after the requests were sent: Calendar applied them, but the script sees an exception.
      if (env.fetchAllThrows > 0) {
        env.fetchAllThrows--;
        throw new Error("Exception: Address unavailable");
      }
      return responses;
    },
  };

  // Advanced Calendar service --------------------------------------------------------
  function paginate(items, options) {
    const size = Math.min(options.maxResults || 250, env.pageSize || Infinity);
    const start = options.pageToken ? Number(options.pageToken) : 0;
    const result = { items: JSON.parse(JSON.stringify(items.slice(start, start + size))) };
    if (start + size < items.length) result.nextPageToken = String(start + size);
    return result;
  }

  let calendarSeq = 0;
  const Calendar = {
    Settings: {
      get: (name) => {
        if (name === "timezone") return { id: name, value: opts.calendarTimeZone };
        if (name === "format24HourTime") return { id: name, value: String(opts.use24h) };
        throw notFound();
      },
    },
    CalendarList: {
      list: (options) => {
        checkOptions(options, ["minAccessRole", "maxResults", "pageToken", "showHidden", "showDeleted"], "CalendarList.list");
        const items = [...env.calendars.values()]
          .filter((c) => options.minAccessRole !== "owner" || c.accessRole === "owner")
          .map((c) => ({ id: c.id, summary: c.summary, primary: c.primary, accessRole: c.accessRole }));
        return paginate(items, options);
      },
      get: (id) => {
        const calendar = calendarFor(id);
        if (!calendar) throw notFound();
        return { id: calendar.id, summary: calendar.summary, primary: calendar.primary };
      },
    },
    Calendars: {
      insert: (resource) => {
        if (!resource || !resource.summary) throw new Error("Calendars.insert needs a summary");
        const id = "prayertimes" + ++calendarSeq + "@group.calendar.google.com";
        env.addCalendar(id, resource.summary, { timeZone: resource.timeZone, createdByAddOn: true });
        return { id, summary: resource.summary, timeZone: resource.timeZone };
      },
      get: (id) => {
        const calendar = calendarFor(id);
        if (!calendar) throw notFound();
        return { id: calendar.id, summary: calendar.summary };
      },
    },
    Events: {
      list: (calendarId, options) => {
        checkOptions(
          options,
          ["privateExtendedProperty", "singleEvents", "showDeleted", "maxResults", "fields", "timeMin", "timeMax", "pageToken"],
          "Events.list"
        );
        const calendar = calendarFor(calendarId);
        if (!calendar) throw notFound();
        if (calendar.listError) throw new Error(calendar.listError);
        let items = [...calendar.events.values()];
        if (options.privateExtendedProperty) {
          const [key, value] = options.privateExtendedProperty.split("=");
          items = items.filter((e) => e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private[key] === value);
        }
        if (options.timeMin) {
          if (!RFC3339.test(options.timeMin)) throw new Error("timeMin is not RFC 3339: " + options.timeMin);
          const min = Date.parse(options.timeMin);
          items = items.filter((e) => Date.parse(e.end.dateTime) > min);
        }
        return paginate(items, options);
      },
    },
  };

  // Everything else ------------------------------------------------------------------
  const cards = createCardService();
  env.cardLog = cards.log;
  const fakeConsole = {};
  ["log", "info", "warn", "error"].forEach((level) => {
    fakeConsole[level] = (...args) => env.logs.push({ level, text: args.map(String).join(" ") });
  });
  env.errorsLogged = () => env.logs.filter((entry) => entry.level === "error");

  const globals = {
    CardService: cards.CardService,
    PropertiesService: { getUserProperties: () => env.userProperties, getScriptProperties: () => env.scriptProperties },
    CacheService: { getUserCache: () => env.cache },
    LockService: {
      getUserLock: () => ({ tryLock: () => !env.lockBusy, releaseLock: () => undefined, hasLock: () => !env.lockBusy }),
    },
    Utilities: {
      formatDate: (date, zone, pattern) => tz.formatDate(date, zone, pattern),
      parseDate: (text, zone, pattern) => tz.parseDate(text, zone, pattern),
      sleep: (ms) => {
        env.sleptMs += ms;
        if (clock) clock.tick(ms);
      },
    },
    Session: { getScriptTimeZone: () => MANIFEST.timeZone, getActiveUserLocale: () => "en" },
    ScriptApp,
    UrlFetchApp,
    Calendar,
    console: fakeConsole,
  };
  const saved = {};
  Object.keys(globals).forEach((name) => {
    saved[name] = globalThis[name];
    globalThis[name] = globals[name];
  });
  env.uninstall = () => {
    Object.keys(saved).forEach((name) => {
      globalThis[name] = saved[name];
    });
  };
  return env;
}

module.exports = { installEnvironment, PRIMARY_ID, MANIFEST };
