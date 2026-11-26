/**
 * Toàn bộ logic game Dungeon Run (thuần TypeScript, KHÔNG phụ thuộc React hay DOM).
 * Giữ nguyên toàn bộ logic F5a và bổ sung hỗ trợ chế độ Ngồi (postureMode) cho F8:
 * chỉ tạo & đổi quái từ danh sách động tác hợp lệ, vẫn đảm bảo 3–5 nhiệm vụ và không lặp liên tiếp.
 */
import {
  ALL_EXERCISE_IDS,
  ENGINE_XP_CAP,
  combineGuardVerdict,
  createEngineRng,
  createEngineSeed,
  finalizeDungeonRun,
  getAllowedExercises,
  getExerciseDef,
  getLevelFromXp,
  type ExerciseId,
  type PostureMode,
  type RepResult,
  type RunResult,
  type Verdict,
} from '@/lib/game/engineAdapter';

export const DUNGEON_CONFIG = {
  fixedSeed: null as number | null,
  minEncounters: 3,
  maxEncounters: 5,
  transitionDelayMs: 1000,
  baseDamage: 30,
  critQualityThreshold: 0.9,
  critMultiplier: 1.5,
  comboStepBonus: 0.05,
  maxComboBonusSteps: 10,
  freeSwapsPerRun: 1,
  sideObjectiveCount: 2,
  sampleEncounterCount: 3,
  sampleMonsterHp: 48,
  sampleTargetReps: 2,
} as const;

export const BASE_TARGET_REPS_BY_EXERCISE: Record<ExerciseId, number> = {
  squat: 6,
  overhead_reach: 5,
  side_bend: 5,
  neck_tilt: 5,
  high_knees: 8,
};

export type VerifiedRepCounts = Record<ExerciseId, number>;

export interface CharacterStats {
  str: number;
  agi: number;
  vit: number;
  wis: number;
}

export type SkillId =
  | 'free_swap'
  | 'second_wind'
  | 'focus'
  | 'dungeon_skin'
  | 'raid_boss';

export interface SkillStatus {
  id: SkillId;
  requiredLevel: number;
  implemented: boolean;
  unlocked: boolean;
}

export type SideObjectiveId =
  | 'crit_3'
  | 'combo_8'
  | 'boss_no_swap'
  | 'high_quality_5'
  | 'boss_crit';

export interface SideObjectiveProgress {
  id: SideObjectiveId;
  current: number;
  target: number;
  completed: boolean;
}

export interface MonsterEncounter {
  stageNumber: number;
  exercise: ExerciseId;
  isBoss: boolean;
  maxHp: number;
  hp: number;
  targetReps: number;
  defeated: boolean;
}

export interface DamageEvent {
  exercise: ExerciseId;
  damage: number;
  quality: number;
  isCrit: boolean;
  combo: number;
  comboMultiplier: number;
  tentativeXpAdded: number;
  defeatedMonster: boolean;
  hitXpCap: boolean;
  atMs: number;
}

export type DungeonPhase = 'fighting' | 'transitioning' | 'finished';

export interface DungeonRunState {
  seed: number;
  isFixedSeed: boolean;
  isSampleRun: boolean;
  postureMode: PostureMode;
  phase: DungeonPhase;
  encounters: MonsterEncounter[];
  currentIndex: number;
  startedAtMs: number | null;
  transitionUntilMs: number | null;
  combo: number;
  maxCombo: number;
  critCount: number;
  bossCritCount: number;
  highQualityCount: number;
  swapsRemaining: number;
  usedSwap: boolean;
  sideObjectives: SideObjectiveProgress[];
  countedReps: RepResult[];
  rejectedRepCount: number;
  cancelledRepCount: number;
  tentativeXpEarned: number;
  startingTotalXp: number;
  lastHit: DamageEvent | null;
}

export type XpDifferenceReason =
  | 'none'
  | 'xp_cap'
  | 'review_held'
  | 'rejected_zero'
  | 'recheck_adjusted';

export interface DungeonSummaryData {
  seed: number;
  isSampleRun: boolean;
  completedAllMonsters: boolean;
  defeatedMonsters: number;
  totalMonsters: number;
  verdict: Verdict;
  accepted: boolean;
  reasonCodes: string[];
  tentativeXp: number;
  officialXp: number;
  xpDiffReason: XpDifferenceReason;
  hitXpCap: boolean;
  countedReps: number;
  rejectedReps: number;
  cancelledReps: number;
  livenessPassed: number;
  livenessFailed: number;
  maxCombo: number;
  critCount: number;
  sideObjectives: SideObjectiveProgress[];
  levelBefore: number;
  levelAfter: number;
  totalXpBefore: number;
  totalXpAfter: number;
  statsBefore: CharacterStats;
  statsAfter: CharacterStats;
  countedRepsByExercise: VerifiedRepCounts;
  durationMs: number;
  engineResult: RunResult;
}

