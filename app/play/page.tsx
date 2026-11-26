'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { CameraView, type VideoSize } from '@/components/CameraView';
import { PoseOverlay, type PoseOverlayHandle } from '@/components/PoseOverlay';
import { ProgressRing, type ProgressTone } from '@/components/ProgressRing';
import { SetupCheck } from '@/components/SetupCheck';
import { ChallengeModal } from '@/components/ChallengeModal';
import { usePoseLandmarker } from '@/lib/pose/usePoseLandmarker';
import { useRepCounter } from '@/lib/pose/useRepCounter';
import { LANDMARK_FILTER_CONFIG } from '@/lib/pose/landmarkFilter';
import { MIRROR_HAND_MAPPING } from '@/lib/pose/liveness';
import { useGameStore } from '@/lib/game/store';
import type { ExerciseId, Landmark } from '@/lib/pose-engine';
import { i18n } from '@/lib/i18n';

// Bật/tắt nút Debug F4 (hiện seed, lịch thử thách, trạng thái khung hình & thông số góc)
const SHOW_F4_DEBUG_BUTTON = true;

// Danh sách cố định 5 động tác của FitQuest
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

/**
 * Trang luyện tập AI ("/play") — Task F4:
 * - Lớp 0: SetupCheck chống nhấp nháy 400ms (chỉ đếm rep khi "Sẵn sàng").
 * - Lớp 3b: Lượt tập thử (Run) với 0–2 thử thách sống theo seed, 5s đếm ngược, giữ tay > vai 0,5s.
 * - Lưu tạm số lần đạt/thất bại trong Zustand (RAM) cho F5.
 */
