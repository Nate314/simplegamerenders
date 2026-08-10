const CORS_PROXY = 'https://corsproxy.io/?url=';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const TAG_COLORS = ['#e67e22', '#9b59b6', '#1abc9c', '#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#95a5a6'];
const TAG_PATTERN = /^\[([^\]]+)\]\s*/;

function getParams(url) {
  const params = {};
  const parser = document.createElement('a');
  parser.href = url;
  const query = parser.search.substring(1);
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    if (pair[0]) {
      params[pair[0]] = decodeURIComponent(pair[1] || '');
    }
  }
  return params;
}

function isAllDefined(list) {
  return list.every(x => x !== undefined && x !== '');
}

function getAllParamValues(url, key) {
  const parser = document.createElement('a');
  parser.href = url;
  const query = parser.search.substring(1);
  return query.split('&')
    .map(pair => pair.split('='))
    .filter(pair => pair[0] === key)
    .map(pair => decodeURIComponent(pair[1] || ''));
}

function getRawParamString(url, key) {
  const parser = document.createElement('a');
  parser.href = url;
  const query = parser.search.substring(1);
  return query.split('&')
    .filter(pair => pair.split('=')[0] === key)
    .map(pair => `&${pair}`)
    .join('');
}

function parseLocationEmojiMappings(url) {
  return getAllParamValues(url, 'locationEmoji')
    .map(value => {
      const separatorIndex = value.indexOf(':');
      if (separatorIndex === -1) {
        return null;
      }
      const pattern = value.slice(0, separatorIndex);
      const emoji = value.slice(separatorIndex + 1);
      try {
        return { regex: new RegExp(pattern, 'i'), emoji };
      } catch (err) {
        console.error('Invalid locationEmoji pattern:', pattern, err);
        return null;
      }
    })
    .filter(mapping => mapping !== null);
}

