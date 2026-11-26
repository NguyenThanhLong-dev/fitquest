/**
 * Logic thuần TypeScript cho Công cụ hiệu chỉnh (Task F6a).
 * - KHÔNG đổi bất kỳ ngưỡng nào trong pose-engine.ts.
 * - KHÔNG phụ thuộc React / DOM, không dùng localStorage, không gửi mạng.
 */
import {
  CONFIG,
  EXERCISES,
  THRESHOLDS,
  analyzeReps,
  finalizeRun,
  type Analysis,
  type ExerciseId,
  type RepResult,
  type RepSummary,
  type RunResult,
  type Verdict,
} from '@/lib/pose-engine';
import type { PostureMode } from '@/lib/game/engineAdapter';

/**
 * Hằng số bật/tắt trang /calibrate và đường dẫn nhỏ trong bảng Debug của /play.
 * Đặt về `false` để ẩn hoàn toàn công cụ hiệu chỉnh sau khi xong đợt thu số liệu.
 */
export const CALIBRATION_MODE = true;

/** Định danh phiên bản bộ ngưỡng hiện tại (chỉ đọc từ THRESHOLDS & CONFIG của pose-engine.ts). */
export const THRESHOLDS_VERSION = 'fitquest-thresholds-v1-baseline';

/** 6 kiểu thử nghiệm: 1 kiểu tập thật + 5 kịch bản kiểm thử gian lận / biên. */
export type TrialType = 'real' | 'photo' | 'video' | 'fast' | 'half' | 'still';

export const ALL_TRIAL_TYPES: readonly TrialType[] = [
  'real',
  'photo',
  'video',
  'fast',
  'half',
  'still',
] as const;

export const CHEAT_TRIAL_TYPES: readonly Exclude<TrialType, 'real'>[] = [
  'photo',
  'video',
  'fast',
  'half',
  'still',
] as const;

/** Một dòng nhật ký rep lưu tạm trong RAM. */
export interface CalibrationRepLog {
  index: number;
  sessionId: number;
  timestampIso: string;
  tester: string;
  trialType: TrialType;
  exercise: ExerciseId;
  postureMode: PostureMode;
  counted: boolean;
  flags: string[];
  /** Giá trị đo thực tế ở đỉnh rep (góc ° cho side_bend/neck_tilt, tỷ lệ cho các bài còn lại). */
  peakMetric: number | null;
  maxProgress: number;
  durationMs: number;
  holdMs: number;
  peakVelocity: number;
  reversals: number;
  quality: number;
  xp: number;
}

/** Một dòng nhật ký phiên sau khi gọi finalizeRun() lưu tạm trong RAM. */
export interface CalibrationSessionLog {
  sessionId: number;
  timestampIso: string;
  tester: string;
  trialType: TrialType;
  exercise: ExerciseId;
  postureMode: PostureMode;
  durationMs: number;
  totalReps: number;
  countedReps: number;
  rejectedReps: number;
  verdict: Verdict;
  reasons: string[];
  analyzeScore: number;
  analyzeFlags: string[];
  guardVerdict: Verdict;
  guardScore: number;
  guardFlags: string[];
  xp: number;
}

export const REP_CSV_COLUMNS = [
  'record_type',
  'index',
  'session_id',
  'timestamp_iso',
  'tester',
  'trial_type',
  'exercise',
  'posture_mode',
  'counted',
  'flags',
  'peak_metric',
  'max_progress',
  'duration_ms',
  'hold_ms',
  'peak_velocity',
  'reversals',
  'quality',
  'xp',
] as const;

export const SESSION_CSV_COLUMNS = [
  'record_type',
  'session_id',
  'timestamp_iso',
  'tester',
  'trial_type',
  'exercise',
  'posture_mode',
  'duration_ms',
  'total_reps',
  'counted_reps',
  'rejected_reps',
  'verdict',
  'reasons',
  'analyze_score',
  'analyze_flags',
  'guard_verdict',
  'guard_score',
  'guard_flags',
  'xp',
] as const;

