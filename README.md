# Prayer Times for Google Calendar

A Google Calendar add-on that adds the daily Islamic prayer times for your city
to Google Calendar. It is built with Google Apps Script and CardService, and it
uses two free APIs that need no account and no API key.

## Features

- **Two-step setup.** The add-on suggests a location from your calendar's time
  zone. Choose it or search for your city, check the preferences, and select
  **Add to my calendar**.
- **Home card.** Today's prayer times, the next prayer and how long until it,
  the Hijri date, and the Qibla direction.
- **Many days at once.** Each sync fills the next 7, 14 or 30 days (30 by
  default). With automatic updates on, a daily job at 3 AM local time adds the
  next day and applies changed settings.
- **City search.** Every result shows the city, region and country. You can
  also paste coordinates from Google Maps.
- **All AlAdhan calculation methods**, with one suggested for your country.
- **Asr time**: Standard (Shafi, Maliki, Hanbali) or Hanafi.
- **High latitude rule**: angle based, middle of the night, or one seventh of
  the night.
- **Minute adjustments** for each prayer, to match your local mosque.
- **Choice of events**: Fajr, Dhuhr, Asr, Maghrib and Isha, plus Sunrise if you
  want it.
- **Jumu'ah** on Fridays, at the Dhuhr time or at a fixed time you set.
- **Ramadan**: "Suhoor ends" (at Imsak) and "Iftar" (at Maghrib) events, with
  a Hijri date adjustment of up to two days to follow your local moon sighting.
- **Your own Prayer Times calendar** by default, so the events are easy to hide,
  color or remove. You can use any calendar you own instead.
- **Show as free** (on by default), a reminder at prayer time or earlier, and
  the event length.
- **Remove prayer events** deletes every event the add-on created, past and
  future, and turns off automatic updates. Your own events are never touched.

Settings save as soon as you change them. When a change affects your events, the
home card says so, and **Sync now** applies it.

## How it works

