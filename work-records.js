import { HOURLY_WAGE, calculateWorkSchedule } from './work-schedule.js';

export const STORAGE_KEY = 'performanceWork.records.v1';

export function parseStartTime(hour, minute) {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;
  if (Number(hour) > 23 || Number(minute) > 59) return null;
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function createWorkRecord(input) {
  const schedule = calculateWorkSchedule(input);
  if (!schedule) return null;
  return {
    id: crypto.randomUUID(),
    date: input.date,
    startTime: input.startTime,
    runtimeMinutes: Number(input.runtimeMinutes),
    place: (input.place || '').trim(),
    hourlyWage: HOURLY_WAGE,
    arrival: schedule.arrival.toISOString(),
    departure: schedule.departure.toISOString(),
    totalMinutes: schedule.totalMinutes,
    estimatedPay: schedule.estimatedPay,
    createdAt: new Date().toISOString(),
  };
}

function validRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const inputValid = calculateWorkSchedule(record);
  return Boolean(inputValid) && typeof record.id === 'string' && record.id.length > 0 &&
    typeof record.place === 'string' &&
    ['arrival', 'departure', 'createdAt'].every(key => typeof record[key] === 'string' && Number.isFinite(Date.parse(record[key]))) &&
    Number.isSafeInteger(record.totalMinutes) && record.totalMinutes > 0 &&
    Number.isFinite(record.hourlyWage) && record.hourlyWage >= 0 &&
    Number.isSafeInteger(record.estimatedPay) && record.estimatedPay >= 0 &&
    (Date.parse(record.departure) - Date.parse(record.arrival)) / 60000 === record.totalMinutes &&
    Math.round(record.totalMinutes / 60 * record.hourlyWage) === record.estimatedPay;
}

// Fail without overwriting damaged or unsupported stored data.
export function loadRecords(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.records) || !data.records.every(validRecord) ||
      new Set(data.records.map(record => record.id)).size !== data.records.length) {
    throw new Error('Invalid work records');
  }
  return data.records;
}

export function saveRecords(storage, records) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records }));
}

export function recordsForMonth(records, month) {
  return records.filter(record => record.date.slice(0, 7) === month)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.createdAt.localeCompare(b.createdAt));
}

export function summarizeRecords(records) {
  return records.reduce((total, record) => ({
    count: total.count + 1,
    minutes: total.minutes + record.totalMinutes,
    pay: total.pay + record.estimatedPay,
  }), { count: 0, minutes: 0, pay: 0 });
}
