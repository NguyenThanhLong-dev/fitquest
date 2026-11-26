/**
 * pose-engine.ts  (local prototype edition: no server, no persistence)
 * Pure TypeScript (no DOM / React deps), safe to import from any React component or from Vitest.
 *
 * Input : MediaPipe PoseLandmarker landmarks (33 points, normalized 0..1) per video frame.
 * Output: counted reps with quality score, anti-cheat flags, run verdict, XP, demo leaderboard helpers.
 *
 * All numeric thresholds are TUNABLE: calibrate them with real recordings (see AGENT_SPEC.md, task F6).
 */

// ───────────────────────────── Types ─────────────────────────────
export interface Landmark { x: number; y: number; z: number; visibility: number }
/** t = timestamp in ms (monotonic), aspect = video width / height, lm = 33 landmarks */
export interface Frame { t: number; aspect: number; lm: Landmark[] }

export type ExerciseId = 'squat' | 'overhead_reach' | 'side_bend' | 'neck_tilt' | 'high_knees';

export const LM = {
  NOSE: 0, L_EAR: 7, R_EAR: 8,
  L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14, L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28,
} as const;

// ───────────────────────────── Geometry helpers ─────────────────────────────
interface P { x: number; y: number }
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
const deg = (r: number) => (r * 180) / Math.PI;

/** Aspect-corrected point so that distances/angles are not distorted by non-square video. */
const pt = (f: Frame, i: number): P => ({ x: f.lm[i].x * f.aspect, y: f.lm[i].y });
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** Per-person scale unit ≈ torso length (1.1 × shoulder width). Works even when only upper body is visible. */
const unit = (f: Frame) => dist(pt(f, LM.L_SHOULDER), pt(f, LM.R_SHOULDER)) * 1.1;
/** Tilt (deg) of the line a→b relative to horizontal, independent of left/right ordering. */
const lineTilt = (a: P, b: P) => Math.abs(deg(Math.atan2(b.y - a.y, Math.abs(b.x - a.x))));
/** Angle (deg) of the line a→b relative to vertical. */
const fromVertical = (a: P, b: P) => deg(Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)));

const shoulders = (f: Frame) => mid(pt(f, LM.L_SHOULDER), pt(f, LM.R_SHOULDER));
const hips = (f: Frame) => mid(pt(f, LM.L_HIP), pt(f, LM.R_HIP));
const shoulderTilt = (f: Frame) => lineTilt(pt(f, LM.L_SHOULDER), pt(f, LM.R_SHOULDER));
const hipTilt = (f: Frame) => lineTilt(pt(f, LM.L_HIP), pt(f, LM.R_HIP));
const torsoLean = (f: Frame) => fromVertical(hips(f), shoulders(f));

// ───────────────────────────── Layer 0: capture-quality gate ─────────────────────────────
export type GateReason = 'LOW_VISIBILITY' | 'OUT_OF_FRAME' | 'TOO_FAR' | 'NO_POSE';
export interface GateResult { ok: boolean; reason?: GateReason }

export function qualityGate(f: Frame, required: number[], minVis = 0.6): GateResult {
  if (!f.lm || f.lm.length < 33) return { ok: false, reason: 'NO_POSE' };
  for (const i of required) {
    const l = f.lm[i];
    if (l.visibility < minVis) return { ok: false, reason: 'LOW_VISIBILITY' };
    if (l.x < -0.02 || l.x > 1.02 || l.y < -0.02 || l.y > 1.02) return { ok: false, reason: 'OUT_OF_FRAME' };
  }
  // person must be large enough in frame for landmarks to be reliable
  if (dist(pt(f, LM.L_SHOULDER), pt(f, LM.R_SHOULDER)) < 0.1) return { ok: false, reason: 'TOO_FAR' };
  return { ok: true };
}

// ───────────────────────────── Exercise definitions ─────────────────────────────
export interface FormCheck { id: string; penalty: number; pass: (f: Frame) => boolean }
export interface ExerciseDef {
  id: ExerciseId;
  name: string;
  required: number[];
  /** Scalar signal derived from one frame. */
  metric: (f: Frame) => number;
  /** metric value at rest (progress = 0) and at full range (progress = 1). Works for either direction. */
  rest: number;
  peak: number;
  /** Time (ms) the peak must be held continuously. 0 for dynamic movements. */
  holdMs: number;
  minRepMs: number;
  maxRepMs: number;
  baseXp: number;
  /** Evaluated on the frame where progress was maximal. */
  form: FormCheck[];
}

