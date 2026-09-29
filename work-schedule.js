export const HOURLY_WAGE = 11700;
export const ARRIVAL_OFFSET_MINUTES = 80;
export const CLEANUP_MINUTES = 30;

const MINUTE_MS = 60_000;

export const WORK_TIME_ZONE = 'Asia/Seoul';

export function getKoreanDateParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: WORK_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter(part => part.type !== 'literal')
    .map(part => [part.type, part.value]));
}

// Inputs are Korean wall-clock time, independent of the browser's time zone.
function parseLocalStart(date, startTime) {
  if (typeof date !== 'string' || typeof startTime !== 'string') return null;
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeParts = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!dateParts || !timeParts) return null;

  const [, year, month, day] = dateParts.map(Number);
  const [, hour, minute] = timeParts.map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 ||
      hour > 23 || minute > 59) return null;

  const result = new Date(`${date}T${startTime}:00+09:00`);
  if (!Number.isFinite(result.getTime())) return null;
  const parts = getKoreanDateParts(result);
  // Reject impossible dates that Date silently normalizes.
  if (Number(parts.year) !== year || Number(parts.month) !== month ||
      Number(parts.day) !== day || Number(parts.hour) !== hour ||
      Number(parts.minute) !== minute) return null;
  return result;
}

export function formatTime(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
  const parts = getKoreanDateParts(date);
  return `${parts.hour}:${parts.minute}`;
}

export function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  const hours = Math.floor(minutes / 60);
  const remaining = Number((minutes % 60).toFixed(6));
  return `${hours}시간 ${remaining}분`;
}

export function calculateEstimatedPay(totalMinutes, hourlyWage = HOURLY_WAGE) {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0 ||
      !Number.isFinite(hourlyWage) || hourlyWage < 0) return null;
  const pay = Math.round(totalMinutes / 60 * hourlyWage);
  return Number.isSafeInteger(pay) ? pay : null;
}

export function formatCurrency(amount) {
  if (!Number.isFinite(amount) || amount < 0) return '';
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

export function calculateWorkSchedule(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const { date, startTime, runtimeMinutes } = input;
  if (typeof runtimeMinutes !== 'number' && typeof runtimeMinutes !== 'string') return null;
  if (typeof runtimeMinutes === 'string' && !/^\d+$/.test(runtimeMinutes.trim())) return null;
  const runtime = Number(runtimeMinutes);
  if (!Number.isSafeInteger(runtime) || runtime <= 0) return null;
  const performanceStart = parseLocalStart(date, startTime);
  if (!performanceStart) return null;

  const arrival = new Date(performanceStart.getTime() - ARRIVAL_OFFSET_MINUTES * MINUTE_MS);
  const performanceEnd = new Date(performanceStart.getTime() + runtime * MINUTE_MS);
  const departure = new Date(performanceEnd.getTime() + CLEANUP_MINUTES * MINUTE_MS);
  if (![arrival, performanceEnd, departure].every(value => Number.isFinite(value.getTime()))) return null;
  // Calendar template dates require a four-digit year.
  if (![arrival, performanceEnd, departure].every(value => {
    const year = Number(getKoreanDateParts(value).year);
    return year >= 1 && year <= 9999;
  })) return null;

  const totalMinutes = (departure.getTime() - arrival.getTime()) / MINUTE_MS;
  const estimatedPay = calculateEstimatedPay(totalMinutes);
  if (estimatedPay === null) return null;

  return {
    performanceStart,
    arrival,
    performanceEnd,
    departure,
    totalMinutes,
    estimatedPay,
    display: {
      performanceStart: formatTime(performanceStart),
      arrival: formatTime(arrival),
      performanceEnd: formatTime(performanceEnd),
      departure: formatTime(departure),
      duration: formatDuration(totalMinutes),
      estimatedPay: formatCurrency(estimatedPay),
    },
  };
}