export function createEmptyVerifiedReps(): VerifiedRepCounts {
  return {
    squat: 0,
    overhead_reach: 0,
    side_bend: 0,
    neck_tilt: 0,
    high_knees: 0,
  };
}

export function computeCharacterStats(reps: VerifiedRepCounts): CharacterStats {
  return {
    str: Math.floor(Math.sqrt(Math.max(0, reps.squat + reps.high_knees))),
    agi: Math.floor(Math.sqrt(Math.max(0, reps.side_bend))),
    vit: Math.floor(Math.sqrt(Math.max(0, reps.neck_tilt))),
    wis: Math.floor(Math.sqrt(Math.max(0, reps.overhead_reach))),
  };
}

export function getSkillsForLevel(level: number): SkillStatus[] {
  return [
    {
      id: 'free_swap',
      requiredLevel: 1,
      implemented: true,
      unlocked: level >= 1,
    },
    {
      id: 'second_wind',
      requiredLevel: 3,
      implemented: false,
      unlocked: level >= 3,
    },
    {
      id: 'focus',
      requiredLevel: 5,
      implemented: false,
      unlocked: level >= 5,
    },
    {
      id: 'dungeon_skin',
      requiredLevel: 8,
      implemented: false,
      unlocked: level >= 8,
    },
    {
      id: 'raid_boss',
      requiredLevel: 12,
      implemented: false,
      unlocked: level >= 12,
    },
  ];
}

export function createDungeonSeed(): { seed: number; isFixed: boolean } {
  if (DUNGEON_CONFIG.fixedSeed !== null) {
    return { seed: DUNGEON_CONFIG.fixedSeed >>> 0, isFixed: true };
  }
  return { seed: createEngineSeed(), isFixed: false };
}

function buildEncounter(
  stageNumber: number,
  exercise: ExerciseId,
  isBoss: boolean,
  isSampleRun: boolean
): MonsterEncounter {
  if (isSampleRun) {
    return {
      stageNumber,
      exercise,
      isBoss,
      maxHp: DUNGEON_CONFIG.sampleMonsterHp,
      hp: DUNGEON_CONFIG.sampleMonsterHp,
      targetReps: DUNGEON_CONFIG.sampleTargetReps,
      defeated: false,
    };
  }

  const baseReps = BASE_TARGET_REPS_BY_EXERCISE[exercise];
  const targetReps = isBoss ? baseReps * 2 : baseReps;
  const maxHp = targetReps * DUNGEON_CONFIG.baseDamage;

  return {
    stageNumber,
    exercise,
    isBoss,
    maxHp,
    hp: maxHp,
    targetReps,
    defeated: false,
  };
}

const ALL_SIDE_OBJECTIVES: readonly { id: SideObjectiveId; target: number }[] = [
  { id: 'crit_3', target: 3 },
  { id: 'combo_8', target: 8 },
  { id: 'boss_no_swap', target: 1 },
  { id: 'high_quality_5', target: 5 },
  { id: 'boss_crit', target: 1 },
] as const;

export function pickSideObjectives(seed: number): SideObjectiveProgress[] {
  const rng = createEngineRng((seed ^ 0x9e3779b9) >>> 0);
  const pool = [...ALL_SIDE_OBJECTIVES];
  const picked: SideObjectiveProgress[] = [];

  for (let i = 0; i < DUNGEON_CONFIG.sideObjectiveCount && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    const chosen = pool.splice(idx, 1)[0];
    picked.push({
      id: chosen.id,
      current: 0,
      target: chosen.target,
      completed: false,
    });
  }

  return picked;
}

/**
 * Tạo chuỗi 3–5 quái theo seed và chế độ Đứng / Ngồi:
 * - Chế độ Ngồi chỉ chọn từ 3 động tác: overhead_reach, side_bend, neck_tilt.
 * - Vẫn bảo đảm đủ 3–5 nhiệm vụ và tuyệt đối không lặp liên tiếp cùng một động tác; quái cuối là Boss.
 */