const SH_HIP_SQUAT = [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE];

export const EXERCISES: Record<ExerciseId, ExerciseDef> = {
  // Front-facing webcam: use vertical hip→knee gap / torso unit (robust to foreshortening, unlike 2D knee angle).
  squat: {
    id: 'squat', name: 'Squat', required: SH_HIP_SQUAT,
    metric: f => (mid(pt(f, LM.L_KNEE), pt(f, LM.R_KNEE)).y - hips(f).y) / unit(f),
    rest: 0.75, peak: 0.30, holdMs: 0, minRepMs: 1200, maxRepMs: 8000, baseXp: 10,
    form: [
      { id: 'TORSO_UPRIGHT', penalty: 0.25, pass: f => torsoLean(f) <= 50 },
      { id: 'HIPS_LEVEL', penalty: 0.2, pass: f => hipTilt(f) <= 10 },
    ],
  },
  // Overhead stretch (vươn vai): both wrists above the nose, held 2s.
  overhead_reach: {
    id: 'overhead_reach', name: 'Vươn vai', required: [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_WRIST, LM.R_WRIST],
    metric: f => (pt(f, LM.NOSE).y - mid(pt(f, LM.L_WRIST), pt(f, LM.R_WRIST)).y) / unit(f),
    rest: -0.5, peak: 0.3, holdMs: 2000, minRepMs: 2500, maxRepMs: 15000, baseXp: 6,
    form: [
      { id: 'BOTH_WRISTS_UP', penalty: 0.4, pass: f => pt(f, LM.L_WRIST).y < pt(f, LM.NOSE).y && pt(f, LM.R_WRIST).y < pt(f, LM.NOSE).y },
      { id: 'SHOULDERS_LEVEL', penalty: 0.2, pass: f => shoulderTilt(f) <= 10 },
    ],
  },
  // Standing side bend: torso tilt from vertical.
  side_bend: {
    id: 'side_bend', name: 'Nghiêng người', required: [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP],
    metric: f => torsoLean(f),
    rest: 5, peak: 20, holdMs: 1500, minRepMs: 2500, maxRepMs: 15000, baseXp: 5,
    form: [{ id: 'HIPS_LEVEL', penalty: 0.3, pass: f => hipTilt(f) <= 8 }],
  },
  // Neck side tilt: ear line tilts while shoulders stay level (prevents "leaning the whole body").
  neck_tilt: {
    id: 'neck_tilt', name: 'Nghiêng cổ', required: [LM.NOSE, LM.L_EAR, LM.R_EAR, LM.L_SHOULDER, LM.R_SHOULDER],
    metric: f => lineTilt(pt(f, LM.L_EAR), pt(f, LM.R_EAR)),
    rest: 4, peak: 16, holdMs: 2000, minRepMs: 3000, maxRepMs: 15000, baseXp: 4,
    form: [{ id: 'SHOULDERS_LEVEL', penalty: 0.4, pass: f => shoulderTilt(f) <= 8 }],
  },
  // Marching / high knees: knee lifted close to hip height.
  high_knees: {
    id: 'high_knees', name: 'Nâng gối', required: SH_HIP_SQUAT,
    metric: f => {
      const u = unit(f);
      return Math.max((pt(f, LM.L_HIP).y - pt(f, LM.L_KNEE).y) / u, (pt(f, LM.R_HIP).y - pt(f, LM.R_KNEE).y) / u);
    },
    rest: -0.7, peak: -0.2, holdMs: 0, minRepMs: 400, maxRepMs: 4000, baseXp: 3,
    form: [{ id: 'TORSO_UPRIGHT', penalty: 0.3, pass: f => torsoLean(f) <= 35 }],
  },
};

// ───────────────────────────── Layer 1-2: rep counter + plausibility ─────────────────────────────
export type RepFlag = string; // e.g. TOO_FAST, TOO_SLOW, HOLD_TOO_SHORT, JITTER, TELEPORT, NOT_DEEP_ENOUGH, FORM_<id>
const HARD_FLAGS = new Set(['TOO_FAST', 'TOO_SLOW', 'HOLD_TOO_SHORT', 'JITTER', 'TELEPORT', 'NOT_DEEP_ENOUGH']);

