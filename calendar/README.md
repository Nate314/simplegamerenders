# Calendar Renderer

Renders a month-grid view of a public Google Calendar for [c3po](https://github.com/Nate314/c3po) to screenshot and post to Discord.

## Basic usage

```
calendar/index.html?calendarId=<calendar id>&tz=<IANA timezone>
```

Example:

```
calendar/index.html?calendarId=calendar.driftwood%40gmail.com&tz=America%2FChicago
```

## Query parameters

Required:
- `calendarId` — the Google Calendar ID (e.g. `calendar.driftwood@gmail.com`)
- `tz` — IANA timezone (e.g. `America/Chicago`)

Optional:
- `month` — `YYYY-MM`; defaults to the current month in the given `tz`
- `theme` — `dark` (default) or `light`
- `interactive` — `true`/absent; adds a button bar (Prev/Next/Today month nav, theme toggle, "Show descriptions"/"Hide locations" checkboxes) and highlights today's cell
- `locationEmoji` — repeatable, `<regex>:<emoji>`; prepends an emoji to events whose location matches the (case-insensitive) regex, e.g. `&locationEmoji=church:⛪&locationEmoji=pizza:🍕`
- `apiKey` — a Google Cloud API key; switches the data source to the Google Calendar API v3 (see below). **Required for any real deployment** — the default data source only works for local testing.
- `weeklyEvent` — repeatable, `<Day>|<StartHH:MM>|<EndHH:MM>|<Title>[|<Location>]`; renders a synthetic event on every occurrence of `<Day>` in the displayed month, without it needing to exist on the actual Google Calendar. `<Day>` is a weekday name (`Sun`, `Mon`, ..., or full names like `Sunday`); times are 24-hour, interpreted in the page's `tz`. Example: `&weeklyEvent=Sun|09:30|10:30|%5BWeekly%5D%20Sunday%20Morning%20Service|Westside%20Church%20of%20the%20Nazarene`. Useful for standing recurring events you'd rather keep off the calendar (so the calendar stays uncluttered for one-off items). If a `weeklyEvent` occurrence's date/start/end/location happens to also match a real calendar event (e.g. it hasn't been deleted from the calendar yet), only the real calendar event is shown — it always wins over its synthetic counterpart.
- `overrideEmoji` — an emoji (or any short string) appended to the end of the title of any event that has replaced another via the `[Override]` mechanism (see below), e.g. `&overrideEmoji=⭐`. Omit to leave overridden titles unchanged.
- `config` — a URL to a public JSON file (e.g. an object in a public GCP Cloud Storage bucket) providing any of the above params instead of URL-encoding them by hand. See below.

Event summaries prefixed with `[Tag] ` (e.g. `[Weekly] Sunday Morning Service`) get the `[Tag]` stripped and colored per-tag, with a legend explaining the colors.

### Reading params from a JSON config file

Instead of URL-encoding `weeklyEvent`/`locationEmoji` pipe-and-colon strings by hand, point `config` at a public JSON file with the same information in a more readable, structured form:

```
calendar/index.html?config=https://storage.googleapis.com/<bucket>/<file>.json
```

The JSON object can set any of: `calendarId`, `tz`, `apiKey`, `theme`, `month`, `interactive`, `overrideEmoji`, `locationEmoji` (array of `{ "pattern": "<regex>", "emoji": "<emoji>" }`), `weeklyEvent` (array of `{ "day": "<Sun..Sat>", "start": "<HH:MM>", "end": "<HH:MM>", "title": "<title>", "location": "<location>" }`). See `calendar/driftwood-calendar-config.json` (local-only, not committed) for a worked example.

