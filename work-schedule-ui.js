import { calculateWorkSchedule, formatTime, getKoreanDateParts } from './work-schedule.js';
import { buildGoogleCalendarUrl } from './work-calendar.js';

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
  const calendarButton = section.querySelector('.work-calendar');
  const dateField = form.elements.namedItem('date');
  if (!dateField.value) {
    const today = getKoreanDateParts(new Date());
    dateField.value = `${today.year}-${today.month}-${today.day}`;
  }

  function updatePreview() {
    const fields = form.elements;
    const runtime = fields.namedItem('runtimeMinutes');
    const schedule = form.checkValidity() ? calculateWorkSchedule({
      date: fields.namedItem('date').value,
      startTime: fields.namedItem('startTime').value,
      runtimeMinutes: runtime.value,
    }) : null;

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

  form.addEventListener('input', updatePreview);
  form.addEventListener('submit', event => event.preventDefault());
  calendarButton.addEventListener('click', () => {
    const fields = form.elements;
    const calendarUrl = buildGoogleCalendarUrl({
      date: fields.namedItem('date').value,
      startTime: fields.namedItem('startTime').value,
      runtimeMinutes: fields.namedItem('runtimeMinutes').value,
      place: fields.namedItem('place').value,
    });
    if (!form.checkValidity() || !calendarUrl) {
      calendarNote.textContent = '날짜, 시작시간과 1분 이상의 러닝타임을 올바르게 입력해 주세요.';
      calendarButton.disabled = true;
      form.reportValidity();
      return;
    }
    window.open(calendarUrl, '_blank', 'noopener,noreferrer');
  });
  updatePreview();
}