/** Compact per-rep record kept for the run summary and re-checked by finalizeRun(). */
export interface RepSummary {
  exercise: ExerciseId;
  durationMs: number;
  maxProgress: number;
  holdMs: number;
  peakVelocity: number;
  reversals: number;
  quality: number;
  trajectory: number[]; // 20 samples, progress over normalized time
  xp: number;
}
export interface RepResult extends RepSummary { startT: number; endT: number; counted: boolean; flags: RepFlag[] }

export const CONFIG = {
  startProgress: 0.15,      // leaving rest
  endProgress: 0.15,        // returning to rest
  minQuality: 0.6,          // rep counts if quality >= this and no hard flag
  zigzagDeadband: 0.08,     // progress change ignored when counting direction reversals
  maxReversals: 3,          // clean rep = 1 reversal (up→down); allow some wobble
  emaAlpha: 0.4,            // smoothing of the metric
  staticStd: 0.0003,        // nose std over 2s below this ⇒ static image suspect
  loopRmse: 0.02,           // mean pairwise trajectory RMSE below this ⇒ looped video suspect
  uniformCv: 0.04,          // coefficient of variation of rep duration below this ⇒ too uniform
  xpCap: 600,               // max XP per page load (prototype has no persistence, so no real 'daily' cap)
} as const;

/** Max plausible speed in progress/second derived from the minimum rep time (sinusoidal rep ⇒ π/T, +60% margin). */
const maxVelocity = (d: ExerciseDef) => (Math.PI / (d.minRepMs / 1000)) * 1.6;

function resample(s: { t: number; p: number }[], n: number): number[] {
  const t0 = s[0].t, t1 = s[s.length - 1].t, out: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + ((t1 - t0) * i) / (n - 1);
    while (j < s.length - 2 && s[j + 1].t < t) j++;
    const a = s[j], b = s[j + 1];
    const w = b.t === a.t ? 0 : clamp((t - a.t) / (b.t - a.t), 0, 1);
    out.push(a.p + (b.p - a.p) * w);
  }
  return out;
}

function countReversals(ps: number[], deadband: number): number {
  let dir = 0, ext = ps[0], rev = 0;
  for (const p of ps) {
    if (dir === 0) {
      if (p - ext > deadband) { dir = 1; ext = p; } else if (ext - p > deadband) { dir = -1; ext = p; }
    } else if (dir === 1) {
      if (p > ext) ext = p; else if (ext - p > deadband) { dir = -1; ext = p; rev++; }
    } else {
      if (p < ext) ext = p; else if (p - ext > deadband) { dir = 1; ext = p; rev++; }
    }
  }
  return rev;
}

export interface PushResult { gate: GateResult; progress: number | null; rep: RepResult | null }

export class RepCounter {
  private ema: number | null = null;
  private active = false;
  private armed = true;
  private samples: { t: number; p: number }[] = [];
  private maxP = 0;
  private peakFrame: Frame | null = null;
  private holdStart: number | null = null;
  private bestHold = 0;

  constructor(public readonly def: ExerciseDef) {}

  reset() {
    this.ema = null; this.active = false; this.armed = true; this.samples = [];
    this.maxP = 0; this.peakFrame = null; this.holdStart = null; this.bestHold = 0;
  }

  push(f: Frame): PushResult {
    const gate = qualityGate(f, this.def.required);
    if (!gate.ok) { this.reset(); return { gate, progress: null, rep: null }; } // pose lost ⇒ rep discarded

    const raw = this.def.metric(f);
    this.ema = this.ema === null ? raw : CONFIG.emaAlpha * raw + (1 - CONFIG.emaAlpha) * this.ema;
    const p = (this.ema - this.def.rest) / (this.def.peak - this.def.rest);

    if (!this.active) {
      if (!this.armed) { if (p < CONFIG.endProgress) this.armed = true; return { gate, progress: p, rep: null }; }
      if (p > CONFIG.startProgress) {
        this.active = true; this.samples = [{ t: f.t, p }]; this.maxP = p; this.peakFrame = f;
        this.holdStart = null; this.bestHold = 0;
      }
      return { gate, progress: p, rep: null };
    }

    this.samples.push({ t: f.t, p });
    if (p > this.maxP) { this.maxP = p; this.peakFrame = f; }
    if (p >= 1) { if (this.holdStart === null) this.holdStart = f.t; this.bestHold = Math.max(this.bestHold, f.t - this.holdStart); }
    else if (p < 0.9) this.holdStart = null;

    const elapsed = f.t - this.samples[0].t;
    const timedOut = elapsed > this.def.maxRepMs;
    if (p < CONFIG.endProgress || timedOut) {
      const rep = this.finalize(timedOut);
      this.active = false; this.armed = !timedOut || p < CONFIG.endProgress;
      this.samples = []; this.peakFrame = null;
      return { gate, progress: p, rep };
    }
    return { gate, progress: p, rep: null };
  }

