# Security

## Reporting a problem

Please do not open a public issue for a security problem. Report it privately
through GitHub instead: on this repository's **Security** tab, select
**Report a vulnerability**.

Useful details: what you did, what happened, and whether other users' calendars
or settings could be affected.

## What the add-on can access

- Your settings are stored in your own Apps Script User Properties. No settings
  are shared between users.
- The add-on asks only for narrow Google Calendar permissions: calendars it
  creates, events in calendars you own, your calendar list and your calendar
  settings. It never uses full calendar access.
- It only changes events it created itself, which it finds by a private tag.
- It sends only the location's coordinates to AlAdhan, and the text you search
  for to Open-Meteo. There is no server, and no data is stored outside Google.
