# Test fixtures

These files are written by hand. They follow the documented response formats
of the two APIs the add-on calls, but they were not captured from the live
services, and the prayer times and places in them are sample values, not real
data.

- `aladhan-iso-budapest-2026-11.json`: three days from the AlAdhan calendar
  endpoint (`/v1/calendar/{year}/{month}`) with `iso8601=true`, so every time
  carries its UTC offset.
- `aladhan-plain-budapest-2026-03.json`: three days in the plain format
  (`"05:13 (CEST)"`) around the change to daylight saving time on
  29 March 2026.
- `open-meteo-springfield.json` and `open-meteo-budapest.json`: results from
  the Open-Meteo geocoding search endpoint (`/v1/search`).
- `open-meteo-error.json`: the documented error body (HTTP 400).

The format sources were the AlAdhan response types in the official
`@islamicnetwork/sdk` package (version 1.1.0) and the Open-Meteo geocoding
documentation in the `open-meteo/open-meteo-website` repository. When the add-on
runs against the real APIs, compare a live response with these files and
update them if a field differs.