  private finalize(timedOut: boolean): RepResult | null {
    const s = this.samples, d = this.def;
    if (s.length < 3 || this.maxP < 0.6) return null; // tiny movement: ignore silently
    const flags: RepFlag[] = [];
    const durationMs = s[s.length - 1].t - s[0].t;

    if (this.maxP < 1) flags.push('NOT_DEEP_ENOUGH');
    if (durationMs < d.minRepMs) flags.push('TOO_FAST');
    if (timedOut || durationMs > d.maxRepMs) flags.push('TOO_SLOW');
    if (this.bestHold < d.holdMs) flags.push('HOLD_TOO_SHORT');

    let peakVelocity = 0;
    for (let i = 1; i < s.length; i++) {
      const dt = (s[i].t - s[i - 1].t) / 1000;
      if (dt > 0) peakVelocity = Math.max(peakVelocity, Math.abs(s[i].p - s[i - 1].p) / dt);
    }
    if (peakVelocity > maxVelocity(d)) flags.push('TELEPORT');

    const reversals = countReversals(s.map(x => x.p), CONFIG.zigzagDeadband);
    if (reversals > CONFIG.maxReversals) flags.push('JITTER');

    let quality = 1;
    if (this.peakFrame) {
      for (const c of d.form) if (!c.pass(this.peakFrame)) { quality -= c.penalty; flags.push('FORM_' + c.id); }
    }
    quality = clamp(quality, 0, 1);

    const counted = quality >= CONFIG.minQuality && !flags.some(x => HARD_FLAGS.has(x));
    return {
      exercise: d.id, startT: s[0].t, endT: s[s.length - 1].t, durationMs,
      maxProgress: this.maxP, holdMs: this.bestHold, peakVelocity, reversals, quality,
      trajectory: resample(s, 20), xp: counted ? Math.round(d.baseXp * quality) : 0, counted, flags,
    };
  }
}

// ───────────────────────────── Layer 3: liveness challenge ─────────────────────────────
export type ChallengeId = 'RAISE_LEFT_HAND' | 'RAISE_RIGHT_HAND';
export interface Challenge { id: ChallengeId; issuedAt: number; deadlineMs: number }

/** Anatomical labels (person's own left/right). */
export function challengePassed(c: Challenge, f: Frame): boolean {
  if (qualityGate(f, [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_WRIST, LM.R_WRIST], 0.5).ok === false) return false;
  const u = unit(f), nose = pt(f, LM.NOSE);
  const up = c.id === 'RAISE_LEFT_HAND' ? LM.L_WRIST : LM.R_WRIST;
  const down = c.id === 'RAISE_LEFT_HAND' ? LM.R_WRIST : LM.L_WRIST;
  const downSh = c.id === 'RAISE_LEFT_HAND' ? LM.R_SHOULDER : LM.L_SHOULDER;
  return pt(f, up).y < nose.y - 0.3 * u && pt(f, down).y > pt(f, downSh).y;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ───────────────────────────── Layer 3-4: session analysis ─────────────────────────────
export type Verdict = 'verified' | 'review' | 'rejected';
export interface Analysis { score: number; flags: string[] }

/** Statistical checks that only need rep summaries (also used by finalizeRun). */
export function analyzeReps(reps: RepSummary[]): Analysis {
  let score = 0; const flags: string[] = [];
  const byEx = new Map<ExerciseId, RepSummary[]>();
  for (const r of reps) byEx.set(r.exercise, [...(byEx.get(r.exercise) ?? []), r]);

  for (const [, rs] of byEx) {
    if (rs.length >= 5) {
      // identical trajectories across reps ⇒ looped/pre-recorded video
      let sum = 0, n = 0;
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const se = mean(rs[i].trajectory.map((v, k) => (v - rs[j].trajectory[k]) ** 2));
        sum += Math.sqrt(se); n++;
      }
      if (sum / n < CONFIG.loopRmse) { score += 0.6; flags.push('LOOPED_MOTION'); }
    }
    if (rs.length >= 6) {
      const d = rs.map(r => r.durationMs), cv = std(d) / mean(d);
      if (cv < CONFIG.uniformCv) { score += 0.3; flags.push('UNIFORM_TEMPO'); }
    }
  }
  return { score, flags };
}

