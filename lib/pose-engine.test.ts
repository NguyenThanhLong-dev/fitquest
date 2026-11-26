/**
 * Vitest suite for pose-engine.ts  —  run: npm test   (script: "vitest run")
 * Uses synthetic landmarks with a seeded RNG, so results are deterministic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  EXERCISES, RepCounter, SessionGuard, finalizeRun, levelFromXp, xpForLevel, weeklyScore,
  makeMockPlayers, rankOf, rewardForRank, makeRng, newSeed,
  type Frame, type Landmark, type RepResult, type RepSummary,
} from './pose-engine';

const ASPECT = 16 / 9;
const U = 0.22; // torso unit in normalized-height space
let rnd = makeRng(42);
beforeEach(() => { rnd = makeRng(42); });

function blank(): Landmark[] { return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 })); }

/** Person facing the camera; kneeRatio = (kneeY - hipY)/U (0.86 standing, ~0.2 deep squat). */
function standing(t: number, kneeRatio = 0.86, noise = 0.002): Frame {
  const lm = blank(), n = () => (rnd() - 0.5) * noise;
  const sw = (U / 1.1) / ASPECT / 2; // half shoulder width in normalized x
  const set = (i: number, x: number, y: number) => { lm[i] = { x: x + n(), y: y + n(), z: 0, visibility: 0.99 }; };
  const shY = 0.3, hipY = shY + U, kneeY = hipY + kneeRatio * U, ankY = kneeY + 0.2;
  set(0, 0.5, 0.2); set(7, 0.47, 0.2); set(8, 0.53, 0.2);
  set(11, 0.5 + sw, shY); set(12, 0.5 - sw, shY);
  set(15, 0.5 + sw * 1.2, shY + 0.3); set(16, 0.5 - sw * 1.2, shY + 0.3);
  set(23, 0.5 + sw * 0.7, hipY); set(24, 0.5 - sw * 0.7, hipY);
  set(25, 0.5 + sw * 0.8, kneeY); set(26, 0.5 - sw * 0.8, kneeY);
  set(27, 0.5 + sw * 0.8, ankY); set(28, 0.5 - sw * 0.8, ankY);
  return { t, aspect: ASPECT, lm };
}

/** One squat per entry in `durations` (ms), 30 fps, with rest frames in between. */
function squats(durations: number[], depth = 0.66, noise = 0.002): Frame[] {
  const out: Frame[] = []; let t = 0;
  for (const d of durations) {
    for (let k = 0; k < 20; k++, t += 33) out.push(standing(t, 0.86, noise));
    const steps = Math.round(d / 33);
    for (let k = 0; k <= steps; k++, t += 33) {
      const p = (1 - Math.cos((2 * Math.PI * k) / steps)) / 2; // 0→1→0
      out.push(standing(t, 0.86 - p * depth, noise));
    }
  }
  for (let k = 0; k < 20; k++, t += 33) out.push(standing(t, 0.86, noise));
  return out;
}

function run(frames: Frame[], seed = 1) {
  const rc = new RepCounter(EXERCISES.squat), guard = new SessionGuard(seed), reps: RepResult[] = [];
  for (const f of frames) { const r = rc.push(f); guard.onFrame(f); if (r.rep) { reps.push(r.rep); guard.addRep(r.rep); } }
  return { reps, guard };
}
const toSummary = ({ startT, endT, counted, flags, ...s }: RepResult): RepSummary => s;

describe('rep counting & plausibility', () => {
  it('counts 8 honest squats with natural tempo and verifies the run', () => {
    const { reps, guard } = run(squats([2000, 2300, 1900, 2600, 2100, 2450, 1800, 2250]));
    expect(reps.filter(r => r.counted)).toHaveLength(8);
    expect(guard.verdict().verdict).toBe('verified');
  });

  it('rejects reps that are too fast', () => {
    const { reps } = run(squats([500, 500, 500]));
    expect(reps.length).toBeGreaterThan(0);
    expect(reps.every(r => !r.counted && r.flags.includes('TOO_FAST'))).toBe(true);
  });

  it('does not count a shallow squat', () => {
    const { reps } = run(squats([2000], 0.3));
    expect(reps.filter(r => r.counted)).toHaveLength(0);
  });

  it('discards the in-progress rep when the pose is lost', () => {
    const frames = squats([2000]);
    const mid = Math.floor(frames.length / 2);
    for (let i = mid; i < mid + 5; i++) frames[i].lm[25].visibility = 0.1;
    expect(run(frames).reps.filter(r => r.counted)).toHaveLength(0);
  });
});

describe('anti-cheat session analysis', () => {
  it('flags identical, noise-free reps (looped video)', () => {
    const { guard } = run(squats(Array(8).fill(2000), 0.66, 0));
    const v = guard.verdict();
    expect(v.flags.some(f => f === 'LOOPED_MOTION' || f === 'UNIFORM_TEMPO')).toBe(true);
    expect(v.verdict).not.toBe('verified');
  });
});

describe('finalizeRun (local re-check)', () => {
  const honest = () => run(squats([2000, 2300, 1900, 2600])).reps.map(toSummary);

  it('accepts honest reps and awards the summed XP', () => {
    const reps = honest(), sum = reps.reduce((a, r) => a + r.xp, 0);
    const res = finalizeRun({ reps, durationMs: 30000, guardVerdict: 'verified' }, 0);
    expect(res.verdict).toBe('verified');
    expect(res.xp).toBe(sum);
  });

  it('applies the per-page-load XP cap', () => {
    const res = finalizeRun({ reps: honest(), durationMs: 30000, guardVerdict: 'verified' }, 595);
    expect(res.xp).toBe(5);
  });

  it('does not award XP for tampered reps', () => {
    const reps = honest(); reps[0] = { ...reps[0], xp: reps[0].xp + 100 };
    const res = finalizeRun({ reps, durationMs: 30000, guardVerdict: 'verified' }, 0);
    expect(res.verdict).toBe('review');
    expect(res.xp).toBe(0);
  });

  it('holds XP when the guard says review', () => {
    expect(finalizeRun({ reps: honest(), durationMs: 30000, guardVerdict: 'review' }, 0).xp).toBe(0);
  });
});

describe('XP, level, leaderboard helpers', () => {
  it('level curve is consistent', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(xpForLevel(10))).toBe(10);
  });

  it('weekly score gives a capped consistency bonus', () => {
    expect(weeklyScore(300, 3)).toBe(450);
    expect(weeklyScore(300, 9)).toBe(550);
  });

  it('mock players are deterministic and ranking/reward tiers work', () => {
    const a = makeMockPlayers(1), b = makeMockPlayers(1);
    expect(a).toEqual(b);
    expect(a).toHaveLength(20);
    const scores = a.map(p => p.score);
    expect(rankOf(Math.max(...scores) + 1, scores)).toBe(1);
    expect(rankOf(0, scores)).toBe(21);
    expect(rewardForRank(1, 21).rarity).toBe('legendary');
    expect(rewardForRank(2, 21).rarity).toBe('epic');   // top 10% of 21 = 3 slots
    expect(rewardForRank(6, 21).rarity).toBe('rare');   // top 30% = 7 slots
    expect(rewardForRank(21, 21).rarity).toBe('common');
  });

  it('newSeed returns a 32-bit unsigned integer', () => {
    const s = newSeed();
    expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
  });
});