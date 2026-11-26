import { describe, expect, it } from 'vitest';
import { EXERCISES, type ExerciseId, type RepResult } from '@/lib/pose-engine';
import {
  REP_CSV_COLUMNS,
  SESSION_CSV_COLUMNS,
  THRESHOLDS_VERSION,
  buildRepLogCsvLines,
  buildSessionLogCsvLines,
  escapeCsvCell,
  finalizeCalibrationSession,
  formatCalibrationCsv,
  type CalibrationRepLog,
  type CalibrationSessionLog,
} from '@/lib/game/calibration';

/** Bộ tách dòng CSV tuân thủ RFC 4180 để kiểm tra chính xác số cột trong test. */
function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function makeMockRepResult(exercise: ExerciseId, idx: number, counted = true): RepResult {
  const def = EXERCISES[exercise];
  const durationMs = def.minRepMs + 450 + (idx % 4) * 180;
  const startT = idx * 4500;
  const shift = (idx % 5) * 0.04;
  const trajectory = Array.from({ length: 20 }, (_, k) => {
    const u = k / 19;
    return def.holdMs > 0
      ? Math.min(1.05, Math.max(0.2, 0.25 + u * 0.85 + Math.sin(u * 2 + shift) * 0.05))
      : Math.max(0, Math.sin(u * Math.PI) * (1.03 + shift));
  });

  return {
    exercise,
    startT,
    endT: startT + durationMs,
    durationMs,
    maxProgress: 1.04,
    holdMs: def.holdMs > 0 ? def.holdMs + 80 : 0,
    peakVelocity: 1.4,
    reversals: 1,
    quality: counted ? 0.92 : 0.4,
    trajectory,
    xp: counted ? Math.round(def.baseXp * 0.92) : 0,
    counted,
    flags: counted ? [] : ['TOO_FAST', 'NOT_DEEP_ENOUGH'],
  };
}

describe('F6a — Định dạng CSV và logic đóng phiên hiệu chỉnh', () => {
  it('Thoát đúng dấu phẩy, dấu ngoặc kép và ký tự xuống dòng trong ô CSV', () => {
    expect(escapeCsvCell('Long')).toBe('Long');
    expect(escapeCsvCell('Long, lớp IT2')).toBe('"Long, lớp IT2"');
    expect(escapeCsvCell('Bạn "A", bàn 2')).toBe('"Bạn ""A"", bàn 2"');
    expect(escapeCsvCell('Dòng 1\nDòng 2')).toBe('"Dòng 1\nDòng 2"');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('Xuất CSV nhật ký rep và nhật ký phiên đúng số cột, thoát dấu phẩy không làm lệch cột', () => {
    const repLog: CalibrationRepLog = {
      index: 1,
      sessionId: 1,
      timestampIso: '2026-11-26T12:00:00.000Z',
      tester: 'Long, "Ngồi bàn"',
      trialType: 'fast',
      exercise: 'side_bend',
      postureMode: 'seated',
      counted: false,
      flags: ['TOO_FAST', 'HOLD_TOO_SHORT'],
      peakMetric: 14.25,
      maxProgress: 1.25,
      durationMs: 920,
      holdMs: 350,
      peakVelocity: 4.12,
      reversals: 1,
      quality: 1,
      xp: 0,
    };

    const sessionLog: CalibrationSessionLog = {
      sessionId: 1,
      timestampIso: '2026-11-26T12:01:00.000Z',
      tester: 'Long, "Ngồi bàn"',
      trialType: 'fast',
      exercise: 'side_bend',
      postureMode: 'seated',
      durationMs: 12500,
      totalReps: 3,
      countedReps: 1,
      rejectedReps: 2,
      verdict: 'review',
      reasons: ['STATIC_SUBJECT'],
      analyzeScore: 0.3,
      analyzeFlags: ['UNIFORM_TEMPO'],
      guardVerdict: 'review',
      guardScore: 0.3,
      guardFlags: ['NOISY_REPS'],
      xp: 0,
    };

    const repLines = buildRepLogCsvLines([repLog]);
    expect(repLines).toHaveLength(2);
    expect(parseCsvRow(repLines[0])).toEqual([...REP_CSV_COLUMNS]);
    const parsedRep = parseCsvRow(repLines[1]);
    expect(parsedRep).toHaveLength(REP_CSV_COLUMNS.length);
    expect(parsedRep[4]).toBe('Long, "Ngồi bàn"');
    expect(parsedRep[9]).toBe('TOO_FAST|HOLD_TOO_SHORT');

    const sessionLines = buildSessionLogCsvLines([sessionLog]);
    expect(sessionLines).toHaveLength(2);
    expect(parseCsvRow(sessionLines[0])).toEqual([...SESSION_CSV_COLUMNS]);
    const parsedSession = parseCsvRow(sessionLines[1]);
    expect(parsedSession).toHaveLength(SESSION_CSV_COLUMNS.length);
    expect(parsedSession[3]).toBe('Long, "Ngồi bàn"');
    expect(parsedSession[11]).toBe('review');

    // Kiểm tra file CSV tổng hợp có dòng đầu ghi phiên bản ngưỡng hiện tại
    const fullCsv = formatCalibrationCsv([repLog], [sessionLog]);
    const allLines = fullCsv.split('\n');
    expect(allLines[0].startsWith('# ')).toBe(true);
    expect(allLines[0]).toContain(`version=${THRESHOLDS_VERSION}`);
    expect(allLines[1]).toBe(REP_CSV_COLUMNS.join(','));
    expect(allLines).toContain(SESSION_CSV_COLUMNS.join(','));
  });

  it('finalizeCalibrationSession gọi đúng analyzeReps và finalizeRun từ pose-engine.ts', () => {
    const reps = [
      makeMockRepResult('squat', 0, true),
      makeMockRepResult('squat', 1, true),
      makeMockRepResult('squat', 2, false),
    ];

    const { log, analysis, runResult } = finalizeCalibrationSession({
      sessionId: 7,
      timestampIso: '2026-11-26T12:10:00.000Z',
      tester: 'Minh',
      trialType: 'real',
      exercise: 'squat',
      postureMode: 'standing',
      durationMs: 18000,
      allReps: reps,
      guardResult: { verdict: 'verified', score: 0, flags: [] },
      xpAlreadyEarned: 0,
    });

    expect(log.totalReps).toBe(3);
    expect(log.countedReps).toBe(2);
    expect(log.rejectedReps).toBe(1);
    expect(log.verdict).toBe(runResult.verdict);
    expect(log.verdict).toBe('verified');
    expect(log.xp).toBe(runResult.xp);
    expect(log.xp).toBeGreaterThan(0);
    expect(log.analyzeScore).toBe(analysis.score);
    expect(log.analyzeFlags).toEqual(analysis.flags);
  });
});