export default function PlayPage() {
  const displayName = useGameStore((state) => state.displayName);
  const livenessStats = useGameStore((state) => state.livenessStats);

  const [selectedExercise, setSelectedExercise] = useState<ExerciseId>('squat');
  const [cameraReady, setCameraReady] = useState(false);
  const [videoSize, setVideoSize] = useState<VideoSize | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<PoseOverlayHandle | null>(null);

  const { uiState, pushFrame, reset, startNewRun, stopRun } =
    useRepCounter(selectedExercise);

  const handleCameraReadyChange = useCallback(
    (ready: boolean, size: VideoSize | null) => {
      setCameraReady(ready);
      setVideoSize(size);
    },
    []
  );

  // Vẽ khung xương rút gọn trực tiếp lên canvas (không gây re-render React)
  const handlePose = useCallback((landmarks: readonly Landmark[] | null) => {
    overlayRef.current?.draw(landmarks);
  }, []);

  // Khởi tạo MediaPipe local (/wasm, /models) và đẩy từng frame vào vòng xử lý F3+F4
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
    enabled: cameraReady,
    onPose: handlePose,
    onFrame: pushFrame,
  });

  const activeExMeta = i18n.play.practice.exercises[selectedExercise];
  const isHoldExercise = uiState.targetHoldMs > 0;
  const isAiActive = cameraReady && status === 'ready';

  const bodyScopeText =
    activeExMeta.scope === 'squat'
      ? i18n.play.practice.bodyScopeSquat
      : activeExMeta.scope === 'full'
        ? i18n.play.practice.bodyScopeFull
        : i18n.play.practice.bodyScopeUpper;

  const ringValueText = isHoldExercise
    ? `${(uiState.currentHoldMs / 1000).toFixed(1)}${i18n.play.practice.holdUnit}`
    : `${Math.round(uiState.ringProgress * 100)}%`;

  const ringSubText = isHoldExercise
    ? `/ ${(uiState.targetHoldMs / 1000).toFixed(1)}${i18n.play.practice.holdUnit}`
    : i18n.play.practice.progressLabel;

  const activeWarningReason =
    uiState.cancelledReason ??
    (!uiState.frameCheck.stableOk ? uiState.frameCheck.stableReason : null);

  const debugInfo = uiState.debug;
  const peakExceeded = debugInfo.livePeakVelocity > debugInfo.maxVelocityThreshold;
  const secondaryExceeded =
    debugInfo.secondaryValueDeg !== null &&
    debugInfo.secondaryValueDeg > debugInfo.secondaryMaxDeg;

  const metricReached =
    debugInfo.metricValue !== null &&
    (debugInfo.peakThreshold >= debugInfo.restThreshold
      ? debugInfo.metricValue >= debugInfo.peakThreshold
      : debugInfo.metricValue <= debugInfo.peakThreshold);

  const debugPhaseText =
    debugInfo.phase === 'awaitingRest'
      ? i18n.play.practice.debug.stateAwaitingRest
      : debugInfo.phase === 'active'
        ? i18n.play.practice.debug.stateActive
        : i18n.play.practice.debug.stateReady;

  const livenessTexts = i18n.play.practice.liveness;
  const debugTexts = i18n.play.practice.debug;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Thanh tiêu đề + nút Debug (bật bằng hằng số SHOW_F4_DEBUG_BUTTON) */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-emerald-400">
                {i18n.play.title}
              </h1>
              <p className="text-xs text-slate-400">
                {i18n.play.playerPrefix}{' '}
                <span className="font-medium text-slate-200">
                  {displayName.trim() || i18n.play.defaultPlayer}
                </span>
              </p>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {i18n.play.practice.modeBadge}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {SHOW_F4_DEBUG_BUTTON && (
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

        {/* Thanh Lượt tập thử (Run) + kết quả tạm Thử thách sống (lưu trong RAM) */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-white">
              {livenessTexts.runTitle}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                uiState.runActive
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {uiState.runActive
                ? livenessTexts.runActiveBadge
                : livenessTexts.runEndedBadge}
            </span>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span>
                {livenessTexts.runRepsLabel}:{' '}
                <strong className="font-mono text-white">
                  {uiState.validRepsInRun}
                </strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                {livenessTexts.statsLabel}:{' '}
                <strong className="font-mono text-emerald-300">
                  {livenessTexts.passedLabel} {livenessStats.passed}
                </strong>
                {' · '}
                <strong className="font-mono text-rose-300">
                  {livenessTexts.failedLabel} {livenessStats.failed}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startNewRun}
              className="cursor-pointer rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              {uiState.runActive
                ? livenessTexts.restartRunButton
                : livenessTexts.startNewRunButton}
            </button>

            {uiState.runActive && (
              <button
                type="button"
                onClick={stopRun}
                className="cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                {livenessTexts.endRunButton}
              </button>
            )}
          </div>
        </section>

        {/* Thanh chọn 1 trong 5 động tác */}
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

        {/* Thông báo đang tải mô hình AI */}
        {status === 'loading' && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span>{i18n.play.model.loading}</span>
          </div>
        )}

        {/* Thông báo lỗi mô hình AI + chi tiết lỗi gốc */}
        {status === 'error' && (
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

        {/* Banner kết quả thử thách sống vừa kết thúc */}
        {uiState.recentChallengeOutcome && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              uiState.recentChallengeOutcome === 'passed'
                ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200'
                : 'border-rose-500/50 bg-rose-950/60 text-rose-200'
            }`}
          >
            {uiState.recentChallengeOutcome === 'passed'
              ? livenessTexts.outcomePassed
              : livenessTexts.outcomeFailed}
          </div>
        )}

        {/* Bố cục chính: Camera + SetupCheck bên trái, HUD luyện tập bên phải */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="space-y-3">
            {/* Kiểm tra khung hình Lớp 0 (Sẵn sàng / lý do chưa đạt có chống nhấp nháy 400ms) */}
            <SetupCheck snapshot={uiState.frameCheck} aiReady={isAiActive} />

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

              {/* Nhãn góc trên trái: nhận diện, độ phân giải, FPS và GPU/CPU */}
              <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium backdrop-blur ${
                    hasPose
                      ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-700 bg-slate-900/80 text-slate-300'
                  }`}
                >
                  {hasPose ? i18n.play.hud.poseDetected : i18n.play.hud.noPose}
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

              {/* Lớp phủ Thử thách sống (Lớp 3b) khi đến lượt */}
              {isAiActive && uiState.liveness.activeChallenge && (
                <ChallengeModal challenge={uiState.liveness.activeChallenge} />
              )}

              {/* Cảnh báo nổi khi mất tư thế hoặc rep đang dở bị hủy */}
              {isAiActive &&
                !uiState.liveness.activeChallenge &&
                activeWarningReason && (
                  <div className="pointer-events-none absolute inset-x-3 bottom-3">
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm backdrop-blur ${
                        uiState.cancelledReason
                          ? 'border-rose-500/60 bg-rose-950/85 text-rose-100'
                          : 'border-amber-500/50 bg-amber-950/85 text-amber-100'
                      }`}
                    >
                      <p className="font-semibold">
                        {uiState.cancelledReason
                          ? i18n.play.practice.status.repCancelledTitle
                          : i18n.play.practice.status.poseLostTitle}
                      </p>
                      <p className="mt-0.5 text-xs opacity-90">
                        {i18n.play.practice.frameCheck.reasons[activeWarningReason]}
                      </p>
                    </div>
                  </div>
                )}
            </CameraView>

            <p className="text-center text-xs text-slate-400">
              {i18n.play.privacyNotice}
            </p>
          </div>

          {/* Cột phải: Bảng điều khiển luyện tập + Debug F4 */}
          <aside className="flex flex-col gap-4">
            {/* 1. Số rep + nút Đặt lại bộ đếm */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    {i18n.play.practice.repCountLabel}
                  </p>
                  <p className="mt-1 font-mono text-5xl font-extrabold tracking-tight text-emerald-400">
                    {uiState.repCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {activeExMeta.name} · {activeExMeta.meta}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={reset}
                  className="cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  {i18n.play.practice.resetButton}
                </button>
              </div>
            </div>

            {/* 2. Vòng tiến độ */}
            <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="mb-3 text-xs font-medium text-slate-400">
                {isHoldExercise
                  ? i18n.play.practice.holdProgressLabel
                  : i18n.play.practice.progressLabel}
              </p>

              <ProgressRing
                progress={uiState.ringProgress}
                valueText={ringValueText}
                subText={ringSubText}
                tone={uiState.frameCheck.stableOk ? uiState.hintTone : 'warning'}
              />

              {isHoldExercise && (
                <div className="mt-4 w-full space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{i18n.play.practice.reachPoseBarLabel}</span>
                    <span className="font-mono text-slate-200">
                      {Math.round(uiState.movementProgress * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-[width] duration-100 ${
                        uiState.movementProgress >= 1
                          ? 'bg-emerald-400'
                          : 'bg-sky-400'
                      }`}
                      style={{
                        width: `${Math.round(uiState.movementProgress * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Gợi ý form theo thời gian thực */}
            <div
              className={`rounded-2xl border p-4 transition-colors ${
                HINT_CARD_STYLES[isAiActive ? uiState.hintTone : 'neutral']
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
                {i18n.play.practice.formHintLabel}
              </p>
              <p className="mt-1.5 text-base font-semibold leading-snug">
                {isAiActive
                  ? uiState.hintText
                  : i18n.play.practice.status.waitingCamera}
              </p>
            </div>

            {/* 4. Chỉ số chất lượng 0–1 của rep vừa xong */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-400">
                  {i18n.play.practice.qualityLabel}
                </p>

                {uiState.lastRep && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      uiState.lastRep.counted
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {uiState.lastRep.counted
                      ? i18n.play.practice.repCountedBadge
                      : i18n.play.practice.repRejectedBadge}
                  </span>
                )}
              </div>

              {uiState.lastRep ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-2xl font-bold text-white">
                      {uiState.lastRep.quality.toFixed(2)}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      0.00 – 1.00
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        uiState.lastRep.counted
                          ? 'bg-emerald-400'
                          : 'bg-rose-400'
                      }`}
                      style={{
                        width: `${Math.round(uiState.lastRep.quality * 100)}%`,
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

            {/* 5. Bảng Debug F4 + F3 (mở bằng nút Debug phía trên) */}
            {SHOW_F4_DEBUG_BUTTON && debugOpen && (
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

                {/* Phần Debug F4: Seed, lịch thử thách, trạng thái khung hình & lý do */}
                <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
                  <p className="font-sans text-[11px] font-semibold text-slate-400">
                    {debugTexts.f4SectionTitle}
                  </p>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                    <span className="text-slate-400">{debugTexts.seedLabel}:</span>
                    <span className="text-right text-slate-100">
                      {uiState.liveness.seed} (
                      {uiState.liveness.isFixedSeed
                        ? debugTexts.seedFixedTag
                        : debugTexts.seedRandomTag}
                      )
                    </span>

                    <span className="text-slate-400">
                      {debugTexts.frameStatusLabel}:
                    </span>
                    <span
                      className={`text-right font-sans font-semibold ${
                        uiState.frameCheck.stableOk
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {uiState.frameCheck.stableOk
                        ? i18n.play.practice.frameCheck.readyBadge
                        : i18n.play.practice.frameCheck.notReadyBadge}
                    </span>

                    <span className="text-slate-400">
                      {debugTexts.frameRawLabel}:
                    </span>
                    <span className="text-right text-slate-200">
                      {uiState.frameCheck.rawOk
                        ? 'OK'
                        : uiState.frameCheck.rawReason ?? 'NO_POSE'}
                    </span>

                    <span className="text-slate-400">
                      {debugTexts.frameReasonLabel}:
                    </span>
                    <span className="text-right text-amber-200">
                      {uiState.frameCheck.stableReason ?? debugTexts.frameReasonNone}
                    </span>

                    <span className="text-slate-400">
                      {debugTexts.frameSizeLabel}:
                    </span>
                    <span className="text-right text-slate-200">
                      {uiState.frameCheck.shoulderWidthRatio !== null
                        ? uiState.frameCheck.shoulderWidthRatio.toFixed(2)
                        : '—'}{' '}
                      /{' '}
                      {uiState.frameCheck.torsoHeightRatio !== null
                        ? uiState.frameCheck.torsoHeightRatio.toFixed(2)
                        : '—'}
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

                  {/* Danh sách lịch thử thách theo seed */}
                  <div className="pt-1.5">
                    <p className="font-sans text-[11px] font-semibold text-slate-400">
                      {debugTexts.scheduleLabel} ({uiState.liveness.schedule.length})
                    </p>
                    {uiState.liveness.schedule.length === 0 ? (
                      <p className="mt-1 font-sans text-xs text-slate-500">
                        {debugTexts.scheduleEmpty}
                      </p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {uiState.liveness.schedule.map((item) => (
                          <li
                            key={item.index}
                            className="flex items-center justify-between gap-2 rounded bg-slate-900 px-2 py-1 text-[11px]"
                          >
                            <span className="font-sans text-slate-200">
                              #{item.index} {livenessTexts.prompts[item.id]} (
                              {debugTexts.scheduleTriggerPrefix} {item.triggerAfterReps}{' '}
                              {debugTexts.scheduleRepsUnit} &{' '}
                              {(item.triggerAfterMs / 1000).toFixed(1)}s)
                            </span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold ${
                                item.status === 'passed'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : item.status === 'failed'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : item.status === 'active'
                                      ? 'bg-amber-500/20 text-amber-200'
                                      : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {livenessTexts.scheduleItemStatuses[item.status]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Phần Debug F3: Góc, thời gian giữ & tốc độ */}
                <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
                  <p className="font-sans text-[11px] font-semibold text-slate-400">
                    {debugTexts.f3SectionTitle}
                  </p>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                    <span className="text-slate-400">
                      {debugInfo.isAngleExercise
                        ? debugTexts.metricAngleLabel
                        : debugTexts.metricRatioLabel}
                      :
                    </span>
                    <span
                      className={`text-right font-semibold ${
                        metricReached ? 'text-emerald-300' : 'text-sky-300'
                      }`}
                    >
                      {debugInfo.metricValue !== null
                        ? debugInfo.isAngleExercise
                          ? `${debugInfo.metricValue.toFixed(1)}° / ${debugInfo.peakThreshold.toFixed(1)}°`
                          : `${debugInfo.metricValue.toFixed(2)} → ${debugInfo.peakThreshold.toFixed(2)}`
                        : '—'}
                    </span>

                    <span className="text-slate-400">
                      {debugTexts.secondaryLabels[debugInfo.secondaryKind]}:
                    </span>
                    <span
                      className={`text-right ${
                        secondaryExceeded ? 'text-amber-300' : 'text-slate-200'
                      }`}
                    >
                      {debugInfo.secondaryValueDeg !== null
                        ? `${debugInfo.secondaryValueDeg.toFixed(1)}° / ≤ ${debugInfo.secondaryMaxDeg}°`
                        : '—'}
                    </span>

                    <span className="text-slate-400">
                      {debugTexts.holdTimeLabel}:
                    </span>
                    <span className="text-right text-slate-100">
                      {debugInfo.targetHoldMs > 0
                        ? `${(debugInfo.currentHoldMs / 1000).toFixed(2)}s / ${(debugInfo.targetHoldMs / 1000).toFixed(2)}s`
                        : debugTexts.holdNotApplicable}
                    </span>

                    <span className="text-slate-400">{debugTexts.stateLabel}:</span>
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
                      {debugInfo.livePeakVelocity.toFixed(2)} /{' '}
                      {debugInfo.maxVelocityThreshold.toFixed(2)}{' '}
                      {debugTexts.velocityUnit}
                    </span>
                  </div>

                  <div className="pt-1">
                    <p className="font-sans text-[11px] font-semibold text-slate-400">
                      {debugTexts.lastRejectionLabel}
                    </p>
                    {debugInfo.lastRejection ? (
                      <div className="mt-1 space-y-1">
                        <p className="font-sans text-xs text-rose-300">
                          {debugInfo.lastRejection.reasonText}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {debugTexts.flagsPrefix}{' '}
                          {debugInfo.lastRejection.flags.join(', ') || '—'} ·{' '}
                          {debugInfo.lastRejection.peakVelocity.toFixed(2)}{' '}
                          {debugTexts.velocityUnit} ·{' '}
                          {(debugInfo.lastRejection.durationMs / 1000).toFixed(2)}s
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 font-sans text-xs text-slate-500">
                        {debugTexts.noRejection}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}