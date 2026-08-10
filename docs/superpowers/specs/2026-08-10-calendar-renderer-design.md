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

1. Build the Google iCal export URL: `https://calendar.google.com/calendar/ical/<encodeURIComponent(calendarId)>/public/basic.ics?_=<cacheBucket>`, where `cacheBucket = Math.floor(Date.now() / 300000)` (a 5-minute window). The `_=<cacheBucket>` cache-busting param is required: corsproxy.io caches responses by URL for up to an hour (`cache-control: public, max-age=3600`) independent of Google's own freshness, so without it, recently added/edited calendar events can silently fail to appear for up to an hour (confirmed via manual test — a stale `x-cache-status: HIT` response was missing an event added minutes earlier; adding the cache-busting param produced a fresh `MISS` with the event present). Bucketing to 5 minutes (rather than a per-request timestamp) still bounds staleness to at most 5 minutes while letting repeated requests within the same window hit the proxy's cache.
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

## Today Highlight and Navigation

Only in `interactive=true` mode:
- Today's date cell (computed in the requested `tz`) gets a highlighted border/background, so viewers can see where "now" is at a glance.
- A "Today" button appears in the button bar whenever the rendered month differs from the current month (in `tz`), navigating back to the current month via the same URL-param + reload pattern as the other buttons. It's omitted when already viewing the current month.

Outside `interactive=true`, there's no highlight and no button — matches the plain/minimal default screenshot render.

## Description Visibility

Event descriptions are hidden by default in every mode (locations still always show). In `interactive=true` mode, a checkbox in the button bar ("Show descriptions") toggles them:
- Backed by a `showDescriptions=true` query param, following the same URL-param + reload pattern as Prev/Next/theme — no client-side re-render logic.
- Unchecked (param absent) by default; checking it navigates to the same view with `showDescriptions=true` added.
- Outside `interactive=true`, there's no way to toggle it, so descriptions stay hidden — keeps the default screenshot render compact.

## Location Visibility

Locations are shown by default everywhere (unchanged from current behavior). In `interactive=true` mode, a second checkbox in the button bar ("Hide locations") lets viewers hide them for a cleaner view:
- Backed by a `hideLocations=true` query param, same URL-param + reload pattern as the other controls.
- Unchecked (param absent) by default — locations show, matching current behavior.
- Outside `interactive=true`, there's no way to toggle it, so locations always show.

## Location Legend

To cut down on repetition when many events share the same venue (common on the driftwood calendar), locations render as a short numbered badge (e.g. `[1]`) appended to the end of the event's title line — not on a separate line — to minimize vertical space per event:
- Each distinct location string found among the rendered month's events is assigned a number, ordered by descending frequency (the most-common location gets `[1]`); ties keep first-appearance order for determinism.
- A legend section lists each number next to its full location text, in that same frequency order.
- The `hideLocations` checkbox still hides the badge entirely (and its legend), same as it hid full location text before.

## Location Emoji Mapping

Optional, repeatable `locationEmoji=<pattern>:<emoji>` query params let the caller prepend an emoji to matching location badges (e.g. `&locationEmoji=church:⛪&locationEmoji=pizza:🍕`), without hardcoding any specific category into the renderer:
- `<pattern>` is a case-insensitive regex tested against the full location text; `<emoji>` is everything after the first `:` in the param value (so patterns can't themselves contain a `:`, an accepted limitation).
- Mappings are evaluated in the order given in the URL; the first pattern that matches a location wins (at most one emoji per location).
- An invalid regex pattern is logged to the console and skipped rather than breaking the render.
- The emoji renders prepended to the location badge in both the event line and the location legend (e.g. `⛪[1]`), and is omitted whenever `hideLocations=true` hides the badge itself.
- These params are preserved across all button-bar navigation (Prev/Next/Today/theme/checkboxes) in `interactive=true` mode, the same as `calendarId`/`tz`.

## Event Time Ranges

Timed (non-all-day) events show a start–end time range (e.g. `9:30 AM – 10:30 AM`) instead of just the start time. All-day events still show no time, as before.

## Legend Presentation

Both legends (tag colors, locations) are labeled and list one item per line rather than wrapping inline:
- The tag legend is headed "Tags:"; the location legend is headed "Locations:".
- Each entry (color swatch + tag, or `[n]` + address) renders on its own line beneath the label.
- Both legends render together in a fixed-width sidebar to the right of the calendar grid (rather than a horizontal strip above it), to save vertical space for the grid itself. The sidebar only renders when there's at least one legend to show (i.e. at least one tagged or located event that month); otherwise the grid uses the full width.

## Scrollbar Theming

Day cells that overflow (see Equal-Height Grid) get theme-aware scrollbar styling instead of the browser's default, so they blend into dark mode instead of showing a jarring light-colored default scrollbar:
- `scrollbar-width: thin` and `scrollbar-color` (Firefox) plus `::-webkit-scrollbar*` rules (Chrome/Safari/Edge), scoped under `.theme-dark` / `.theme-light` classes applied to the page root based on the `theme` param.
- Dark theme uses a muted gray thumb (`#5a5d63`) on a transparent track; light theme uses a lighter gray (`#c0c0c0`).

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
