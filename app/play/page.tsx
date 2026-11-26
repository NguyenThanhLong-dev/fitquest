'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { CameraView, type VideoSize } from '@/components/CameraView';
import { PoseOverlay, type PoseOverlayHandle } from '@/components/PoseOverlay';
import { ProgressRing, type ProgressTone } from '@/components/ProgressRing';
import { usePoseLandmarker } from '@/lib/pose/usePoseLandmarker';
import { useRepCounter } from '@/lib/pose/useRepCounter';
import { LANDMARK_FILTER_CONFIG } from '@/lib/pose/landmarkFilter';
import { useGameStore } from '@/lib/game/store';
import type { ExerciseId, Landmark } from '@/lib/pose-engine';
import { i18n } from '@/lib/i18n';

// Bật/tắt bảng debug tốc độ, ngưỡng TELEPORT và lý do từ chối gần nhất bằng 1 hằng số
const SHOW_VELOCITY_DEBUG = true;

// Danh sách cố định 5 động tác của FitQuest (chế độ luyện tập F3)
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
 * Trang luyện tập AI ("/play") — Task F3:
 * Chọn 1 trong 5 động tác, làm mượt landmarks bằng One Euro Filter, đếm rep bằng RepCounter,
 * hiển thị vòng tiến độ, chất lượng rep (0–1), gợi ý form và bảng debug tốc độ (khi bật).
 */
export default function PlayPage() {
  const displayName = useGameStore((state) => state.displayName);

  const [selectedExercise, setSelectedExercise] = useState<ExerciseId>('squat');
  const [cameraReady, setCameraReady] = useState(false);
  const [videoSize, setVideoSize] = useState<VideoSize | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<PoseOverlayHandle | null>(null);

  // Hook đếm rep & phân tích form (tích hợp One Euro Filter ở tầng F3)
  const { uiState, pushFrame, reset } = useRepCounter(selectedExercise);

  const handleCameraReadyChange = useCallback(
    (ready: boolean, size: VideoSize | null) => {
      setCameraReady(ready);
      setVideoSize(size);
    },
    []
  );

  // Vẽ khung xương trực tiếp lên canvas mà không kích hoạt React re-render
  const handlePose = useCallback((landmarks: readonly Landmark[] | null) => {
    overlayRef.current?.draw(landmarks);
  }, []);

  // Khởi tạo MediaPipe local (/wasm, /models) và đẩy từng frame vào RepCounter
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

  const ringValueText = isHoldExercise
    ? `${(uiState.currentHoldMs / 1000).toFixed(1)}${i18n.play.practice.holdUnit}`
    : `${Math.round(uiState.ringProgress * 100)}%`;

  const ringSubText = isHoldExercise
    ? `/ ${(uiState.targetHoldMs / 1000).toFixed(1)}${i18n.play.practice.holdUnit}`
    : i18n.play.practice.progressLabel;

  const activeWarningReason =
    uiState.cancelledReason ?? (!uiState.gateOk ? uiState.gateReason : null);

  const debugInfo = uiState.debug;
  const peakExceeded = debugInfo.livePeakVelocity > debugInfo.maxVelocityThreshold;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Thanh tiêu đề */}
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

          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
          >
            {i18n.play.backHome}
          </Link>
        </header>

        {/* Thanh chọn 1 trong 5 động tác */}
        <section
          aria-label={i18n.play.practice.chooseExerciseLabel}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">
              {i18n.play.practice.chooseExerciseLabel}
            </h2>
            <span className="text-xs text-slate-400">
              {activeExMeta.scope === 'full'
                ? i18n.play.practice.bodyScopeFull
                : i18n.play.practice.bodyScopeUpper}
            </span>
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

        {/* Bố cục chính: Camera bên trái, HUD luyện tập bên phải */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
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

              {/* Cảnh báo nổi khi mất tư thế hoặc rep bị hủy */}
              {isAiActive && activeWarningReason && (
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
                      {i18n.play.practice.gateReasons[activeWarningReason]}
                    </p>
                  </div>
                </div>
              )}
            </CameraView>

            <p className="text-center text-xs text-slate-400">
              {i18n.play.privacyNotice}
            </p>
          </div>

          {/* Cột phải: Bảng điều khiển luyện tập F3 */}
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
                tone={uiState.gateOk ? uiState.hintTone : 'warning'}
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

            {/* 5. Khung debug tốc độ (bật/tắt bằng hằng số SHOW_VELOCITY_DEBUG ở đầu file) */}
            {SHOW_VELOCITY_DEBUG && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 font-mono text-xs text-slate-300">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {i18n.play.practice.debug.title}
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                    {i18n.play.practice.debug.filterLabel}:{' '}
                    {LANDMARK_FILTER_CONFIG.enabled
                      ? `${i18n.play.practice.debug.filterOn} (${LANDMARK_FILTER_CONFIG.minCutoff}/${LANDMARK_FILTER_CONFIG.beta})`
                      : i18n.play.practice.debug.filterOff}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <span className="text-slate-400">
                    {i18n.play.practice.debug.currentVelocityLabel}:
                  </span>
                  <span className="text-right text-slate-100">
                    {debugInfo.currentVelocity.toFixed(2)}{' '}
                    {i18n.play.practice.debug.velocityUnit}
                  </span>

                  <span className="text-slate-400">
                    {i18n.play.practice.debug.livePeakLabel}:
                  </span>
                  <span
                    className={`text-right font-semibold ${
                      peakExceeded ? 'text-rose-400' : 'text-emerald-300'
                    }`}
                  >
                    {debugInfo.livePeakVelocity.toFixed(2)}{' '}
                    {i18n.play.practice.debug.velocityUnit}
                  </span>

                  <span className="text-slate-400">
                    {i18n.play.practice.debug.lastRepPeakLabel}:
                  </span>
                  <span className="text-right text-slate-100">
                    {debugInfo.lastRepPeakVelocity !== null
                      ? `${debugInfo.lastRepPeakVelocity.toFixed(2)} ${i18n.play.practice.debug.velocityUnit}`
                      : '—'}
                  </span>

                  <span className="text-slate-400">
                    {i18n.play.practice.debug.thresholdLabel}:
                  </span>
                  <span className="text-right text-amber-300">
                    {debugInfo.maxVelocityThreshold.toFixed(2)}{' '}
                    {i18n.play.practice.debug.velocityUnit}
                  </span>
                </div>

                <div className="mt-3 border-t border-slate-800 pt-2.5">
                  <p className="font-sans text-[11px] font-semibold text-slate-400">
                    {i18n.play.practice.debug.lastRejectionLabel}
                  </p>
                  {debugInfo.lastRejection ? (
                    <div className="mt-1 space-y-1">
                      <p className="font-sans text-xs text-rose-300">
                        {debugInfo.lastRejection.reasonText}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {i18n.play.practice.debug.flagsPrefix}{' '}
                        {debugInfo.lastRejection.flags.join(', ') || '—'} ·{' '}
                        {debugInfo.lastRejection.peakVelocity.toFixed(2)}{' '}
                        {i18n.play.practice.debug.velocityUnit} ·{' '}
                        {(debugInfo.lastRejection.durationMs / 1000).toFixed(2)}s
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 font-sans text-xs text-slate-500">
                      {i18n.play.practice.debug.noRejection}
                    </p>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}