The URL and the config file can be combined: any param present directly in the URL takes precedence over the same field in the config file. This is what makes the button bar's Prev/Next/Today/theme-toggle/checkbox links work when a `config` is in play — those links carry `month`, `theme`, `showDescriptions`, and `hideLocations` explicitly in the URL, overriding whatever the config file says for those specific fields, while everything else (`calendarId`, `apiKey`, `weeklyEvent`, etc.) keeps coming from the config file. The config file must be served with CORS headers allowing this page's origin. A public GCS object does **not** send CORS headers by default — the bucket needs a CORS config applied (`gsutil cors set`) allowing `https://simplegamerenders.nathangawith.com` (and `http://localhost:8123` for local testing), or the browser fetch will be blocked.

### Overriding an event

To change or cancel a single occurrence of anything on the calendar (a `weeklyEvent` occurrence or a normal calendar event) — a moved time, a guest speaker, a cancelled night — add a normal event to the actual Google Calendar with the same date/start/end/location as the event it should replace, and tag it `[Override]`. Any event (real or a synthetic `weeklyEvent` occurrence) whose date, start time, end time, and location match a `[Override]`-tagged event is hidden, and the `[Override]`-tagged event is shown in its place — keeping the *replaced* event's tag (e.g. `[Weekly]`), since it's still that recurring thing, just changed for the week. `[Override]` itself never shows as its own tag; it's only a marker for this mechanism. If `overrideEmoji` is set, it's appended to the shown title so overridden events are visually flagged.

## Data source: why `apiKey` matters

There are two ways this page fetches calendar data:

1. **Default (no `apiKey`): Google's iCal export, through a CORS proxy (corsproxy.io).** Google's iCal export doesn't send CORS headers, so a direct browser fetch is blocked; corsproxy.io works around that. **This only works for local testing** — corsproxy.io's free tier rejects requests from any real (non-localhost) domain (`"Free usage is limited to localhost and development environments"`, HTTP 403). Free alternatives (`api.allorigins.win`, `api.codetabs.com`) were tried and are either unreliable or have since shut down entirely.
2. **With `apiKey`: the real Google Calendar API v3**, which sends its own CORS headers directly — no proxy needed, and it works from any real domain. **Use this for GitHub Pages / any production deployment.**

### Creating an API key

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in.
2. Create a project (or select an existing one) — the name doesn't matter.
3. Go to **APIs & Services → Library**, search for **Google Calendar API**, and click **Enable**.
4. Go to **APIs & Services → Credentials → + Create Credentials → API key**. A key is generated immediately.
5. Click into the new key and restrict it (recommended, since it'll be visible in the render URL):
   - **Application restrictions → Websites**, add both:
     - `https://simplegamerenders.nathangawith.com/*` (production)
     - `http://localhost:8123/*` (local testing) — note the path portion is effectively ignored, since browsers only send the *origin* (not the full path) in the `Referer` header for cross-origin requests like this one, so restricting to just `/calendar/*` wouldn't match anything meaningful. Restrict to the origin instead.
   - **API restrictions → Restrict key**, select only **Google Calendar API**.
6. Copy the key (`AIzaSy...`) and pass it as `&apiKey=<key>` in the render URL.

### Is it safe to put an API key in a URL / client-side code?

Yes, for a key set up this way — this is Google's own documented pattern for browser-side calls to its APIs (a "browser key" restricted by HTTP referrer), distinct from an unrestricted server-side key. The key is never committed into this repo's source; it's only ever supplied at request time as a URL param by whatever builds the render URL (c3po). Since:

- the calendar is already public,
- an API-key-only request (no OAuth) can only *read* calendar data, never write/modify it, and
- referrer restriction limits which domains can use it (not foolproof against a spoofed `Referer` from a non-browser client, but a real deterrent),

the worst case if the key is scraped and reused elsewhere is quota exhaustion — recoverable by regenerating the key — not a data breach or a bill.

## Local testing

```
cd simplegamerenders
python -m http.server 8123
```

Then open, e.g.:

```
http://localhost:8123/calendar/index.html?calendarId=calendar.driftwood%40gmail.com&tz=America%2FChicago&interactive=true&apiKey=<your key>&month=2026-08&theme=dark
```