export function generateEncounters(
  seed: number,
  isSampleRun = false,
  postureMode: PostureMode = 'standing'
): MonsterEncounter[] {
  const rng = createEngineRng(seed >>> 0);
  const allowedPool = getAllowedExercises(postureMode);
  const span = DUNGEON_CONFIG.maxEncounters - DUNGEON_CONFIG.minEncounters + 1;
  const count = isSampleRun
    ? DUNGEON_CONFIG.sampleEncounterCount
    : DUNGEON_CONFIG.minEncounters + Math.floor(rng() * span);

  const encounters: MonsterEncounter[] = [];
  let prevExercise: ExerciseId | null = null;

  for (let i = 0; i < count; i++) {
    const candidates: readonly ExerciseId[] =
      prevExercise === null
        ? allowedPool
        : allowedPool.filter((id) => id !== prevExercise);

    const chosen: ExerciseId = candidates[Math.floor(rng() * candidates.length)];
    prevExercise = chosen;

    const isBoss = i === count - 1;
    encounters.push(buildEncounter(i + 1, chosen, isBoss, isSampleRun));
  }

  return encounters;
}

export function createDungeonRunState(options: {
  seed: number;
  isFixedSeed?: boolean;
  isSampleRun?: boolean;
  postureMode?: PostureMode;
  startingTotalXp?: number;
}): DungeonRunState {
  const seed = options.seed >>> 0;
  const isSampleRun = Boolean(options.isSampleRun);
  const postureMode: PostureMode = options.postureMode ?? 'standing';

  return {
    seed,
    isFixedSeed: Boolean(options.isFixedSeed),
    isSampleRun,
    postureMode,
    phase: 'fighting',
    encounters: generateEncounters(seed, isSampleRun, postureMode),
    currentIndex: 0,
    startedAtMs: null,
    transitionUntilMs: null,
    combo: 0,
    maxCombo: 0,
    critCount: 0,
    bossCritCount: 0,
    highQualityCount: 0,
    swapsRemaining: DUNGEON_CONFIG.freeSwapsPerRun,
    usedSwap: false,
    sideObjectives: pickSideObjectives(seed),
    countedReps: [],
    rejectedRepCount: 0,
    cancelledRepCount: 0,
    tentativeXpEarned: 0,
    startingTotalXp: Math.max(0, options.startingTotalXp ?? 0),
    lastHit: null,
  };
}

export function calculateRepDamage(
  quality: number,
  nextCombo: number
): { damage: number; isCrit: boolean; comboMultiplier: number } {
  const clampedQ = Math.min(1, Math.max(0, quality));
  const isCrit = clampedQ >= DUNGEON_CONFIG.critQualityThreshold;
  const bonusSteps = Math.min(
    DUNGEON_CONFIG.maxComboBonusSteps,
    Math.max(0, nextCombo - 1)
  );
  const comboMultiplier = 1 + bonusSteps * DUNGEON_CONFIG.comboStepBonus;
  const critFactor = isCrit ? DUNGEON_CONFIG.critMultiplier : 1;

  const damage = Math.max(
    1,
    Math.round(DUNGEON_CONFIG.baseDamage * clampedQ * comboMultiplier * critFactor)
  );

  return { damage, isCrit, comboMultiplier };
}

function evaluateSideObjectives(state: DungeonRunState): SideObjectiveProgress[] {
  const boss = state.encounters[state.encounters.length - 1];
  const bossDefeated = Boolean(boss && boss.defeated);

  return state.sideObjectives.map((obj) => {
    switch (obj.id) {
      case 'crit_3': {
        const current = Math.min(obj.target, state.critCount);
        return { ...obj, current, completed: state.critCount >= obj.target };
      }
      case 'combo_8': {
        const current = Math.min(obj.target, state.maxCombo);
        return { ...obj, current, completed: state.maxCombo >= obj.target };
      }
      case 'boss_no_swap': {
        const done = bossDefeated && !state.usedSwap;
        return { ...obj, current: done ? 1 : 0, completed: done };
      }
      case 'high_quality_5': {
        const current = Math.min(obj.target, state.highQualityCount);
        return {
          ...obj,
          current,
          completed: state.highQualityCount >= obj.target,
        };
      }
      case 'boss_crit': {
        const current = Math.min(obj.target, state.bossCritCount);
        return { ...obj, current, completed: state.bossCritCount >= obj.target };
      }
    }
  });
}

