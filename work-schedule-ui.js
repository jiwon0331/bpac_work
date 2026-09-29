import { calculateWorkSchedule, formatTime, getKoreanDateParts, formatDuration, formatCurrency } from './work-schedule.js';
import { buildGoogleCalendarUrl } from './work-calendar.js';
import { STORAGE_KEY, parseStartTime, createWorkRecord, loadRecords, saveRecords, recordsForMonth, summarizeRecords } from './work-records.js';

const section = document.querySelector('.work-schedule');

// Date labels keep a previous-day arrival or next-day departure unambiguous.
function timeWithDate(value, performanceStart) {
  const day = getKoreanDateParts(value);
  const start = getKoreanDateParts(performanceStart);
  const sameDay = day.year === start.year && day.month === start.month && day.day === start.day;
  return sameDay ? formatTime(value) :
    `${day.year}.${Number(day.month)}.${Number(day.day)} ${formatTime(value)}`;
}

if (section) {
  const form = section.querySelector('.work-form');
  const empty = section.querySelector('.work-empty');
  const result = section.querySelector('.work-result');
  const placeOutput = section.querySelector('.work-place');
  const calendarNote = section.querySelector('#work-calendar-note');
  const calendarHint = '한국 시간 기준으로 Google Calendar 일정 작성 화면을 새 탭에서 엽니다.';
  const calendarButton = section.querySelector('#work-calendar-button');
  const saveStatus = section.querySelector('#work-save-status');
  const monthField = section.querySelector('#work-month');
  let records = [];
  const dateField = form.elements.namedItem('date');
  if (!dateField.value) {
    const today = getKoreanDateParts(new Date());
    dateField.value = `${today.year}-${today.month}-${today.day}`;
  }
  monthField.value = dateField.value.slice(0, 7);

  function readInput() {
    const fields = form.elements;
    return {
      date: fields.namedItem('date').value,
      startTime: parseStartTime(fields.namedItem('startHour').value, fields.namedItem('startMinute').value),
      runtimeMinutes: fields.namedItem('runtimeMinutes').value,
      place: fields.namedItem('place').value.trim(),
    };
  }

  function renderRecords() {
    const monthly = recordsForMonth(records, monthField.value);
    const totals = summarizeRecords(monthly);
    section.querySelector('#work-count').textContent = `${totals.count}회`;
    section.querySelector('#work-total-time').textContent = formatDuration(totals.minutes);
    section.querySelector('#work-total-pay').textContent = formatCurrency(totals.pay);
    section.querySelector('#work-records-empty').hidden = monthly.length > 0;
    const list = section.querySelector('.work-record-list');
    list.replaceChildren();
    for (const record of monthly) {
      const item = document.createElement('li');
      const heading = document.createElement('strong');
      heading.textContent = `${record.date} · 공연 ${record.startTime}`;
      item.append(heading);
      const start = new Date(`${record.date}T${record.startTime}:00+09:00`);
      const details = document.createElement('p');
      details.textContent = `출근 ${timeWithDate(new Date(record.arrival), start)} → 퇴근 ${timeWithDate(new Date(record.departure), start)}`;
      item.append(details);
      const summary = document.createElement('p');
      summary.className = 'work-record-total';
      summary.textContent = `${formatDuration(record.totalMinutes)} · ${formatCurrency(record.estimatedPay)}`;
      item.append(summary);
      if (record.place) {
        const place = document.createElement('p');
        place.className = 'work-muted';
        place.textContent = record.place;
        item.append(place);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'work-delete';
      remove.dataset.recordId = record.id;
      remove.textContent = '삭제';
      remove.setAttribute('aria-label', `${record.date} ${record.startTime} 근무 기록 삭제`);
      item.append(remove);
      list.append(item);
    }
  }

  function refreshRecords() {
    try {
      records = loadRecords(window.localStorage);
      renderRecords();
    } catch {
      saveStatus.textContent = '저장된 기록을 읽을 수 없습니다. 브라우저 저장소 설정을 확인해 주세요. 기존 데이터는 변경하지 않았습니다.';
    }
  }

  function updatePreview() {
    const fields = form.elements;
    const schedule = form.checkValidity() ? calculateWorkSchedule(readInput()) : null;

    calendarButton.disabled = !schedule;
    calendarNote.textContent = schedule ? calendarHint : '날짜, 시작시간과 1분 이상의 러닝타임을 입력하면 버튼이 활성화됩니다.';
    empty.hidden = Boolean(schedule);
    result.hidden = !schedule;
    if (!schedule) return;

    const start = schedule.performanceStart;
    const values = {
      arrival: timeWithDate(schedule.arrival, start),
      performance: `${formatTime(start)} ~ ${timeWithDate(schedule.performanceEnd, start)}`,
      departure: timeWithDate(schedule.departure, start),
      duration: schedule.display.duration,
      pay: schedule.display.estimatedPay,
    };
    for (const [key, value] of Object.entries(values)) {
      section.querySelector(`[data-work="${key}"]`).textContent = value;
    }
    const place = fields.namedItem('place').value.trim();
    placeOutput.textContent = place ? `장소: ${place}` : '';
    placeOutput.hidden = !place;
  }

  const hourField = form.elements.namedItem('startHour');
  const minuteField = form.elements.namedItem('startMinute');
  for (const [field, maximum] of [[hourField, 23], [minuteField, 59]]) {
    const handleTimeInput = event => {
      if (event.isComposing) return;
      field.value = field.value.replace(/[^0-9]/g, '').slice(0, 2);
      field.setCustomValidity(Number(field.value) > maximum ? `0~${maximum} 사이의 숫자를 입력해 주세요.` : '');
      // Backspace must not immediately send focus forward again.
      if (field !== hourField || event.inputType?.startsWith('delete')) { updatePreview(); return; }
      if (/^[3-9]$/.test(field.value)) field.value = field.value.padStart(2, '0');
      if (/^\d{2}$/.test(field.value) && Number(field.value) <= maximum) {
        minuteField.focus();
        minuteField.select();
      }
      updatePreview();
    };
    field.addEventListener('input', handleTimeInput);
    field.addEventListener('compositionend', handleTimeInput);
    field.addEventListener('change', handleTimeInput);
    field.addEventListener('blur', () => {
      if (/^\d$/.test(field.value)) field.value = field.value.padStart(2, '0');
      field.setCustomValidity(Number(field.value) > maximum ? `0~${maximum} 사이의 숫자를 입력해 주세요.` : '');
      updatePreview();
    });
  }
  minuteField.addEventListener('keydown', event => {
    if (event.key === 'Backspace' && minuteField.value === '') {
      event.preventDefault();
      hourField.focus();
      hourField.select();
    }
  });
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  form.addEventListener('submit', event => event.preventDefault());
  monthField.addEventListener('input', renderRecords);
  calendarButton.addEventListener('click', () => {
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const input = readInput();
    const record = createWorkRecord(input);
    const calendarUrl = buildGoogleCalendarUrl(input);
    if (!record || !calendarUrl) return;
    try {
      const latest = loadRecords(window.localStorage);
      const duplicate = latest.some(item => item.date === record.date && item.startTime === record.startTime && item.runtimeMinutes === record.runtimeMinutes && item.place === record.place);
      const next = duplicate ? latest : [...latest, record];
      if (!duplicate) saveRecords(window.localStorage, next);
      records = next;
      monthField.value = record.date.slice(0, 7);
      renderRecords();
      saveStatus.textContent = '앱에 기록이 저장되어 있습니다. 열린 Google Calendar 화면에서 일정을 저장해 주세요.';
      window.open(calendarUrl, '_blank', 'noopener,noreferrer');
    } catch {
      saveStatus.textContent = '저장하지 못했습니다. 브라우저 저장소 설정이나 여유 공간을 확인해 주세요.';
    }
  });
  section.querySelector('.work-record-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-record-id]');
    if (!button || !window.confirm('이 근무 기록을 삭제할까요? Google Calendar 일정은 변경되지 않습니다.')) return;
    try {
      const next = loadRecords(window.localStorage).filter(record => record.id !== button.dataset.recordId);
      saveRecords(window.localStorage, next);
      records = next;
      renderRecords();
      saveStatus.textContent = '근무 기록을 삭제했습니다.';
    } catch {
      saveStatus.textContent = '삭제하지 못했습니다. 기존 기록을 유지합니다.';
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) { refreshRecords(); updatePreview(); }
  });

  refreshRecords();
  updatePreview();
}