export class SessionGuard {
  readonly reps: RepResult[] = [];
  private rng: () => number;
  private nextChallengeAt: number | null = null;
  private activeChallenge: Challenge | null = null;
  private issued = 0; private passed = 0; private failed = 0;
  private lastT: number | null = null; private dts: number[] = [];
  private win: P[] = []; private winStart = 0; private staticWindows = 0;

  /** Use newSeed() for the seed: it decides when liveness challenges appear, so it must be unpredictable. */
  constructor(seed: number, private maxChallenges = 2) { this.rng = mulberry32(seed); }

  get currentChallenge() { return this.activeChallenge; }

  addRep(r: RepResult) { this.reps.push(r); }

  /** Call for every frame. Returns a NEW challenge when one should be shown. UI must pause rep counting while it is active. */
  onFrame(f: Frame): Challenge | null {
    if (this.lastT !== null) { this.dts.push(f.t - this.lastT); if (this.dts.length > 600) this.dts.shift(); }
    this.lastT = f.t;
    if (this.nextChallengeAt === null) this.nextChallengeAt = f.t + 30000 + this.rng() * 30000;

    // static-subject detection: a photo held to the camera has ~zero landmark jitter
    if (f.lm?.[LM.NOSE]?.visibility >= 0.6) {
      if (this.win.length === 0) this.winStart = f.t;
      this.win.push(pt(f, LM.NOSE));
      if (f.t - this.winStart >= 2000) {
        if (std(this.win.map(p => p.x)) + std(this.win.map(p => p.y)) < CONFIG.staticStd) this.staticWindows++;
        this.win = [];
      }
    }

    if (this.activeChallenge) {
      if (challengePassed(this.activeChallenge, f)) { this.passed++; this.finishChallenge(f.t); }
      else if (f.t - this.activeChallenge.issuedAt > this.activeChallenge.deadlineMs) { this.failed++; this.finishChallenge(f.t); }
      return null;
    }
    if (this.issued < this.maxChallenges && this.reps.filter(r => r.counted).length >= 3 && f.t >= this.nextChallengeAt) {
      this.issued++;
      this.activeChallenge = { id: this.rng() < 0.5 ? 'RAISE_LEFT_HAND' : 'RAISE_RIGHT_HAND', issuedAt: f.t, deadlineMs: 4000 };
      return this.activeChallenge;
    }
    return null;
  }

  private finishChallenge(t: number) { this.activeChallenge = null; this.nextChallengeAt = t + 30000 + this.rng() * 30000; }

  verdict(): { verdict: Verdict; score: number; flags: string[] } {
    const counted = this.reps.filter(r => r.counted);
    const a = analyzeReps(counted);
    let score = a.score; const flags = [...a.flags];

    if (this.staticWindows >= 3) { score += 0.6; flags.push('STATIC_SUBJECT'); }
    if (this.failed > 0) { score += 0.5 * this.failed; flags.push('CHALLENGE_FAILED'); }
    if (this.dts.length > 30) {
      const med = [...this.dts].sort((x, y) => x - y)[Math.floor(this.dts.length / 2)];
      if (med > 100) { score += 0.1; flags.push('LOW_FPS'); }
    }
    const noisy = this.reps.filter(r => r.flags.includes('JITTER') || r.flags.includes('TELEPORT')).length;
    if (this.reps.length >= 5 && noisy / this.reps.length > 0.3) { score += 0.3; flags.push('NOISY_REPS'); }

    const verdict: Verdict = score >= 0.7 ? 'rejected' : score >= 0.3 ? 'review' : 'verified';
    return { verdict, score, flags };
  }
}

// ───────────────────────────── XP / level ─────────────────────────────
export const levelFromXp = (xp: number) => Math.floor(Math.pow(Math.max(xp, 0) / 100, 2 / 3) + 1e-9) + 1;
export const xpForLevel = (level: number) => Math.round(100 * Math.pow(level - 1, 1.5));
/** Weekly leaderboard score: verified XP + consistency bonus (max 5 active days) so grinding one day is not optimal. */
export const weeklyScore = (verifiedXp: number, activeDays: number) => verifiedXp + 50 * Math.min(activeDays, 5);