function getLocationEmoji(location, mappings) {
  if (!location) {
    return '';
  }
  const match = mappings.find(mapping => mapping.regex.test(location));
  return match ? match.emoji : '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

const CACHE_BUST_WINDOW_MS = 5 * 60 * 1000;

function getIcsUrl(calendarId) {
  // corsproxy.io caches responses by URL for up to an hour regardless of
  // Google's own freshness, so a cache-busting param is needed to avoid
  // serving a stale feed that's missing recently added/edited events.
  // Bucketed to a 5-minute window rather than a per-request timestamp, so
  // repeated requests within the window still benefit from proxy caching.
  const cacheBucket = Math.floor(Date.now() / CACHE_BUST_WINDOW_MS);
  const icalUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics?_=${cacheBucket}`;
  return `${CORS_PROXY}${encodeURIComponent(icalUrl)}`;
}

function getDateKeyInTz(date, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getTimeInTz(date, tz) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getTargetYearMonth(monthParam, tz) {
  if (monthParam) {
    const [year, month] = monthParam.split('-').map(Number);
    return { year, month };
  }
  const todayKey = getDateKeyInTz(new Date(), tz);
  const [year, month] = todayKey.split('-').map(Number);
  return { year, month };
}

function addMonths({ year, month }, delta) {
  const total = (month - 1) + delta;
  const newYear = year + Math.floor(total / 12);
  const newMonth = ((total % 12) + 12) % 12 + 1;
  return { year: newYear, month: newMonth };
}

function formatMonthParam({ year, month }) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function splitTag(summary) {
  const match = TAG_PATTERN.exec(summary || '');
  if (!match) {
    return { tag: null, title: summary || '' };
  }
  return { tag: match[1], title: summary.slice(match[0].length) };
}

function toEventRecord(summary, location, description, start, end, isAllDay) {
  const { tag, title } = splitTag(summary);
  return { tag, title, location, description, start, end, isAllDay };
}

function fetchEventsForMonth(calendarId, tz, year, month) {
  return fetch(getIcsUrl(calendarId))
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`Failed to fetch calendar (status ${resp.status})`);
      }
      return resp.text();
    })
    .then(icsText => {
      const jcalData = ICAL.parse(icsText);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');

      const monthKeyPrefix = `${year}-${String(month).padStart(2, '0')}`;
      const rangeStart = new Date(Date.UTC(year, month - 1, 1));
      const rangeEnd = new Date(Date.UTC(year, month, 1));
      const events = [];

      vevents.forEach(vevent => {
        const event = new ICAL.Event(vevent);

        // Recurrence exceptions (overridden instances) are already accounted
        // for by their master event's iterator via event.getOccurrenceDetails,
        // so processing them again here would produce duplicates.
        if (event.isRecurrenceException()) {
          return;
        }

        if (event.isRecurring()) {
          const iterator = event.iterator();
          let next;
          let count = 0;
          while ((next = iterator.next()) && count < 2000) {
            count += 1;
            const occurrenceStart = next.toJSDate();
            if (occurrenceStart >= rangeEnd) {
              break;
            }
            if (occurrenceStart >= rangeStart) {
              const details = event.getOccurrenceDetails(next);
              events.push(toEventRecord(
                details.item.summary,
                details.item.location,
                details.item.description,
                details.startDate.toJSDate(),
                details.endDate.toJSDate(),
                details.startDate.isDate,
              ));
            }
          }
        } else {
          const start = event.startDate.toJSDate();
          const dayKey = getDateKeyInTz(start, tz);
          if (dayKey.startsWith(monthKeyPrefix)) {
            events.push(toEventRecord(
              event.summary,
              event.location,
              event.description,
              start,
              event.endDate.toJSDate(),
              event.startDate.isDate,
            ));
          }
        }
      });

      return events;
    });
}

function assignTagColors(events) {
  const colorsByTag = {};
  events.forEach(event => {
    if (event.tag && !colorsByTag[event.tag]) {
      const index = Object.keys(colorsByTag).length % TAG_COLORS.length;
      colorsByTag[event.tag] = TAG_COLORS[index];
    }
  });
  return colorsByTag;
}

function assignLocationNumbers(events) {
  const firstSeenOrder = [];
  const countsByLocation = {};
  events.forEach(event => {
    if (!event.location) {
      return;
    }
    if (!countsByLocation[event.location]) {
      countsByLocation[event.location] = 0;
      firstSeenOrder.push(event.location);
    }
    countsByLocation[event.location] += 1;
  });

  // Most-frequent locations get the lowest numbers; ties keep first-appearance order.
  const sortedLocations = firstSeenOrder.slice().sort((a, b) => countsByLocation[b] - countsByLocation[a]);

  const numbersByLocation = {};
  sortedLocations.forEach((location, index) => {
    numbersByLocation[location] = index + 1;
  });
  return numbersByLocation;
}

function renderButtonBar({ calendarId, tz, year, month, theme, interactive, showDescriptions, hideLocations, todayYearMonth, rawLocationEmojiParams }) {
  if (!interactive) {
    return '';
  }
  const prev = formatMonthParam(addMonths({ year, month }, -1));
  const next = formatMonthParam(addMonths({ year, month }, 1));
  const otherTheme = theme === 'dark' ? 'light' : 'dark';
  const currentMonth = formatMonthParam({ year, month });
  const todayMonth = formatMonthParam(todayYearMonth);
  const baseParams = `calendarId=${encodeURIComponent(calendarId)}&tz=${encodeURIComponent(tz)}&interactive=true${rawLocationEmojiParams}`;
  const isOnCurrentMonth = currentMonth === todayMonth;

  const toggleFlags = showDescriptions || hideLocations
    ? `${showDescriptions ? '&showDescriptions=true' : ''}${hideLocations ? '&hideLocations=true' : ''}`
    : '';
  const buildUrl = (monthValue, themeValue) => `?${baseParams}&month=${monthValue}&theme=${themeValue}${toggleFlags}`;

  const todayButtonHtml = isOnCurrentMonth ? '' : `
      <a class="btn btn-secondary btn-sm" href="${buildUrl(todayMonth, theme)}">Today</a>
  `;

  return `
    <div class="btn-bar">
      <a class="btn btn-secondary btn-sm" href="${buildUrl(prev, theme)}">&#9664; Prev</a>
      <a class="btn btn-secondary btn-sm" href="${buildUrl(next, theme)}">Next &#9654;</a>
      ${todayButtonHtml}
      <a class="btn btn-secondary btn-sm" href="${buildUrl(currentMonth, otherTheme)}">Toggle ${otherTheme === 'dark' ? '🌙' : '☀️'}</a>
      <a class="btn btn-secondary btn-sm" href="?${baseParams}&month=${currentMonth}&theme=${theme}${hideLocations ? '&hideLocations=true' : ''}${showDescriptions ? '' : '&showDescriptions=true'}">
        <input type="checkbox" ${showDescriptions ? 'checked' : ''} disabled /> Show descriptions
      </a>
      <a class="btn btn-secondary btn-sm" href="?${baseParams}&month=${currentMonth}&theme=${theme}${showDescriptions ? '&showDescriptions=true' : ''}${hideLocations ? '' : '&hideLocations=true'}">
        <input type="checkbox" ${hideLocations ? 'checked' : ''} disabled /> Hide locations
      </a>
    </div>
  `;
}

function renderLegend(colorsByTag) {
  const tags = Object.keys(colorsByTag);
  if (!tags.length) {
    return '';
  }
  return `
    <div class="legend">
      <div class="legend-label">Tags:</div>
      ${tags.map(tag => `
        <div class="legend-item">
          <span class="legend-swatch" style="background: ${colorsByTag[tag]};"></span>${escapeHtml(tag)}
        </div>
      `).join('')}
    </div>
  `;
}

function renderLocationLegend(numbersByLocation, hideLocations, locationEmojiMappings) {
  const locations = Object.keys(numbersByLocation);
  if (hideLocations || !locations.length) {
    return '';
  }
  const sorted = locations.sort((a, b) => numbersByLocation[a] - numbersByLocation[b]);
  return `
    <div class="legend">
      <div class="legend-label">Locations:</div>
      ${sorted.map(location => `
        <div class="legend-item">${getLocationEmoji(location, locationEmojiMappings)}[${numbersByLocation[location]}] ${escapeHtml(location)}</div>
      `).join('')}
    </div>
  `;
}

function renderEvent(event, tz, colorsByTag, numbersByLocation, showDescriptions, hideLocations, locationEmojiMappings) {
  const color = event.tag ? colorsByTag[event.tag] : null;
  const style = color ? ` style="color: ${color}; border-left: 2px solid ${color};"` : '';
  const timePrefix = event.isAllDay ? '' : `${getTimeInTz(event.start, tz)} – ${getTimeInTz(event.end, tz)} — `;
  const locationSuffix = (!hideLocations && event.location)
    ? ` ${getLocationEmoji(event.location, locationEmojiMappings)}[${numbersByLocation[event.location]}]`
    : '';
  const descriptionHtml = (showDescriptions && event.description) ? `<div class="event-detail">${escapeHtml(event.description)}</div>` : '';

  return `
    <div class="event"${style}>
      <div class="event-title">${timePrefix}${escapeHtml(event.title)}${escapeHtml(locationSuffix)}</div>
      ${descriptionHtml}
    </div>
  `;
}

function renderCalendar({ calendarId, tz, year, month, theme, interactive, showDescriptions, hideLocations, locationEmojiMappings, events }) {
  const backgroundColor = theme === 'light' ? '#FFFFFF' : '#36393F';
  const textColor = theme === 'light' ? '#000000' : '#FFFFFF';
  const colorsByTag = assignTagColors(events);
  const numbersByLocation = assignLocationNumbers(events);

  const eventsByDay = {};
  events.forEach(event => {
    const dayKey = getDateKeyInTz(event.start, tz);
    if (!eventsByDay[dayKey]) {
      eventsByDay[dayKey] = [];
    }
    eventsByDay[dayKey].push(event);
  });

  const totalDays = daysInMonth(year, month);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const totalCells = firstWeekday + totalDays;
  const numWeeks = Math.ceil(totalCells / 7);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push('<div class="day-cell"></div>');
  }
  const todayKey = interactive ? getDateKeyInTz(new Date(), tz) : null;
  for (let day = 1; day <= totalDays; day++) {
    const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = (eventsByDay[dayKey] || []).sort((a, b) => a.start - b.start);
    const eventsHtml = dayEvents.map(event => renderEvent(event, tz, colorsByTag, numbersByLocation, showDescriptions, hideLocations, locationEmojiMappings)).join('');
    const isToday = dayKey === todayKey;
    cells.push(`
      <div class="day-cell${isToday ? ' day-cell-today' : ''}">
        <div class="day-number">${day}</div>
        ${eventsHtml}
      </div>
    `);
  }
  while (cells.length < numWeeks * 7) {
    cells.push('<div class="day-cell"></div>');
  }

  const legendsHtml = `${renderLegend(colorsByTag)}${renderLocationLegend(numbersByLocation, hideLocations, locationEmojiMappings)}`;
  const sidebarHtml = legendsHtml ? `<div class="legend-sidebar">${legendsHtml}</div>` : '';

  document.getElementById('content').innerHTML = `
    <div class="calendar-page theme-${theme}" style="background: ${backgroundColor}; color: ${textColor};">
      ${renderButtonBar({ calendarId, tz, year, month, theme, interactive, showDescriptions, hideLocations, todayYearMonth: getTargetYearMonth(null, tz), rawLocationEmojiParams: getRawParamString(location.href, 'locationEmoji') })}
      <h4 class="text-center month-title">${MONTH_NAMES[month - 1]} ${year}</h4>
      <div class="main-area">
        <div class="calendar-grid" style="grid-template-rows: auto repeat(${numWeeks}, 1fr);">
          ${DAY_NAMES.map(name => `<div class="day-header">${name}</div>`).join('')}
          ${cells.join('')}
        </div>
        ${sidebarHtml}
      </div>
    </div>
  `;
}

function renderError(message) {
  document.getElementById('content').innerHTML = `
    <div style="background: #36393F; color: #FFFFFF; min-height: 100vh; padding: 16px;">
      ${escapeHtml(message)}
    </div>
  `;
}

const params = getParams(location.href);
console.log('params', params);

if (!isAllDefined([params.calendarId, params.tz])) {
  renderError('Missing required query params: calendarId, tz');
} else {
  const theme = params.theme === 'light' ? 'light' : 'dark';
  const interactive = params.interactive === 'true';
  const showDescriptions = interactive && params.showDescriptions === 'true';
  const hideLocations = interactive && params.hideLocations === 'true';
  const locationEmojiMappings = parseLocationEmojiMappings(location.href);
  const { year, month } = getTargetYearMonth(params.month, params.tz);

  fetchEventsForMonth(params.calendarId, params.tz, year, month)
    .then(events => renderCalendar({
      calendarId: params.calendarId,
      tz: params.tz,
      year,
      month,
      locationEmojiMappings,
      theme,
      interactive,
      showDescriptions,
      hideLocations,
      events,
    }))
    .catch(err => {
      console.error(err);
      renderError('Failed to load calendar. Is it public?');
    });
}
