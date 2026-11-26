'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CameraView, type VideoSize } from '@/components/CameraView';
import { PoseOverlay, type PoseOverlayHandle } from '@/components/PoseOverlay';
import { ProgressRing, type ProgressTone } from '@/components/ProgressRing';
import { SetupCheck } from '@/components/SetupCheck';
import { ChallengeModal } from '@/components/ChallengeModal';
import { MonsterStage } from '@/components/game/MonsterStage';
import { SideObjectivesCard } from '@/components/game/SideObjectivesCard';
import { SkillsPanel } from '@/components/game/SkillsPanel';
import { RunSummary } from '@/components/game/RunSummary';
import { LevelUpBanner } from '@/components/game/LevelUpBanner';
import { usePoseLandmarker } from '@/lib/pose/usePoseLandmarker';
import { useRepCounter } from '@/lib/pose/useRepCounter';
import { useDungeonRun } from '@/lib/pose/useDungeonRun';
import { LANDMARK_FILTER_CONFIG } from '@/lib/pose/landmarkFilter';
import { MIRROR_HAND_MAPPING } from '@/lib/pose/liveness';
import { FX_CONFIG } from '@/lib/game/cosmetics';
import { unlockGameAudio } from '@/lib/game/sound';
import { useGameStore } from '@/lib/game/store';
import type { ExerciseId, Frame, Landmark } from '@/lib/pose-engine';
import { i18n } from '@/lib/i18n';

const SHOW_DEBUG_TOOLS = true;

type PlayMode = 'dungeon' | 'practice';

const EXERCISE_IDS: readonly ExerciseId[] = [
  'squat',
  'overhead_reach',
  'side_bend',
  'neck_tilt',
  'high_knees',
];

const HINT_CARD_STYLES: Record<ProgressTone, string> = {
  neutral: 'border-slate-700 bg-slate-900/90 text-slate-200',
  info: 'border-sky-500/40 bg-sky-950/50 text-sky-100',
  success: 'border-emerald-500/40 bg-emerald-950/50 text-emerald-100',
  warning: 'border-amber-500/50 bg-amber-950/50 text-amber-100',
  error: 'border-rose-500/50 bg-rose-950/60 text-rose-100',
};

