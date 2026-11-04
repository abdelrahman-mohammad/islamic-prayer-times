# Test fixtures

## live/

Real responses from the AlAdhan and Open-Meteo APIs, captured on
4 November 2026 and trimmed to a few days. `test/live-fixtures.test.js`
parses them. They show the real formats, including three details the add-on
depends on:

- AlAdhan returns ISO 8601 times only for `iso8601=true`; `iso8601=1` gives
  plain `"04:47 (CET)"` times.
- In Oslo in June, Isha past midnight comes back as `2026-06-20T00:11:00+02:00`,
  with the day's own date, so the parser moves it to the next day.
- For method 13 a `tune` value replaces the method's own offset instead of
  adding to it (`aladhan-istanbul-2026-11-method13-tune-dhuhr.json`), which is
  why the add-on applies minute adjustments itself.

## The other files

These are written by hand in the same formats, for edge cases that are hard to
capture: a plain-format Isha after midnight, missing fields and errors. Their
prayer times and places are sample values, not real data.

- `aladhan-iso-budapest-2026-11.json`: three days from the calendar endpoint
  (`/v1/calendar/{year}/{month}`) with `iso8601=true`.
- `aladhan-plain-budapest-2026-03.json`: three days in the plain format around
  the change to daylight saving time on 29 March 2026.
- `open-meteo-springfield.json` and `open-meteo-budapest.json`: results from the
  Open-Meteo geocoding search endpoint (`/v1/search`).
- `open-meteo-error.json`: the error body (HTTP 400).