export function applyRepToDungeon(
  state: DungeonRunState,
  rep: RepResult,
  atMs: number
): DungeonRunState {
  if (state.phase !== 'fighting') return state;

  const startedAtMs = state.startedAtMs ?? Math.min(rep.startT, atMs);

  if (!rep.counted) {
    return {
      ...state,
      startedAtMs,
      combo: 0,
      rejectedRepCount: state.rejectedRepCount + 1,
    };
  }

  const currentMonster = state.encounters[state.currentIndex];
  if (!currentMonster || currentMonster.defeated) return state;

  const nextCombo = state.combo + 1;
  const maxCombo = Math.max(state.maxCombo, nextCombo);
  const { damage, isCrit, comboMultiplier } = calculateRepDamage(
    rep.quality,
    nextCombo
  );

  const remainingCap = Math.max(
    0,
    ENGINE_XP_CAP - (state.startingTotalXp + state.tentativeXpEarned)
  );
  const tentativeXpAdded = Math.min(Math.max(0, rep.xp), remainingCap);
  const nextTentativeXp = state.tentativeXpEarned + tentativeXpAdded;
  const hitXpCap = state.startingTotalXp + nextTentativeXp >= ENGINE_XP_CAP;

  const nextHp = Math.max(0, currentMonster.hp - damage);
  const defeatedMonster = nextHp === 0;

  const nextEncounters = state.encounters.map((enc, idx) =>
    idx === state.currentIndex
      ? { ...enc, hp: nextHp, defeated: defeatedMonster }
      : enc
  );

  const nextCritCount = state.critCount + (isCrit ? 1 : 0);
  const nextBossCritCount =
    state.bossCritCount + (isCrit && currentMonster.isBoss ? 1 : 0);
  const nextHighQualityCount =
    state.highQualityCount + (rep.quality >= 0.85 ? 1 : 0);

  const isLastMonster = state.currentIndex >= state.encounters.length - 1;
  const nextPhase: DungeonPhase = defeatedMonster
    ? isLastMonster
      ? 'finished'
      : 'transitioning'
    : 'fighting';

  const transitionUntilMs =
    nextPhase === 'transitioning'
      ? atMs + DUNGEON_CONFIG.transitionDelayMs
      : null;

  const draft: DungeonRunState = {
    ...state,
    phase: nextPhase,
    encounters: nextEncounters,
    startedAtMs,
    transitionUntilMs,
    combo: nextCombo,
    maxCombo,
    critCount: nextCritCount,
    bossCritCount: nextBossCritCount,
    highQualityCount: nextHighQualityCount,
    countedReps: [...state.countedReps, rep],
    tentativeXpEarned: nextTentativeXp,
    lastHit: {
      exercise: rep.exercise,
      damage,
      quality: rep.quality,
      isCrit,
      combo: nextCombo,
      comboMultiplier,
      tentativeXpAdded,
      defeatedMonster,
      hitXpCap,
      atMs,
    },
  };

  return {
    ...draft,
    sideObjectives: evaluateSideObjectives(draft),
  };
}

export function applyCancelledRepToDungeon(
  state: DungeonRunState
): DungeonRunState {
  if (state.phase !== 'fighting') return state;
  return {
    ...state,
    combo: 0,
    cancelledRepCount: state.cancelledRepCount + 1,
  };
}

export function advanceMonsterTransition(
  state: DungeonRunState,
  nowMs: number
): DungeonRunState {
  if (
    state.phase !== 'transitioning' ||
    state.transitionUntilMs === null ||
    nowMs < state.transitionUntilMs
  ) {
    return state;
  }

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.encounters.length) {
    return {
      ...state,
      phase: 'finished',
      transitionUntilMs: null,
    };
  }

  return {
    ...state,
    phase: 'fighting',
    currentIndex: nextIndex,
    transitionUntilMs: null,
  };
}

/**
 * Kỹ năng hoạt động thật: "Đổi quái miễn phí" (1 lần mỗi lượt).
 * Tôn trọng chế độ Ngồi / Đứng: chỉ đổi sang động tác hợp lệ và KHÁC động tác hiện tại.
 */
export function swapCurrentMonster(state: DungeonRunState): DungeonRunState {
  if (state.phase !== 'fighting' || state.swapsRemaining <= 0) {
    return state;
  }

  const current = state.encounters[state.currentIndex];
  if (!current || current.defeated) return state;

  const allowedPool = getAllowedExercises(state.postureMode);
  const prevEx =
    state.currentIndex > 0 ? state.encounters[state.currentIndex - 1].exercise : null;
  const nextEx =
    state.currentIndex + 1 < state.encounters.length
      ? state.encounters[state.currentIndex + 1].exercise
      : null;

  let candidates: ExerciseId[] = allowedPool.filter(
    (id) => id !== current.exercise && id !== prevEx && id !== nextEx
  );
  if (candidates.length === 0) {
    candidates = allowedPool.filter((id) => id !== current.exercise);
  }
  if (candidates.length === 0) return state;

  const rng = createEngineRng(
    (state.seed ^ ((state.currentIndex + 1) * 2654435761)) >>> 0
  );
  const newExercise: ExerciseId = candidates[Math.floor(rng() * candidates.length)];
  const replacement = buildEncounter(
    current.stageNumber,
    newExercise,
    current.isBoss,
    state.isSampleRun
  );

  const nextEncounters = state.encounters.map((enc, idx) =>
    idx === state.currentIndex ? replacement : enc
  );

  const draft: DungeonRunState = {
    ...state,
    encounters: nextEncounters,
    swapsRemaining: state.swapsRemaining - 1,
    usedSwap: true,
  };

  return {
    ...draft,
    sideObjectives: evaluateSideObjectives(draft),
  };
}

