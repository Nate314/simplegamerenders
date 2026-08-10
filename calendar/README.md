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

Event summaries prefixed with `[Tag] ` (e.g. `[Weekly] Sunday Morning Service`) get the `[Tag]` stripped and colored per-tag, with a legend explaining the colors.

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