/** Chuỗi chữ ký phiên bản ngưỡng hiện hành (đọc trực tiếp từ THRESHOLDS và CONFIG). */
export function buildThresholdVersionHeader(): string {
  const summary = [
    `version=${THRESHOLDS_VERSION}`,
    `squat=${THRESHOLDS.SQUAT_REST}->${THRESHOLDS.SQUAT_PEAK}(${THRESHOLDS.SQUAT_MIN_REP_MS}ms)`,
    `overhead=${THRESHOLDS.OVERHEAD_REST}->${THRESHOLDS.OVERHEAD_PEAK}(hold=${THRESHOLDS.OVERHEAD_HOLD_MS}ms)`,
    `side_bend=${THRESHOLDS.SIDE_BEND_REST_DEG}->${THRESHOLDS.SIDE_BEND_PEAK_DEG}deg(hold=${THRESHOLDS.SIDE_BEND_HOLD_MS}ms)`,
    `neck_tilt=${THRESHOLDS.NECK_TILT_REST_DEG}->${THRESHOLDS.NECK_TILT_PEAK_DEG}deg(hold=${THRESHOLDS.NECK_TILT_HOLD_MS}ms)`,
    `high_knees=${THRESHOLDS.HIGH_KNEES_REST}->${THRESHOLDS.HIGH_KNEES_PEAK}(${THRESHOLDS.HIGH_KNEES_MIN_REP_MS}ms)`,
    `minQuality=${CONFIG.minQuality}`,
    `emaAlpha=${CONFIG.emaAlpha}`,
    `staticStd=${CONFIG.staticStd}`,
    `loopRmse=${CONFIG.loopRmse}`,
    `uniformCv=${CONFIG.uniformCv}`,
    `xpCap=${CONFIG.xpCap}`,
  ].join('; ');

  return `# ${summary}`;
}

/** Thoát chuỗi chuẩn RFC 4180 cho 1 ô CSV (xử lý dấu phẩy, dấu ngoặc kép và xuống dòng). */
export function escapeCsvCell(
  value: string | number | boolean | null | undefined
): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Ghép một mảng giá trị thành đúng 1 dòng CSV. */
export function toCsvRow(
  cells: ReadonlyArray<string | number | boolean | null | undefined>
): string {
  return cells.map(escapeCsvCell).join(',');
}

/** Xuất bảng nhật ký rep sang mảng dòng CSV (gồm dòng tiêu đề + dữ liệu). */
export function buildRepLogCsvLines(
  reps: readonly CalibrationRepLog[]
): string[] {
  const lines: string[] = [toCsvRow(REP_CSV_COLUMNS)];

  for (const r of reps) {
    lines.push(
      toCsvRow([
        'rep',
        r.index,
        r.sessionId,
        r.timestampIso,
        r.tester,
        r.trialType,
        r.exercise,
        r.postureMode,
        r.counted ? 'true' : 'false',
        r.flags.join('|'),
        r.peakMetric !== null ? Number(r.peakMetric.toFixed(3)) : '',
        Number(r.maxProgress.toFixed(3)),
        Math.round(r.durationMs),
        Math.round(r.holdMs),
        Number(r.peakVelocity.toFixed(3)),
        r.reversals,
        Number(r.quality.toFixed(3)),
        r.xp,
      ])
    );
  }

  return lines;
}

/** Xuất bảng nhật ký phiên sang mảng dòng CSV (gồm dòng tiêu đề + dữ liệu). */
export function buildSessionLogCsvLines(
  sessions: readonly CalibrationSessionLog[]
): string[] {
  const lines: string[] = [toCsvRow(SESSION_CSV_COLUMNS)];

  for (const s of sessions) {
    lines.push(
      toCsvRow([
        'session',
        s.sessionId,
        s.timestampIso,
        s.tester,
        s.trialType,
        s.exercise,
        s.postureMode,
        Math.round(s.durationMs),
        s.totalReps,
        s.countedReps,
        s.rejectedReps,
        s.verdict,
        s.reasons.join('|'),
        Number(s.analyzeScore.toFixed(3)),
        s.analyzeFlags.join('|'),
        s.guardVerdict,
        Number(s.guardScore.toFixed(3)),
        s.guardFlags.join('|'),
        s.xp,
      ])
    );
  }

  return lines;
}