export function buildDungeonSummary(options: {
  state: DungeonRunState;
  endedAtMs: number;
  guardResult: { verdict: Verdict; score: number; flags: string[] };
  livenessPassed: number;
  livenessFailed: number;
  verifiedRepsBefore: VerifiedRepCounts;
  totalXpBefore: number;
}): DungeonSummaryData {
  const {
    state,
    endedAtMs,
    guardResult,
    livenessPassed,
    livenessFailed,
    verifiedRepsBefore,
    totalXpBefore,
  } = options;

  const combinedGuard = combineGuardVerdict(guardResult, livenessFailed);

  const rawDurationMs =
    state.startedAtMs !== null ? Math.max(0, endedAtMs - state.startedAtMs) : 0;
  const minSumRepMs = state.countedReps.reduce((acc, r) => acc + r.durationMs, 0);
  const durationMs = Math.max(rawDurationMs, minSumRepMs);

  const engineResult = finalizeDungeonRun(
    state.countedReps,
    durationMs,
    combinedGuard.verdict,
    totalXpBefore
  );

  const reasonSet = new Set<string>([
    ...combinedGuard.flags,
    ...engineResult.reasons,
  ]);
  const reasonCodes = Array.from(reasonSet);

  const countedRepsByExercise = createEmptyVerifiedReps();
  for (const r of state.countedReps) {
    countedRepsByExercise[r.exercise] += 1;
  }

  const officialXp = engineResult.xp;
  const totalXpAfter =
    engineResult.verdict === 'verified'
      ? Math.min(ENGINE_XP_CAP, totalXpBefore + officialXp)
      : totalXpBefore;

  const verifiedRepsAfter: VerifiedRepCounts = { ...verifiedRepsBefore };
  if (engineResult.verdict === 'verified') {
    for (const ex of ALL_EXERCISE_IDS) {
      verifiedRepsAfter[ex] += countedRepsByExercise[ex];
    }
  }

  let xpDiffReason: XpDifferenceReason = 'none';
  if (officialXp !== state.tentativeXpEarned) {
    if (engineResult.verdict === 'rejected') {
      xpDiffReason = 'rejected_zero';
    } else if (engineResult.verdict === 'review') {
      xpDiffReason = 'review_held';
    } else if (totalXpBefore + officialXp >= ENGINE_XP_CAP) {
      xpDiffReason = 'xp_cap';
    } else {
      xpDiffReason = 'recheck_adjusted';
    }
  }

  const defeatedMonsters = state.encounters.filter((e) => e.defeated).length;

  return {
    seed: state.seed,
    isSampleRun: state.isSampleRun,
    completedAllMonsters: defeatedMonsters === state.encounters.length,
    defeatedMonsters,
    totalMonsters: state.encounters.length,
    verdict: engineResult.verdict,
    accepted: engineResult.accepted,
    reasonCodes,
    tentativeXp: state.tentativeXpEarned,
    officialXp,
    xpDiffReason,
    hitXpCap: totalXpAfter >= ENGINE_XP_CAP,
    countedReps: state.countedReps.length,
    rejectedReps: state.rejectedRepCount,
    cancelledReps: state.cancelledRepCount,
    livenessPassed,
    livenessFailed,
    maxCombo: state.maxCombo,
    critCount: state.critCount,
    sideObjectives: evaluateSideObjectives(state),
    levelBefore: getLevelFromXp(totalXpBefore),
    levelAfter: getLevelFromXp(totalXpAfter),
    totalXpBefore,
    totalXpAfter,
    statsBefore: computeCharacterStats(verifiedRepsBefore),
    statsAfter: computeCharacterStats(verifiedRepsAfter),
    countedRepsByExercise,
    durationMs,
    engineResult,
  };
}

export function getExerciseMeta(id: ExerciseId) {
  const def = getExerciseDef(id);
  return {
    id: def.id,
    baseXp: def.baseXp,
    holdMs: def.holdMs,
  };
}