# CLAUDE.md

This file gives Claude Code guidance for working in this repository.

## Project

A Google Calendar add-on, written in Google Apps Script (V8 runtime) with
CardService, that adds Islamic prayer times to Google Calendar. The repository
holds only the add-on. An earlier Next.js web app was removed; it is in the git
history before the commit "Remove the Next.js web app".

The add-on has no server. It runs in Google's Apps Script environment and calls
two free APIs that need no key:

- AlAdhan (`https://api.aladhan.com/v1/calendar/{year}/{month}`) for prayer times.
- Open-Meteo geocoding (`https://geocoding-api.open-meteo.com/v1/search`) for city
  search. Each result includes the place's time zone.

## Commands

```bash
npm test                 # all tests, Node.js 22+, no dependencies
npm run test:timezones   # the suite in six process time zones
clasp push               # upload src/ to the Apps Script project (needs .clasp.json, see README)
```

There is no build step. The files in `src/` are the add-on.

## Files

- `src/appsscript.json`: manifest. Homepage trigger `onHomepage` for Calendar,
  narrow Calendar scopes, `urlFetchWhitelist`, `openLinkUrlPrefixes`, and the
  advanced Calendar service (`Calendar`, v3). There is no event-open trigger.
- `src/Core.gs`: all pure logic. Dates, times, time zone math, AlAdhan and
  Open-Meteo URL building and parsing, Qibla bearing, method suggestions,
  settings defaults, migration and form parsing, event building, the sync plan,
  Calendar error classification, messages. No Apps Script service is called here.
- `src/Services.gs`: HTTP with retries (`fetchJson_`), the per-user cache
  (`cached_`), geocoding, AlAdhan months, calendar preferences and lists, the
  dedicated calendar, listing the add-on's events, and bulk Calendar writes
  (`runCalendarOps_`, parallel `UrlFetchApp.fetchAll` with backoff and a time
  budget).
- `src/Sync.gs`: `syncCalendar_`, `removeAllEvents_`, and the daily trigger
  (`updateSyncTrigger_`).
- `src/Settings.gs`: settings and sync state in User Properties, and migration
  from version 1.
- `src/Cards.gs`: card builders. They only read the model passed in and never
  call services.
- `src/Code.gs`: entry points. `onHomepage`, the trigger handler
  `syncPrayerTimes` (version 1 used the same name, so its old trigger keeps
  working), and the card actions (`on...`).

## How a sync works

1. Load settings. Look up the location's time zone through AlAdhan if it is
   missing (version 1 data and pasted coordinates).
2. Window: today in the location's time zone plus `daysAhead - 1` days.
3. Fetch the months that cover the window from AlAdhan (cached for 6 hours),
   apply the Hijri adjustment, and stop if any day is missing, so missing data
   never deletes events.
4. `buildDesiredEvents_` makes one spec per event: key `date|slot`, title, exact
   start and end instants, description, reminder, transparency, and a content
   hash (`sig`).
5. List the add-on's events from the window start on with
   `privateExtendedProperty=prayerTimeEvent=true`, in the target calendar and in
   calendars used before.
6. `planSync_` compares the two lists: insert what is missing, update what has a
   different `sig`, delete duplicates and unwanted events, delete version 1
   events (tagged but without `prayerDate`) in the window, and delete upcoming
   events in calendars no longer used. Events before the window are history and
   are never touched by a sync.
7. `runCalendarOps_` runs the plan ten requests at a time until about 22 seconds
   have passed (card actions must answer within 30 seconds), and
   `summarizeSync_` reports how far the calendar is complete.

## Rules for changes

- Put date, time and parsing logic in `Core.gs` as pure functions, with unit
  tests in `test/core-*.test.js`. Pass time zone conversions in as functions;
  `Services.gs` uses `Utilities.parseDate` and `Utilities.formatDate`, the
  tests use `test/helpers/tz.js`.
- Dates are `YYYY-MM-DD` strings for a local day at the location. Instants are
  epoch milliseconds. Never use the runtime's local time zone (`getHours`,
  `setHours`, `new Date(y, m, d)`); the script's time zone is unrelated to the user's.
- Only touch events whose private extended property `prayerTimeEvent` is `"true"`.
  Never match events by title.
- Parse numbers with `parseWholeNumber_` and check the result. Never write
  `parseInt(x) || default`, which turns 0 into the default.
- Only https. Any new host must be added to `urlFetchWhitelist` (and to
  `openLinkUrlPrefixes` if a card links to it); `test/static.test.js` checks this.
- Store per-user data in User Properties only. Script Properties are shared by
  every user of the add-on.
- Names of private helpers end in an underscore, so they stay out of the editor's
  Run menu. Card action handlers and trigger handlers must be public.
- No code at the top level of a file may use a name from another file. Apps
  Script does not promise a load order; `test/static.test.js` loads the files in
  two orders to check this.
- Card builders take a model and return a built card. Card actions go through
  `handleAction_`, so an error becomes a notification. A form that saves must
  list its fields in the action's `fields` parameter, because unchecked switches
  and empty checkbox groups are not sent at all.
- Settings save on change (`onSettingChange`); there is no Save button. A change
  that affects events sets `pendingChanges`, and the home card asks for a sync.
- "primary" is another name for the user's main calendar. Compare calendar IDs
  only after `canonicalCalendarId_`.
- No emojis in UI text, code or docs. `test/static.test.js` and the fake
  CardService check this.
- Commits and pull requests carry no AI attribution.

## Testing

- `test/helpers/load.js` runs the `.gs` files with `vm.runInThisContext`, one
  shared global scope like Apps Script. Each test file is a separate process.
- `test/helpers/card-service.js` is a strict fake CardService. It allows only the
  classes and methods listed from `@types/google-apps-script` 2.0.14, checks
  argument kinds and required fields, and rejects emojis.
- `test/helpers/environment.js` fakes Properties, Cache, Lock, Utilities,
  ScriptApp triggers, UrlFetchApp (with fake AlAdhan, Open-Meteo and Calendar
  REST endpoints) and the advanced Calendar service, sharing one calendar store.
  It rejects URLs that are not in the manifest's `urlFetchWhitelist`.
- `test/flows.test.js` drives the cards like a user (`click`, `change`) with
  `Date` mocked by `node:test`, so the 30-second budget can be tested.
- Fixtures in `test/fixtures/` are written by hand in the documented formats;
  they were not captured from the live APIs.

CardService cannot run outside Google. Card rendering, real API responses,
OAuth scopes and triggers must be tested in Google Calendar with a test
deployment (README, "Install for testing").

## Limits to keep in mind

- Card actions: 30 seconds. Time-driven triggers: 6 minutes; add-ons may run
  them at most once an hour. The add-on keeps one daily trigger per user.
- CacheService: values up to 100 KB, kept at most 6 hours. User Properties:
  9 KB per value.
- Calendar API: about 10 parallel writes per batch with backoff on
  `rateLimitExceeded`; `quotaExceeded` stops the run.
- AlAdhan limits requests per IP (about 12 per second). Open-Meteo's free tier
  is for non-commercial use and allows fewer than 10,000 calls a day; it needs
  an attribution link next to location data, which the cards show.