/**
 * Xuất toàn bộ nhật ký hiệu chỉnh (rep + phiên) sang chuỗi CSV để sao chép vào clipboard.
 * Dòng đầu tiên luôn ghi phiên bản ngưỡng hiện hành.
 */
export function formatCalibrationCsv(
  reps: readonly CalibrationRepLog[],
  sessions: readonly CalibrationSessionLog[]
): string {
  const lines: string[] = [
    buildThresholdVersionHeader(),
    ...buildRepLogCsvLines(reps),
    '',
    ...buildSessionLogCsvLines(sessions),
  ];
  return lines.join('\n');
}

/** Chuyển RepResult -> RepSummary để truyền vào analyzeReps() và finalizeRun(). */
export function toCalibrationRepSummary(rep: RepResult): RepSummary {
  return {
    exercise: rep.exercise,
    durationMs: rep.durationMs,
    maxProgress: rep.maxProgress,
    holdMs: rep.holdMs,
    peakVelocity: rep.peakVelocity,
    reversals: rep.reversals,
    quality: rep.quality,
    trajectory: [...rep.trajectory],
    xp: rep.xp,
  };
}

/**
 * Đóng một phiên hiệu chỉnh bằng đúng `analyzeReps()` và `finalizeRun()` của pose-engine.ts.
 * Không sửa đổi bất kỳ ngưỡng nào và chỉ trả về bản ghi thuần để lưu vào RAM.
 */
export function finalizeCalibrationSession(options: {
  sessionId: number;
  timestampIso: string;
  tester: string;
  trialType: TrialType;
  exercise: ExerciseId;
  postureMode: PostureMode;
  durationMs: number;
  allReps: readonly RepResult[];
  guardResult: { verdict: Verdict; score: number; flags: string[] };
  xpAlreadyEarned?: number;
}): {
  log: CalibrationSessionLog;
  analysis: Analysis;
  runResult: RunResult;
} {
  const countedReps = options.allReps.filter((r) => r.counted);
  const rejectedReps = options.allReps.length - countedReps.length;
  const summaries = countedReps.map(toCalibrationRepSummary);

  const analysis = analyzeReps(summaries);
  const minSumRepMs = countedReps.reduce((acc, r) => acc + r.durationMs, 0);
  const effectiveDurationMs = Math.max(0, options.durationMs, minSumRepMs);

  const runResult = finalizeRun(
    {
      reps: summaries,
      durationMs: effectiveDurationMs,
      guardVerdict: options.guardResult.verdict,
    },
    Math.max(0, options.xpAlreadyEarned ?? 0)
  );

  const log: CalibrationSessionLog = {
    sessionId: options.sessionId,
    timestampIso: options.timestampIso,
    tester: options.tester,
    trialType: options.trialType,
    exercise: options.exercise,
    postureMode: options.postureMode,
    durationMs: effectiveDurationMs,
    totalReps: options.allReps.length,
    countedReps: countedReps.length,
    rejectedReps,
    verdict: runResult.verdict,
    reasons: [...runResult.reasons],
    analyzeScore: analysis.score,
    analyzeFlags: [...analysis.flags],
    guardVerdict: options.guardResult.verdict,
    guardScore: options.guardResult.score,
    guardFlags: [...options.guardResult.flags],
    xp: runResult.xp,
  };

  return { log, analysis, runResult };
}

/** Cho biết bài tập có đơn vị góc (°) hay tỷ lệ hình học để hiển thị đúng đơn vị trên UI. */
export function isAngleMetricExercise(id: ExerciseId): boolean {
  return id === 'side_bend' || id === 'neck_tilt';
}

/** Đọc bộ ngưỡng tĩnh của 1 động tác trực tiếp từ EXERCISES (không chỉnh sửa). */
export function getExerciseThresholdSnapshot(id: ExerciseId) {
  const def = EXERCISES[id];
  return {
    id: def.id,
    rest: def.rest,
    peak: def.peak,
    holdMs: def.holdMs,
    minRepMs: def.minRepMs,
    maxRepMs: def.maxRepMs,
    baseXp: def.baseXp,
    isAngle: isAngleMetricExercise(id),
  };
}