| Need | Source | Notes |
| --- | --- | --- |
| Prayer times | [AlAdhan](https://aladhan.com/) calendar endpoint, `https://api.aladhan.com/v1/calendar/{year}/{month}` | One request per month, cached for 6 hours. |
| City search | [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api), `https://geocoding-api.open-meteo.com/v1/search` | Returns the time zone of each place. Cached for 6 hours. |
| Qibla direction | Calculated in the add-on (great-circle bearing to the Kaaba) | No request. |
| Calendar | Google Calendar API through the Apps Script advanced Calendar service and `UrlFetchApp.fetchAll` | |

Prayer times are always calculated in the location's own time zone, and events
are created at exact instants. They show correctly even when your calendar uses
a different time zone.

Every event the add-on creates carries private extended properties
(`prayerTimeEvent`, `prayerName`, `prayerDate`, `prayerSig`). A sync compares
the events that should exist with the events that carry these properties, and
changes only the difference: it adds missing events, updates changed ones, and
deletes ones that are no longer wanted. It never looks at event titles, so an
event of yours named "Fajr Prayer" is safe.

## Install for testing

You need a Google account and the Apps Script project that holds the add-on.

### With the Apps Script editor

1. Open [script.google.com](https://script.google.com) and open the add-on's
   project, or create a new project.
2. In **Project Settings**, turn on **Show "appsscript.json" manifest file in
   editor**.
3. Upgrading from version 1? Delete the old files `Code.gs`, `PrayerTimes.gs`
   and `Settings.gs` first, because the new files reuse some of those names.
4. For each file in `src/`, create a script file with the same name and paste in
   its content. Replace the content of `appsscript.json` with `src/appsscript.json`.
5. Check that **Services** lists **Google Calendar API**. The manifest enables
   it; if it is missing, add it with the **+** next to Services.
6. Select **Deploy > Test deployments**, choose **Google Workspace add-on**, and
   select **Install**.
7. Open [Google Calendar](https://calendar.google.com), open the side panel on
   the right, and select **Prayer Times**. Allow access when asked.

### With clasp

```bash
npm install -g @google/clasp
```

```bash
clasp login
```

Create a file named `.clasp.json` in the repository root (it is in `.gitignore`)
with your script ID, which is in **Project Settings** in the Apps Script editor:

```json
{ "scriptId": "YOUR_SCRIPT_ID", "rootDir": "src" }
```

```bash
clasp push
```

`clasp push` replaces all files in the project with the files in `src/`. Then
install the test deployment as in steps 6 and 7 above.

### Publishing

A test deployment needs nothing else. Before publishing to the Google Workspace
Marketplace you also need a standard Google Cloud project with the Google
Calendar API enabled, OAuth verification for the Calendar scopes, and your own
logo URL in `addOns.common.logoUrl` (the manifest uses a generic calendar icon).

## Scopes

| Scope | Used for |
| --- | --- |
| `calendar.addons.execute` | Running as a Calendar add-on. |
| `calendar.app.created` | Creating the add-on's own Prayer Times calendar. |
| `calendar.events.owned` | Adding, updating and deleting prayer events in calendars you own. |
| `calendar.calendarlist.readonly` | Listing your calendars in Settings. |
| `calendar.settings.readonly` | Reading your calendar time zone and 12-hour or 24-hour clock. |
| `script.external_request` | Calling AlAdhan, Open-Meteo and the Calendar API. |
| `script.scriptapp` | Creating the daily automatic update. |

The add-on does not use the broad `calendar` scope.

## Privacy

- Settings are stored in User Properties, which belong to the signed-in user.
  No user can read or change another user's settings, and no settings are shared
  through Script Properties.
- The add-on has no server and stores nothing outside Google.
- AlAdhan receives the location's coordinates (rounded to 4 decimal places) and
  calculation settings. Open-Meteo receives the text you type into the city
  search, and the city name taken from your calendar's time zone, for the
  suggestion.

## Data sources and their terms

These were checked in November 2026.

- **AlAdhan** (`api.aladhan.com`): free and needs no key. Its community forum
  gives a rate limit of about 12 requests per second per IP address. The add-on
  caches each month of times for 6 hours and retries briefly on HTTP 429 and
  server errors.
- **Open-Meteo geocoding** (`geocoding-api.open-meteo.com`): free for
  non-commercial use, meaning private or non-profit apps without subscriptions or
  advertising. The free tier allows fewer than 600 calls a minute, 5,000 an hour,
  10,000 a day and 300,000 a month. The data is under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and needs a link
  to Open-Meteo next to any location shown, which the cards include. The README
  of the `open-meteo/geocoding-api` repository names CC BY-NC 4.0 instead, so
  check both before any commercial use. If the add-on is ever sold or shows ads,
  it needs a paid Open-Meteo plan.
- **GeoNames**: the source of Open-Meteo's place data, under CC BY 4.0.

Both APIs limit requests per IP address, and Apps Script shares its addresses
with many other scripts. Open-Meteo's terms say that apps on shared platforms
such as Google Sheets may be limited sooner. If the city search is busy, the
add-on says so; entering coordinates works without Open-Meteo.

## Limits

- A card action must finish within 30 seconds. A sync stops after about
  22 seconds and saves its progress. If a first sync is cut short, the message
  says so and **Sync now** finishes the rest.
- Add-ons may run time-driven triggers at most once an hour. The add-on keeps a
  single daily trigger per user, at 3 AM in the location's time zone.
- The times are calculated, not taken from a mosque's timetable. Use the minute
  adjustments to match your mosque.
- The Hijri date is calculated. Use the Hijri date adjustment to match the moon
  sighting where you live.

## Upgrading from version 1

The first time version 2 runs for a user, whether the user opens the add-on or
version 1's daily trigger fires, it:

- moves the old settings (location, method, reminder, event length, calendar)
  to the new format. A 0-minute reminder now stays 0 minutes, where version 1
  turned it into 30. A user who never chose a city in version 1 starts setup
  fresh, because version 1 saved its defaults before any choice was made.
- deletes the shared `GEOAPIFY_API_KEY` from Script Properties.
- remembers version 1's calendar, so its events are replaced even if you pick
  another calendar first.
- looks up the location's time zone, which version 1 did not store.
- keeps automatic updates on if version 1's daily trigger existed. That trigger
  is replaced with one at 3 AM in the location's time zone after its next run,
  or when you open the add-on.
- replaces version 1's events from today onward. Earlier events stay until you
  use **Remove prayer events**.

Version 1's daily sync time setting is gone. Version 2 keeps 7 to 30 days in
the calendar, so the hour of the daily update no longer matters, and it always
runs at 3 AM in the location's time zone.

**Reset add-on** clears the settings but keeps the record of the calendars the
add-on wrote to. Setting up again then reuses the Prayer Times calendar instead
of making a second one, and **Remove prayer events** still finds every event.

## Development

The project needs only Node.js 22 or newer. There are no dependencies to install.

```bash
npm test
```

```bash
npm run test:timezones
```

The second command runs the suite with the computer set to six different time
zones, to show that nothing depends on the time zone of the machine.

### What the tests cover

- `test/core-*.test.js`: unit tests for the pure logic in `src/Core.gs`: dates,
  times and time zones, AlAdhan and Open-Meteo parsing, URL building, the Qibla
  bearing, method suggestions, settings migration and form parsing, event
  building, and the sync plan.
- `test/flows.test.js`: whole flows (setup, home card, settings, sync, search,
  coordinates, migration, removal, reset, the daily trigger, rate limits and the
  30-second budget) against fake Apps Script services and a strict fake
  CardService.
- `test/static.test.js`: the manifest, URL allowlists, scopes, emoji-free text,
  and that the files load in any order.
- `test/live-fixtures.test.js`: the parsers against real AlAdhan and Open-Meteo
  responses.

### What the tests cannot cover

CardService and the other Apps Script services only run inside Google. The
fakes follow the documented behavior, but they cannot show how a card renders,
whether Google accepts every widget combination, or how the Calendar API and
triggers behave. Test the add-on in Google Calendar before relying on it.

The AlAdhan and Open-Meteo parsers are also tested against real responses
captured on 4 November 2026 (`test/fixtures/live/`, `test/live-fixtures.test.js`).

## Project layout

```
src/
  appsscript.json  Manifest: scopes, triggers, URL allowlists, advanced Calendar service
  Code.gs          Entry points: homepage, daily trigger, card actions
  Cards.gs         Card builders (CardService)
  Sync.gs          Calendar sync, event removal, daily trigger
  Services.gs      AlAdhan, Open-Meteo and Calendar calls, retries, caching
  Settings.gs      User settings and sync state, version 1 migration
  Core.gs          Pure logic with no Apps Script calls, unit tested
test/
  core-*.test.js   Unit tests
  flows.test.js    Flow tests against fakes
  static.test.js   Manifest and source checks
  helpers/         Loader, fakes, synthetic AlAdhan data, time zone helpers
  fixtures/        Real API responses (live/) and hand-written edge cases
```

## License

MIT.
