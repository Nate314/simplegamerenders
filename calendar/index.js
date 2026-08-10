const CORS_PROXY = 'https://corsproxy.io/?url=';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

function getIcsUrl(calendarId) {
  const icalUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
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
              events.push({
                summary: event.summary,
                start: details.startDate.toJSDate(),
                isAllDay: details.startDate.isDate,
              });
            }
          }
        } else {
          const start = event.startDate.toJSDate();
          const dayKey = getDateKeyInTz(start, tz);
          if (dayKey.startsWith(monthKeyPrefix)) {
            events.push({ summary: event.summary, start, isAllDay: event.startDate.isDate });
          }
        }
      });

      return events;
    });
}

function renderButtonBar({ calendarId, tz, year, month, theme, interactive }) {
  if (!interactive) {
    return '';
  }
  const prev = formatMonthParam(addMonths({ year, month }, -1));
  const next = formatMonthParam(addMonths({ year, month }, 1));
  const otherTheme = theme === 'dark' ? 'light' : 'dark';
  const baseParams = `calendarId=${encodeURIComponent(calendarId)}&tz=${encodeURIComponent(tz)}&interactive=true`;

  return `
    <div class="btn-bar">
      <a class="btn btn-secondary btn-sm" href="?${baseParams}&month=${prev}&theme=${theme}">&#9664; Prev</a>
      <a class="btn btn-secondary btn-sm" href="?${baseParams}&month=${next}&theme=${theme}">Next &#9654;</a>
      <a class="btn btn-secondary btn-sm" href="?${baseParams}&month=${formatMonthParam({ year, month })}&theme=${otherTheme}">Toggle ${otherTheme === 'dark' ? '🌙' : '☀️'}</a>
    </div>
  `;
}

function renderCalendar({ calendarId, tz, year, month, theme, interactive, events }) {
  const backgroundColor = theme === 'light' ? '#FFFFFF' : '#36393F';
  const textColor = theme === 'light' ? '#000000' : '#FFFFFF';

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

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push('<td class="day-cell"></td>');
  }
  for (let day = 1; day <= totalDays; day++) {
    const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = (eventsByDay[dayKey] || []).sort((a, b) => a.start - b.start);
    const eventsHtml = dayEvents.map(event => `
      <div class="event">${event.isAllDay ? '' : `${getTimeInTz(event.start, tz)} `}${event.summary}</div>
    `).join('');
    cells.push(`
      <td class="day-cell">
        <div class="day-number">${day}</div>
        ${eventsHtml}
      </td>
    `);
  }
  while (cells.length % 7 !== 0) {
    cells.push('<td class="day-cell"></td>');
  }

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  }

  document.getElementById('content').innerHTML = `
    <div style="background: ${backgroundColor}; color: ${textColor}; min-height: 100vh; font-weight: 500;">
      ${renderButtonBar({ calendarId, tz, year, month, theme, interactive })}
      <div class="container-fluid py-2">
        <h4 class="text-center">${MONTH_NAMES[month - 1]} ${year}</h4>
        <table class="table-fixed" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>${DAY_NAMES.map(name => `<th class="day-cell">${name}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderError(message) {
  document.getElementById('content').innerHTML = `
    <div style="background: #36393F; color: #FFFFFF; min-height: 100vh; padding: 16px;">
      ${message}
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
  const { year, month } = getTargetYearMonth(params.month, params.tz);

  fetchEventsForMonth(params.calendarId, params.tz, year, month)
    .then(events => renderCalendar({
      calendarId: params.calendarId,
      tz: params.tz,
      year,
      month,
      theme,
      interactive,
      events,
    }))
    .catch(err => {
      console.error(err);
      renderError('Failed to load calendar. Is it public?');
    });
}
