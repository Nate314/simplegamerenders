# Driftwood Calendar Render URL

Updated render URL that moves the three standing weekly events (Sunday
Morning Service, Sunday School, Young Adult Group Wednesday Night
Gathering) off the Google Calendar and into `weeklyEvent` query params
instead, using the new feature added in `calendar/index.js`. Once this
change is deployed, those three recurring series can be deleted from
the `calendar.driftwood@gmail.com` calendar — they'll keep rendering
via the URL.

## URL

```
https://simplegamerenders.nathangawith.com/calendar/index.html?calendarId=calendar.driftwood%40gmail.com&tz=America%2FChicago&interactive=true&apiKey=AIzaSyCZN2c5i09xNhT9SCxB8qsq5BqBE7hfU6s&locationEmoji=westside%20church%20of%20the%20nazarene:%E2%9B%AA&locationEmoji=pizza:%F0%9F%8D%95&theme=dark&weeklyEvent=Sun%7C09%3A30%7C10%3A30%7C%5BWeekly%5D%20Sunday%20Morning%20Service%7CWestside%20Church%20of%20the%20Nazarene%2C%201700%20W%20Santa%20Fe%20St%2C%20Olathe%2C%20KS%2066061%2C%20USA&weeklyEvent=Sun%7C11%3A00%7C12%3A00%7C%5BWeekly%5D%20Sunday%20School%7CWestside%20Church%20of%20the%20Nazarene%2C%201700%20W%20Santa%20Fe%20St%2C%20Olathe%2C%20KS%2066061%2C%20USA&weeklyEvent=Wed%7C18%3A30%7C20%3A00%7C%5BWeekly%5D%20Young%20Adult%20Group%20Wednesday%20Night%20Gathering%7CWestside%20Church%20of%20the%20Nazarene%2C%201700%20W%20Santa%20Fe%20St%2C%20Olathe%2C%20KS%2066061%2C%20USA
```

## What was added

Three `weeklyEvent` params, one per standing series (decoded):

| Day | Time | Title | Location |
|-----|------|-------|----------|
| Sun | 09:30–10:30 | `[Weekly] Sunday Morning Service` | Westside Church of the Nazarene, 1700 W Santa Fe St, Olathe, KS 66061, USA |
| Sun | 11:00–12:00 | `[Weekly] Sunday School` | Westside Church of the Nazarene, 1700 W Santa Fe St, Olathe, KS 66061, USA |
| Wed | 18:30–20:00 | `[Weekly] Young Adult Group Wednesday Night Gathering` | Westside Church of the Nazarene, 1700 W Santa Fe St, Olathe, KS 66061, USA |

They keep the `[Weekly]` tag so they're still grouped/colored the same
as before, and the location text matches exactly what's already on the
calendar so the ⛪ emoji and location legend numbering keep working.

## Before deleting from the calendar

Until the site is deployed with the `weeklyEvent` support, deleting
these series from Google Calendar first would make them disappear from
the render entirely. Deploy first, confirm the render still shows all
three every week, then delete the recurring series from the calendar.

## Changing or cancelling a single occurrence

Add a normal one-off event on the real calendar with the same
date/start/end/location as the occurrence to replace, tag it
`[Override]`, and it'll be shown instead of that week's synthetic
event. See `calendar/README.md` for details.
