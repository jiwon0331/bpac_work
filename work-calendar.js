import { calculateWorkSchedule, getKoreanDateParts, formatTime, WORK_TIME_ZONE } from './work-schedule.js';

function formatCalendarDate(date) {
  const p = getKoreanDateParts(date);
  // No Z suffix: these are Korean wall-clock values, paired with ctz below.
  return `${p.year.padStart(4, '0')}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}

export function buildGoogleCalendarUrl(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const { date, startTime, runtimeMinutes, place = '' } = input;
  if (typeof place !== 'string') return null;
  const schedule = calculateWorkSchedule({ date, startTime, runtimeMinutes });
  if (!schedule) return null;
  const runtime = Number(runtimeMinutes);

  const details = [
    `공연 시작시간: ${schedule.display.performanceStart}`,
    `러닝타임: ${runtime}분`,
    `공연 종료시간: ${schedule.display.performanceEnd}`,
    `총 근무시간: ${schedule.display.duration}`,
    `예상 급여: ${schedule.display.estimatedPay}`,
    `장소: ${place.trim()}`,
  ].join('\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${formatTime(schedule.arrival).replace(':', '')}-${formatTime(schedule.departure).replace(':', '')} 근무`,
    dates: `${formatCalendarDate(schedule.arrival)}/${formatCalendarDate(schedule.departure)}`,
    ctz: WORK_TIME_ZONE,
    details,
    location: place.trim(),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