export default function PlayPage() {
  const displayName = useGameStore((state) => state.displayName);
  const verifiedReps = useGameStore((state) => state.verifiedReps);
  const soundEnabled = useGameStore((state) => state.soundEnabled);
  const toggleSound = useGameStore((state) => state.toggleSound);

  const [mode, setMode] = useState<PlayMode>('dungeon');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseId>('squat');
  const [cameraReady, setCameraReady] = useState(false);
  const [videoSize, setVideoSize] = useState<VideoSize | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<PoseOverlayHandle | null>(null);
  const modeRef = useRef<PlayMode>(mode);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'practice') {
      setMode('practice');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFirstGesture = () => unlockGameAudio();
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const practice = useRepCounter(selectedExercise);
  const dungeon = useDungeonRun();

  const isShowingSummary =
    mode === 'dungeon' && dungeon.uiState.summary !== null;

  const handleCameraReadyChange = useCallback(
    (ready: boolean, size: VideoSize | null) => {
      setCameraReady(ready);
      setVideoSize(size);
    },
    []
  );

  const handlePose = useCallback((landmarks: readonly Landmark[] | null) => {
    overlayRef.current?.draw(landmarks);
  }, []);

  const handleFrame = useCallback(
    (frame: Frame) => {
      if (modeRef.current === 'dungeon') {
        dungeon.pushFrame(frame);
      } else {
        practice.pushFrame(frame);
      }
    },
    [dungeon.pushFrame, practice.pushFrame]
  );

  const {
    status,
    error,
    errorDetail,
    delegate,
    detectionFps,
    hasPose,
    retry,
  } = usePoseLandmarker({
    videoRef,
    enabled: cameraReady && !isShowingSummary,
    onPose: handlePose,
    onFrame: handleFrame,
  });

  const handleSwitchMode = useCallback(
    (nextMode: PlayMode) => {
      unlockGameAudio();
      if (nextMode === mode) return;
      if (
        nextMode === 'practice' &&
        !dungeon.uiState.paused &&
        dungeon.uiState.dungeon.phase === 'fighting'
      ) {
        dungeon.togglePause();
      }
      setMode(nextMode);
    },
    [mode, dungeon]
  );

  const handleToggleSound = useCallback(() => {
    unlockGameAudio();
    toggleSound();
  }, [toggleSound]);

  const isAiActive = cameraReady && status === 'ready';
  const isLowFps =
    isAiActive &&
    !isShowingSummary &&
    detectionFps > 0 &&
    detectionFps < FX_CONFIG.lowFpsThreshold;
  const reducedFx = prefersReducedMotion || isLowFps;

  const dungeonUi = dungeon.uiState;
  const dungeonActiveWarning =
    dungeonUi.cancelledReason ??
    (!dungeonUi.frameCheck.stableOk ? dungeonUi.frameCheck.stableReason : null);

  const practiceUi = practice.uiState;
  const activeExMeta = i18n.play.practice.exercises[selectedExercise];
  const isHoldExercise = practiceUi.targetHoldMs > 0;
  const bodyScopeText =
    activeExMeta.scope === 'squat'
      ? i18n.play.practice.bodyScopeSquat
      : activeExMeta.scope === 'torso'
        ? i18n.play.practice.bodyScopeTorso
        : activeExMeta.scope === 'full'
          ? i18n.play.practice.bodyScopeFull
          : i18n.play.practice.bodyScopeUpper;
  const practiceRingValueText = isHoldExercise
    ? `${(practiceUi.currentHoldMs / 1000).toFixed(1)}${i18n.play.practice.holdUnit}`
    : `${Math.round(practiceUi.ringProgress * 100)}%`;
  const practiceRingSubText = isHoldExercise
    ? `/ ${(practiceUi.targetHoldMs / 1000).toFixed(1)}${i18n.play.practice.holdUnit}`
    : i18n.play.practice.progressLabel;
  const practiceActiveWarning =
    practiceUi.cancelledReason ??
    (!practiceUi.frameCheck.stableOk ? practiceUi.frameCheck.stableReason : null);

  const practiceDebug = practiceUi.debug;
  const peakExceeded =
    practiceDebug.livePeakVelocity > practiceDebug.maxVelocityThreshold;
  const secondaryExceeded =
    practiceDebug.secondaryValueDeg !== null &&
    practiceDebug.secondaryValueDeg > practiceDebug.secondaryMaxDeg;
  const metricReached =
    practiceDebug.metricValue !== null &&
    (practiceDebug.peakThreshold >= practiceDebug.restThreshold
      ? practiceDebug.metricValue >= practiceDebug.peakThreshold
      : practiceDebug.metricValue <= practiceDebug.peakThreshold);
  const debugPhaseText =
    practiceDebug.phase === 'awaitingRest'
      ? i18n.play.practice.debug.stateAwaitingRest
      : practiceDebug.phase === 'active'
        ? i18n.play.practice.debug.stateActive
        : i18n.play.practice.debug.stateReady;

  const livenessTexts = i18n.play.practice.liveness;
  const debugTexts = i18n.play.practice.debug;
  const dungeonDebugTexts = i18n.dungeon.debug;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100">
      {mode === 'dungeon' && dungeonUi.levelUpCelebration && (
        <LevelUpBanner
          celebration={dungeonUi.levelUpCelebration}
          reducedFx={reducedFx}
        />
      )}

      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-lg font-black tracking-tight text-emerald-400">
                {i18n.play.title}
              </h1>
              <p className="text-xs text-slate-400">
                {i18n.play.playerPrefix}{' '}
                <span className="font-semibold text-slate-200">
                  {displayName.trim() || i18n.play.defaultPlayer}
                </span>
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => handleSwitchMode('dungeon')}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mode === 'dungeon'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {i18n.play.modeTabs.dungeon}
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('practice')}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mode === 'practice'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {i18n.play.modeTabs.practice}
              </button>
            </div>

            {reducedFx && (
              <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {i18n.dungeon.fx.reducedBadge} (
                {isLowFps
                  ? i18n.dungeon.fx.lowFpsTag
                  : i18n.dungeon.fx.reducedMotionTag}
                )
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSound}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                soundEnabled
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-950/70'
                  : 'border-slate-700 bg-slate-950 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {soundEnabled
                ? i18n.dungeon.sound.onLabel
                : i18n.dungeon.sound.offLabel}
            </button>

            {SHOW_DEBUG_TOOLS && (
              <button
                type="button"
                onClick={() => setDebugOpen((open) => !open)}
                className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  debugOpen
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {debugOpen
                  ? debugTexts.toggleHideButton
                  : debugTexts.toggleShowButton}
              </button>
            )}

            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
            >
              {i18n.play.backHome}
            </Link>
          </div>
        </header>

        {/* Thanh Debug Dungeon: thêm góc/chỉ số hiện tại, độ vào tư thế & tỷ lệ vai/thân */}
        {SHOW_DEBUG_TOOLS && debugOpen && mode === 'dungeon' && (
          <section className="rounded-2xl border border-sky-500/40 bg-slate-900/95 p-4 font-mono text-xs text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-sans text-xs font-bold uppercase tracking-wide text-sky-300">
                  {dungeonDebugTexts.title}
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-sans text-[11px] text-slate-300">
                  {dungeonUi.dungeon.isSampleRun
                    ? dungeonDebugTexts.sampleRunTag
                    : dungeonDebugTexts.normalRunTag}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    unlockGameAudio();
                    dungeon.startNewRun(true);
                  }}
                  className="cursor-pointer rounded-lg bg-sky-500 px-3 py-1.5 font-sans text-xs font-bold text-slate-950 transition hover:bg-sky-400"
                >
                  {dungeonDebugTexts.sampleRunButton}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    unlockGameAudio();
                    dungeon.startNewRun(false);
                  }}
                  className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-sans text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  {i18n.dungeon.controls.newRun}
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[11px] text-slate-400">
                  {dungeonDebugTexts.seedLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-white">
                  {dungeonUi.dungeon.seed}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[11px] text-slate-400">
                  {dungeonDebugTexts.tentativeXpLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-amber-300">
                  +{dungeonUi.dungeon.tentativeXpEarned} {i18n.dungeon.xpUnit}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[11px] text-slate-400">
                  {dungeonDebugTexts.officialXpLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-emerald-300">
                  {dungeonUi.summary
                    ? `+${dungeonUi.summary.officialXp} (${dungeonUi.summary.verdict})`
                    : dungeonDebugTexts.pendingOfficial}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[11px] text-slate-400">
                  {debugTexts.frameStatusLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-slate-100">
                  {dungeonUi.frameCheck.stableOk
                    ? i18n.play.practice.frameCheck.readyBadge
                    : dungeonUi.frameCheck.stableReason ?? 'NO_POSE'}
                  {dungeonUi.frameCheck.torsoHeightRatio !== null
                    ? ` (H:${dungeonUi.frameCheck.torsoHeightRatio.toFixed(2)})`
                    : ''}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[11px] text-slate-400">
                  {dungeonDebugTexts.liveMetricLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-sky-300">
                  {dungeonUi.liveMetric !== null
                    ? dungeonUi.isAngleExercise
                      ? `${dungeonUi.liveMetric.toFixed(1)}° / ${dungeonUi.peakThreshold.toFixed(1)}°`
                      : `${dungeonUi.liveMetric.toFixed(2)} → ${dungeonUi.peakThreshold.toFixed(2)}`
                    : '—'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[11px] text-slate-400">
                  {dungeonDebugTexts.liveHoldLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-emerald-300">
                  {Math.round(dungeonUi.movementProgress * 100)}%
                  {dungeonUi.targetHoldMs > 0
                    ? ` · ${(dungeonUi.currentHoldMs / 1000).toFixed(1)}s`
                    : ''}
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-800 pt-2.5">
              <span className="font-sans text-[11px] font-semibold text-slate-400">
                {debugTexts.scheduleLabel} ({dungeonUi.liveness.schedule.length}):
              </span>{' '}
              {dungeonUi.liveness.schedule.length === 0 ? (
                <span className="font-sans text-xs text-slate-500">
                  {debugTexts.scheduleEmpty}
                </span>
              ) : (
                <span className="font-sans text-xs text-slate-200">
                  {dungeonUi.liveness.schedule
                    .map(
                      (item) =>
                        `#${item.index} ${livenessTexts.prompts[item.id]} (${item.triggerAfterReps} rep, ${(item.triggerAfterMs / 1000).toFixed(0)}s) [${livenessTexts.scheduleItemStatuses[item.status]}]`
                    )
                    .join(' · ')}
                </span>
              )}
            </div>
          </section>
        )}

        {!isShowingSummary && status === 'loading' && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span>{i18n.play.model.loading}</span>
          </div>
        )}

        {!isShowingSummary && status === 'error' && (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
            <div className="flex-1 space-y-1">
              <p>{error}</p>
              {errorDetail && (
                <p className="break-all font-mono text-xs text-rose-300/80">
                  {i18n.play.errorDetailPrefix} {errorDetail}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={retry}
              className="shrink-0 cursor-pointer rounded-lg bg-rose-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-400"
            >
              {i18n.play.retryButton}
            </button>
          </div>
        )}

        {/* ═══════════════════════ CHẾ ĐỘ 1: DUNGEON RUN ═══════════════════════ */}
        {mode === 'dungeon' &&
          (dungeonUi.summary ? (
            <RunSummary
              summary={dungeonUi.summary}
              lootRoll={dungeonUi.lootRoll}
              chestOpened={dungeonUi.chestOpened}
              reducedFx={reducedFx}
              onOpenChest={dungeon.openLootChest}
              onPlayAgain={() => {
                unlockGameAudio();
                dungeon.startNewRun(false);
              }}
            />
          ) : (
            <div className="space-y-4">
              {dungeonUi.recentChallengeOutcome && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                    dungeonUi.recentChallengeOutcome === 'passed'
                      ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200'
                      : 'border-rose-500/50 bg-rose-950/60 text-rose-200'
                  }`}
                >
                  {dungeonUi.recentChallengeOutcome === 'passed'
                    ? livenessTexts.outcomePassed
                    : livenessTexts.outcomeFailed}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                  {dungeonUi.currentMonster && (
                    <MonsterStage
                      dungeon={dungeonUi.dungeon}
                      monster={dungeonUi.currentMonster}
                      nextMonster={dungeonUi.nextMonster}
                      xpInfo={dungeonUi.liveXpInfo}
                      activeHit={dungeonUi.activeHit}
                      hitSeq={dungeonUi.hitSeq}
                      ringProgress={dungeonUi.ringProgress}
                      movementProgress={dungeonUi.movementProgress}
                      currentHoldMs={dungeonUi.currentHoldMs}
                      targetHoldMs={dungeonUi.targetHoldMs}
                      paused={dungeonUi.paused}
                      challengeActive={
                        dungeonUi.liveness.activeChallenge !== null
                      }
                      frameReady={dungeonUi.frameCheck.stableOk}
                      hintText={
                        isAiActive
                          ? dungeonUi.hintText
                          : i18n.play.practice.status.waitingCamera
                      }
                      hintTone={isAiActive ? dungeonUi.hintTone : 'neutral'}
                      reducedFx={reducedFx}
                      breatherRemainingMs={dungeonUi.breatherRemainingMs}
                      breatherTip={dungeonUi.breatherTip}
                      bossIntroActive={dungeonUi.bossIntroActive}
                      bossFinisherActive={dungeonUi.bossFinisherActive}
                      comboCheer={dungeonUi.comboCheer}
                      onTogglePause={dungeon.togglePause}
                      onSwapMonster={dungeon.swapMonster}
                      onSkipBreather={dungeon.skipBreather}
                      onFinishRun={dungeon.finishRunNow}
                    />
                  )}

                  <SetupCheck
                    snapshot={dungeonUi.frameCheck}
                    aiReady={isAiActive}
                  />

                  <CameraView
                    videoRef={videoRef}
                    onReadyChange={handleCameraReadyChange}
                    mirrored
                  >
                    {videoSize && (
                      <PoseOverlay
                        ref={overlayRef}
                        width={videoSize.width}
                        height={videoSize.height}
                        mirrored
                      />
                    )}

                    <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium backdrop-blur ${
                          hasPose
                            ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'
                            : 'border-slate-700 bg-slate-900/80 text-slate-300'
                        }`}
                      >
                        {hasPose
                          ? i18n.play.hud.poseDetected
                          : i18n.play.hud.noPose}
                      </span>

                      {videoSize && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 font-mono text-xs text-slate-200 backdrop-blur">
                          <span>
                            {videoSize.width}×{videoSize.height}
                          </span>
                          {status === 'ready' && (
                            <>
                              <span className="text-slate-500">·</span>
                              <span
                                className={
                                  isLowFps ? 'font-bold text-amber-300' : ''
                                }
                              >
                                {detectionFps} {i18n.play.hud.fpsUnit}
                              </span>
                              {delegate && (
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    delegate === 'GPU'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  {delegate}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    {isAiActive && dungeonUi.liveness.activeChallenge && (
                      <ChallengeModal
                        challenge={dungeonUi.liveness.activeChallenge}
                      />
                    )}

                    {isAiActive &&
                      !dungeonUi.liveness.activeChallenge &&
                      !dungeonUi.paused &&
                      dungeonUi.dungeon.phase === 'fighting' &&
                      dungeonActiveWarning && (
                        <div className="pointer-events-none absolute inset-x-3 bottom-3">
                          <div
                            className={`rounded-xl border px-4 py-3 text-sm backdrop-blur ${
                              dungeonUi.cancelledReason
                                ? 'border-rose-500/60 bg-rose-950/85 text-rose-100'
                                : 'border-amber-500/50 bg-amber-950/85 text-amber-100'
                            }`}
                          >
                            <p className="font-semibold">
                              {dungeonUi.cancelledReason
                                ? i18n.play.practice.status.repCancelledTitle
                                : i18n.play.practice.status.poseLostTitle}
                            </p>
                            <p className="mt-0.5 text-xs opacity-90">
                              {
                                i18n.play.practice.frameCheck.reasons[
                                  dungeonActiveWarning
                                ]
                              }
                            </p>
                          </div>
                        </div>
                      )}
                  </CameraView>

                  <p className="text-center text-xs text-slate-400">
                    {i18n.play.privacyNotice}
                  </p>
                </div>

                <aside className="flex flex-col gap-4">
                  <SideObjectivesCard
                    objectives={dungeonUi.dungeon.sideObjectives}
                  />

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      {livenessTexts.statsLabel}
                    </p>
                    <div className="mt-2 flex items-center justify-between font-mono text-sm">
                      <span className="text-emerald-300">
                        {livenessTexts.passedLabel}:{' '}
                        <strong>{dungeonUi.liveness.passedCount}</strong>
                      </span>
                      <span className="text-rose-300">
                        {livenessTexts.failedLabel}:{' '}
                        <strong>{dungeonUi.liveness.failedCount}</strong>
                      </span>
                    </div>
                  </div>

                  <SkillsPanel
                    level={dungeonUi.liveXpInfo.level}
                    verifiedReps={verifiedReps}
                  />
                </aside>
              </div>
            </div>
          ))}

        {/* ═══════════════════════ CHẾ ĐỘ 2: LUYỆN TẬP TỰ DO ═══════════════════════ */}
        {mode === 'practice' && (
          <div className="space-y-4">
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-white">
                  {livenessTexts.runTitle}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    practiceUi.runActive
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {practiceUi.runActive
                    ? livenessTexts.runActiveBadge
                    : livenessTexts.runEndedBadge}
                </span>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <span>
                    {livenessTexts.runRepsLabel}:{' '}
                    <strong className="font-mono text-white">
                      {practiceUi.validRepsInRun}
                    </strong>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span>
                    {livenessTexts.statsLabel}:{' '}
                    <strong className="font-mono text-emerald-300">
                      {livenessTexts.passedLabel}{' '}
                      {practiceUi.liveness.passedCount}
                    </strong>
                    {' · '}
                    <strong className="font-mono text-rose-300">
                      {livenessTexts.failedLabel}{' '}
                      {practiceUi.liveness.failedCount}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={practice.startNewRun}
                  className="cursor-pointer rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  {practiceUi.runActive
                    ? livenessTexts.restartRunButton
                    : livenessTexts.startNewRunButton}
                </button>

                {practiceUi.runActive && (
                  <button
                    type="button"
                    onClick={practice.stopRun}
                    className="cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                  >
                    {livenessTexts.endRunButton}
                  </button>
                )}
              </div>
            </section>

            <section
              aria-label={i18n.play.practice.chooseExerciseLabel}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-200">
                  {i18n.play.practice.chooseExerciseLabel}
                </h2>
                <span className="text-xs text-slate-400">{bodyScopeText}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {EXERCISE_IDS.map((id) => {
                  const info = i18n.play.practice.exercises[id];
                  const isSelected = id === selectedExercise;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedExercise(id)}
                      className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-500/15 text-white shadow-sm'
                          : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="text-sm font-semibold">{info.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {info.meta}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {practiceUi.recentChallengeOutcome && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                  practiceUi.recentChallengeOutcome === 'passed'
                    ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200'
                    : 'border-rose-500/50 bg-rose-950/60 text-rose-200'
                }`}
              >
                {practiceUi.recentChallengeOutcome === 'passed'
                  ? livenessTexts.outcomePassed
                  : livenessTexts.outcomeFailed}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_350px]">
              <div className="space-y-3">
                <SetupCheck
                  snapshot={practiceUi.frameCheck}
                  aiReady={isAiActive}
                />

                <CameraView
                  videoRef={videoRef}
                  onReadyChange={handleCameraReadyChange}
                  mirrored
                >
                  {videoSize && (
                    <PoseOverlay
                      ref={overlayRef}
                      width={videoSize.width}
                      height={videoSize.height}
                      mirrored
                    />
                  )}

                  <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium backdrop-blur ${
                        hasPose
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-900/80 text-slate-300'
                      }`}
                    >
                      {hasPose
                        ? i18n.play.hud.poseDetected
                        : i18n.play.hud.noPose}
                    </span>

                    {videoSize && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 font-mono text-xs text-slate-200 backdrop-blur">
                        <span>
                          {videoSize.width}×{videoSize.height}
                        </span>
                        {status === 'ready' && (
                          <>
                            <span className="text-slate-500">·</span>
                            <span>
                              {detectionFps} {i18n.play.hud.fpsUnit}
                            </span>
                            {delegate && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  delegate === 'GPU'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {delegate}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {isAiActive && practiceUi.liveness.activeChallenge && (
                    <ChallengeModal
                      challenge={practiceUi.liveness.activeChallenge}
                    />
                  )}

                  {isAiActive &&
                    !practiceUi.liveness.activeChallenge &&
                    practiceActiveWarning && (
                      <div className="pointer-events-none absolute inset-x-3 bottom-3">
                        <div
                          className={`rounded-xl border px-4 py-3 text-sm backdrop-blur ${
                            practiceUi.cancelledReason
                              ? 'border-rose-500/60 bg-rose-950/85 text-rose-100'
                              : 'border-amber-500/50 bg-amber-950/85 text-amber-100'
                          }`}
                        >
                          <p className="font-semibold">
                            {practiceUi.cancelledReason
                              ? i18n.play.practice.status.repCancelledTitle
                              : i18n.play.practice.status.poseLostTitle}
                          </p>
                          <p className="mt-0.5 text-xs opacity-90">
                            {
                              i18n.play.practice.frameCheck.reasons[
                                practiceActiveWarning
                              ]
                            }
                          </p>
                        </div>
                      </div>
                    )}
                </CameraView>

                <p className="text-center text-xs text-slate-400">
                  {i18n.play.privacyNotice}
                </p>
              </div>

              <aside className="flex flex-col gap-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        {i18n.play.practice.repCountLabel}
                      </p>
                      <p className="mt-1 font-mono text-5xl font-extrabold tracking-tight text-emerald-400">
                        {practiceUi.repCount}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {activeExMeta.name} · {activeExMeta.meta}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={practice.reset}
                      className="cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                    >
                      {i18n.play.practice.resetButton}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <p className="mb-3 text-xs font-medium text-slate-400">
                    {isHoldExercise
                      ? i18n.play.practice.holdProgressLabel
                      : i18n.play.practice.progressLabel}
                  </p>

                  <ProgressRing
                    progress={practiceUi.ringProgress}
                    valueText={practiceRingValueText}
                    subText={practiceRingSubText}
                    tone={
                      practiceUi.frameCheck.stableOk
                        ? practiceUi.hintTone
                        : 'warning'
                    }
                  />

                  {isHoldExercise && (
                    <div className="mt-4 w-full space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{i18n.play.practice.reachPoseBarLabel}</span>
                        <span className="font-mono text-slate-200">
                          {Math.round(practiceUi.movementProgress * 100)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-[width] duration-100 ${
                            practiceUi.movementProgress >= 1
                              ? 'bg-emerald-400'
                              : 'bg-sky-400'
                          }`}
                          style={{
                            width: `${Math.round(practiceUi.movementProgress * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`rounded-2xl border p-4 transition-colors ${
                    HINT_CARD_STYLES[
                      isAiActive ? practiceUi.hintTone : 'neutral'
                    ]
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
                    {i18n.play.practice.formHintLabel}
                  </p>
                  <p className="mt-1.5 text-base font-semibold leading-snug">
                    {isAiActive
                      ? practiceUi.hintText
                      : i18n.play.practice.status.waitingCamera}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-400">
                      {i18n.play.practice.qualityLabel}
                    </p>
                    {practiceUi.lastRep && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          practiceUi.lastRep.counted
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {practiceUi.lastRep.counted
                          ? i18n.play.practice.repCountedBadge
                          : i18n.play.practice.repRejectedBadge}
                      </span>
                    )}
                  </div>

                  {practiceUi.lastRep ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-2xl font-bold text-white">
                          {practiceUi.lastRep.quality.toFixed(2)}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          0.00 – 1.00
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            practiceUi.lastRep.counted
                              ? 'bg-emerald-400'
                              : 'bg-rose-400'
                          }`}
                          style={{
                            width: `${Math.round(practiceUi.lastRep.quality * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      {i18n.play.practice.qualityEmpty}
                    </p>
                  )}
                </div>

                {SHOW_DEBUG_TOOLS && debugOpen && (
                  <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-4 font-mono text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                        {debugTexts.title}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {debugTexts.filterLabel}:{' '}
                        {LANDMARK_FILTER_CONFIG.enabled
                          ? `${debugTexts.filterOn} (${LANDMARK_FILTER_CONFIG.minCutoff}/${LANDMARK_FILTER_CONFIG.beta})`
                          : debugTexts.filterOff}
                      </span>
                    </div>

                    <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
                      <p className="font-sans text-[11px] font-semibold text-slate-400">
                        {debugTexts.f4SectionTitle}
                      </p>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                        <span className="text-slate-400">
                          {debugTexts.seedLabel}:
                        </span>
                        <span className="text-right text-slate-100">
                          {practiceUi.liveness.seed} (
                          {practiceUi.liveness.isFixedSeed
                            ? debugTexts.seedFixedTag
                            : debugTexts.seedRandomTag}
                          )
                        </span>
                        <span className="text-slate-400">
                          {debugTexts.frameStatusLabel}:
                        </span>
                        <span
                          className={`text-right font-sans font-semibold ${
                            practiceUi.frameCheck.stableOk
                              ? 'text-emerald-300'
                              : 'text-amber-300'
                          }`}
                        >
                          {practiceUi.frameCheck.stableOk
                            ? i18n.play.practice.frameCheck.readyBadge
                            : i18n.play.practice.frameCheck.notReadyBadge}
                        </span>
                        <span className="text-slate-400">
                          {debugTexts.frameReasonLabel}:
                        </span>
                        <span className="text-right text-amber-200">
                          {practiceUi.frameCheck.stableReason ??
                            debugTexts.frameReasonNone}
                        </span>
                        <span className="text-slate-400">
                          {debugTexts.mirrorMappingLabel}:
                        </span>
                        <span className="text-right font-sans text-slate-200">
                          {MIRROR_HAND_MAPPING.swapAnatomicalLeftRight
                            ? debugTexts.mirrorSwapped
                            : debugTexts.mirrorCssOnly}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
                      <p className="font-sans text-[11px] font-semibold text-slate-400">
                        {debugTexts.f3SectionTitle}
                      </p>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                        <span className="text-slate-400">
                          {practiceDebug.isAngleExercise
                            ? debugTexts.metricAngleLabel
                            : debugTexts.metricRatioLabel}
                          :
                        </span>
                        <span
                          className={`text-right font-semibold ${
                            metricReached ? 'text-emerald-300' : 'text-sky-300'
                          }`}
                        >
                          {practiceDebug.metricValue !== null
                            ? practiceDebug.isAngleExercise
                              ? `${practiceDebug.metricValue.toFixed(1)}° / ${practiceDebug.peakThreshold.toFixed(1)}°`
                              : `${practiceDebug.metricValue.toFixed(2)} → ${practiceDebug.peakThreshold.toFixed(2)}`
                            : '—'}
                        </span>
                        <span className="text-slate-400">
                          {
                            debugTexts.secondaryLabels[
                              practiceDebug.secondaryKind
                            ]
                          }
                          :
                        </span>
                        <span
                          className={`text-right ${
                            secondaryExceeded
                              ? 'text-amber-300'
                              : 'text-slate-200'
                          }`}
                        >
                          {practiceDebug.secondaryValueDeg !== null
                            ? `${practiceDebug.secondaryValueDeg.toFixed(1)}° / ≤ ${practiceDebug.secondaryMaxDeg}°`
                            : '—'}
                        </span>
                        <span className="text-slate-400">
                          {debugTexts.holdTimeLabel}:
                        </span>
                        <span className="text-right text-slate-100">
                          {practiceDebug.targetHoldMs > 0
                            ? `${(practiceDebug.currentHoldMs / 1000).toFixed(2)}s / ${(practiceDebug.targetHoldMs / 1000).toFixed(2)}s`
                            : debugTexts.holdNotApplicable}
                        </span>
                        <span className="text-slate-400">
                          {debugTexts.stateLabel}:
                        </span>
                        <span className="text-right font-sans text-slate-200">
                          {debugPhaseText}
                        </span>
                        <span className="text-slate-400">
                          {debugTexts.livePeakLabel}:
                        </span>
                        <span
                          className={`text-right font-semibold ${
                            peakExceeded ? 'text-rose-400' : 'text-emerald-300'
                          }`}
                        >
                          {practiceDebug.livePeakVelocity.toFixed(2)} /{' '}
                          {practiceDebug.maxVelocityThreshold.toFixed(2)}{' '}
                          {debugTexts.velocityUnit}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}