import { describe, it, expect } from 'vitest';
import { timeToMinutes, minutesToTime, addMinutes, addDays, isSlotAvailable } from '../server/helpers';

describe('Helpers - time utilities', () => {
  it('timeToMinutes converts correctly', () => {
    expect(timeToMinutes('08:00')).toBe(480);
    expect(timeToMinutes('14:30')).toBe(870);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('minutesToTime converts correctly', () => {
    expect(minutesToTime(480)).toBe('08:00');
    expect(minutesToTime(870)).toBe('14:30');
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(1439)).toBe('23:59');
  });

  it('round-trip timeToMinutes/minutesToTime', () => {
    const times = ['00:00', '08:00', '12:30', '23:59'];
    for (const t of times) {
      expect(minutesToTime(timeToMinutes(t))).toBe(t);
    }
  });

  it('addMinutes adds correctly', () => {
    expect(addMinutes('08:00', 30)).toBe('08:30');
    expect(addMinutes('23:30', 30)).toBe('00:00');
    expect(addMinutes('14:45', 15)).toBe('15:00');
  });
});

describe('Helpers - date utilities', () => {
  it('addDays works correctly', () => {
    expect(addDays('2026-07-05', 1)).toBe('2026-07-06');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-07-05', 0)).toBe('2026-07-05');
    expect(addDays('2026-07-05', -1)).toBe('2026-07-04');
  });
});

describe('Helpers - isSlotAvailable', () => {
  const doctor = {
    id: 'doc-1',
    name: 'Dr. Test',
    specialty: 'General',
    availableDays: ['Monday', 'Wednesday', 'Friday'],
    workingHours: { start: '08:00', end: '18:00' },
  };

  const appointments = [
    { id: 'apt-1', doctorId: 'doc-1', date: '2026-07-06', timeStart: '09:00', timeEnd: '09:30', status: 'agendado', patientName: 'João Silva' },
    { id: 'apt-2', doctorId: 'doc-1', date: '2026-07-06', timeStart: '10:00', timeEnd: '11:00', status: 'agendado', patientName: 'Maria Souza' },
  ] as any[];

  it('returns ok for available slot', () => {
    const result = isSlotAvailable(doctor as any, '2026-07-06', '11:00', '11:30', appointments);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('Horario disponivel.');
  });

  it('returns blocked for unavailable day', () => {
    const result = isSlotAvailable(doctor as any, '2026-07-07', '09:00', '09:30', appointments);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('nao atende');
  });

  it('returns blocked for outside working hours', () => {
    const result = isSlotAvailable(doctor as any, '2026-07-06', '07:00', '07:30', appointments);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('fora da grade');
  });

  it('returns blocked for overlapping appointment', () => {
    const result = isSlotAvailable(doctor as any, '2026-07-06', '08:30', '09:30', appointments);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Conflito com João Silva as 09:00.');
  });

  it('ignores cancelled appointments', () => {
    const apts = [
      { id: 'apt-3', doctorId: 'doc-1', date: '2026-07-06', timeStart: '09:00', timeEnd: '09:30', status: 'desmarcado', patientName: 'João Silva' },
    ] as any[];
    const result = isSlotAvailable(doctor as any, '2026-07-06', '09:00', '09:30', apts);
    expect(result.ok).toBe(true);
  });
});
