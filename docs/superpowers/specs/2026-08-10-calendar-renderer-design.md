# Calendar Renderer Design

## Purpose

Add a new render page, `calendar/`, to this repo, following the existing pattern used by `mancala/`, `fifteen/`, and `mcserverstatus/`: a static `index.html` + `index.js` page that reads query params, fetches/builds data client-side, and renders into a `#content` div. c3po screenshots this page and posts the image to Discord.

The new renderer produces a month-grid view of a public Google Calendar.

## Folder Structure

`calendar/index.html` + `calendar/index.js`, matching the structure of `mcserverstatus/`.

## Query Parameters

Required:
- `calendarId` — the Google Calendar ID (e.g. `calendar.driftwood@gmail.com`)
- `tz` — IANA timezone (e.g. `America/Chicago`)

Optional:
- `month` — `YYYY-MM`; defaults to the current month in the given `tz` if omitted
- `interactive` — `true`/absent; when `true`, renders a button bar (see below)
- `theme` — `dark` (default) or `light`

## Data Flow

1. Build the Google iCal export URL: `https://calendar.google.com/calendar/ical/<encodeURIComponent(calendarId)>/public/basic.ics`
2. Google's iCal endpoint does not send `Access-Control-Allow-Origin`, so a direct browser `fetch()` is blocked by CORS (confirmed via manual test). Fetch through a CORS passthrough instead: `https://corsproxy.io/?url=<encodeURIComponent(ical URL)>` (confirmed working end-to-end in a real browser — returns 200 with `access-control-allow-origin: *`). Note: a bare `curl` without browser-like headers gets a 403 from corsproxy.io, and `api.allorigins.win` was tried first but proved flaky (intermittent 503/522/408) during testing — stick with corsproxy.io.
3. Parse the fetched `.ics` text with **ical.js**, loaded via CDN `<script>` tag (matching the existing Bootstrap CDN pattern in `mcserverstatus/index.html`). Use ical.js's recurrence expansion to correctly materialize RRULE-based recurring events.
4. Filter/expand events to those with an occurrence falling within the target month, converting occurrence times to the requested `tz`.

## Rendering

- Bootstrap-based month grid (7 columns, reusing the CDN Bootstrap already used by `mcserverstatus`), each day cell showing the date number and up to a few event titles/times stacked vertically.
- Dark background by default (`theme=dark`), matching the Discord-friendly dark style of the other renderers; `theme=light` swaps to a light palette.
- Header showing the rendered month and year.

### Interactive controls (`interactive=true` only)

When absent (default), no buttons are rendered — just the calendar grid, matching the minimal-render behavior of the other pages (important for one-shot Discord screenshots).

When present, a button bar renders above the grid:
- **◀ / ▶** — plain `<a>` links that rewrite the `month` query param to the previous/next month and reload the page
- **Theme toggle** — a plain `<a>` link that rewrites the `theme` query param (`dark` ⇄ `light`) and reloads the page

No client-side re-render logic is needed — every param-driven state change in this repo is already a fresh page load, and c3po only needs a final static page to screenshot.

## Event Detail Rendering

Each event line in a day cell shows `time — summary`, followed by the event's `location` and `description` on their own lines beneath it, when present in the iCal data. No click/popup interaction — everything renders inline, since the page is primarily consumed as a static screenshot rather than a live interactive page.

## Bracketed-Tag Coloring

Event summaries matching `^\[([^\]]+)\]` (e.g. `[Not a Driftwood Event] Pizza Ranch`) are treated as tagged:
- The bracketed tag (e.g. `Not a Driftwood Event`) is stripped from the displayed title.
- Each distinct tag found among the rendered month's events is assigned a color from a small fixed palette, cycling if there are more distinct tags than palette colors. This is generic — not hardcoded to any specific tag string.
- The assigned color is applied to that event's text/left-border in the grid.
- A small legend renders below the month header, listing each distinct tag next to its color swatch, so the coloring is decodable from a screenshot alone.
- Events without a bracketed prefix use the existing default event color.

## Equal-Height Grid

- Week rows divide the available viewport height evenly: `height: calc((100vh - header - legend - button bar) / numWeeksInMonth)`, so every row is the same height and the grid fills the screenshot regardless of how many weeks the rendered month has (4–6).
- Each day cell has `overflow-y: auto`: if a day's event list (now including location/description) exceeds the cell's fixed height, that cell scrolls internally rather than clipping content or growing the row and breaking the equal-height layout.

## Error Handling

If the calendar is not public, the iCal fetch fails, or `calendarId`/`tz` are missing, render a plain error message into `#content`. No retries, no fallback UI — matches the minimal error-handling style of the existing renderers (e.g. `mcserverstatus`'s `isAllDefined` guard).

## Out of Scope

- Non-public (authenticated) calendars
- Week/day/agenda views
- Client-side re-rendering without a page reload
- Editing or writing calendar data