// ───────────────────────────── Run finalization (local re-check) ─────────────────────────────
export interface RunInput { reps: RepSummary[]; durationMs: number; guardVerdict: Verdict }
export interface RunResult { verdict: Verdict; accepted: boolean; xp: number; reasons: string[] }

/**
 * Called once when a run ends. Re-checks every rep against the exercise rules (guards against bugs / tampering
 * in UI code), combines it with the SessionGuard verdict and applies the XP cap.
 * @param xpAlreadyEarned XP earned earlier in this page load (in-memory), for the cap.
 */
export function finalizeRun(input: RunInput, xpAlreadyEarned: number): RunResult {
  const reasons: string[] = [];
  let sum = 0;
  for (const r of input.reps) {
    const d = EXERCISES[r.exercise];
    const bad = !d ||
      r.durationMs < d.minRepMs || r.durationMs > d.maxRepMs || r.maxProgress < 1 || r.holdMs < d.holdMs ||
      r.peakVelocity > maxVelocity(d) || r.reversals > CONFIG.maxReversals ||
      r.quality < CONFIG.minQuality || r.quality > 1 || r.trajectory.length !== 20 ||
      r.xp !== Math.round(d.baseXp * r.quality);
    if (bad) reasons.push('INVALID_REP:' + r.exercise); else sum += r.xp;
  }
  // physical upper bound on number of reps for the run length
  const fastest = Math.min(...Object.values(EXERCISES).map(e => e.minRepMs));
  if (input.reps.length > Math.floor(input.durationMs / fastest) + 1) reasons.push('TOO_MANY_REPS');

  const a = analyzeReps(input.reps);
  reasons.push(...a.flags);

  const verdict: Verdict =
    input.guardVerdict === 'rejected' || a.score >= 0.7 ? 'rejected'
    : input.guardVerdict === 'review' || a.score >= 0.3 || reasons.includes('TOO_MANY_REPS') || reasons.some(x => x.startsWith('INVALID_REP')) ? 'review'
    : 'verified';

  const room = Math.max(0, CONFIG.xpCap - xpAlreadyEarned);
  const xp = verdict === 'verified' ? Math.min(sum, room) : 0; // review ⇒ XP held back
  return { verdict, accepted: verdict !== 'rejected', xp, reasons };
}

// ───────────────────────────── Seeds & demo leaderboard ─────────────────────────────
/** Unpredictable 32-bit seed (crypto when available). */
export function newSeed(): number {
  const c = (globalThis as { crypto?: { getRandomValues<T extends ArrayBufferView>(a: T): T } }).crypto;
  return c ? c.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
}
export const makeRng = mulberry32;

export interface MockPlayer { name: string; score: number }
const MOCK_NAMES = ['Minh_dev', 'Lan_codes', 'Khoa404', 'Thu_Py', 'HaiCpp', 'BaoNull', 'Vy_React', 'Nam_Java', 'Trang_SQL', 'DucGit',
  'Linh_UX', 'Phat_C', 'AnhBug', 'Ngoc_AI', 'TuanOOP', 'Mai_Web', 'SonStack', 'Chi_QA', 'HungAPI', 'Yen_Ops'];

/** Deterministic fake players for the demo leaderboard (label them "demo data" in the UI). */
export function makeMockPlayers(seed = 2026, n = MOCK_NAMES.length): MockPlayer[] {
  const rng = mulberry32(seed);
  return MOCK_NAMES.slice(0, n).map(name => ({ name, score: Math.round(150 + Math.pow(rng(), 1.5) * 1250) }));
}

/** 1-based rank of `score` among `others` (ties share the better rank). */
export const rankOf = (score: number, others: number[]) => 1 + others.filter(o => o > score).length;

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface Reward { id: string; name: string; rarity: Rarity }

/** Weekly reward tier by rank. Caller grants it only if the player actually scored (> 0). */
export function rewardForRank(rank: number, total: number): Reward {
  if (rank === 1) return { id: 'champion', name: 'Nhà vô địch tuần', rarity: 'legendary' };
  if (rank <= Math.ceil(total * 0.1)) return { id: 'top10', name: 'Hiệp sĩ bạc', rarity: 'epic' };
  if (rank <= Math.ceil(total * 0.3)) return { id: 'top30', name: 'Chiến binh đồng', rarity: 'rare' };
  return { id: 'participant', name: 'Tân binh chăm chỉ', rarity: 'common' };
}