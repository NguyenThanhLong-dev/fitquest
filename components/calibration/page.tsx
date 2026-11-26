'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CameraView, type VideoSize } from '@/components/CameraView';
import { PoseOverlay, type PoseOverlayHandle } from '@/components/PoseOverlay';
import { CalibrationGuide } from '@/components/calibration/CalibrationGuide';
import { usePoseLandmarker } from '@/lib/pose/usePoseLandmarker';
import { useCalibrationSession } from '@/lib/pose/useCalibrationSession';
import {
  CALIBRATION_MODE,
  CHEAT_TRIAL_TYPES,
  THRESHOLDS_VERSION,
  formatCalibrationCsv,
  type TrialType,
} from '@/lib/game/calibration';
import { getAllowedExercises, type PostureMode } from '@/lib/game/engineAdapter';
import { useGameStore } from '@/lib/game/store';
import type { ExerciseId, Landmark } from '@/lib/pose-engine';
import { i18n } from '@/lib/i18n';

/**
 * Trang Công cụ hiệu chỉnh ("/calibrate") — Task F6a:
 * - Chỉ hoạt động khi hằng số `CALIBRATION_MODE === true`.
 * - Không sửa đổi bất kỳ ngưỡng nào của `pose-engine.ts`.
 * - Thu thập nhật ký Rep & Nhật ký Phiên (gọi `finalizeRun` + `analyzeReps`) hoàn toàn trong RAM
 *   và sao chép CSV ra clipboard bằng `navigator.clipboard.writeText`.
 */
export default function CalibratePage() {
  const displayName = useGameStore((s) => s.displayName);
  const postureMode = useGameStore((s) => s.postureMode);
  const setPostureMode = useGameStore((s) => s.setPostureMode);

  const [selectedExercise, setSelectedExercise] = useState<ExerciseId>('squat');
  const [tester, setTester] = useState<string>(() => displayName.trim());
  const [trialType, setTrialType] = useState<TrialType>('real');
  const [cheatPickerOpen, setCheatPickerOpen] = useState(false);

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [videoSize, setVideoSize] = useState<VideoSize | null>(null);

  const [copyFeedback, setCopyFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<PoseOverlayHandle | null>(null);

  const allowedExercises = getAllowedExercises(postureMode);
  const isSeated = postureMode === 'seated';

  // Đảm bảo ở chế độ Ngồi không chọn squat / high_knees
  useEffect(() => {
    if (!allowedExercises.includes(selectedExercise)) {
      setSelectedExercise(allowedExercises[0]);
    }
  }, [allowedExercises, selectedExercise]);

  const {
    telemetry,
    repLogs,
    sessionLogs,
    pushFrame,
    startFreshSession,
    finalizeCurrentSession,
    clearAllLogs,
  } = useCalibrationSession({
    exercise: selectedExercise,
    postureMode,
    tester,
    trialType,
  });

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
    enabled: CALIBRATION_MODE && cameraEnabled && cameraReady,
    onPose: handlePose,
    onFrame: pushFrame,
  });

  const handleSelectCheatTrial = useCallback(
    (nextType: Exclude<TrialType, 'real'>) => {
      setTrialType(nextType);
      setCheatPickerOpen(false);
      startFreshSession(nextType);
    },
    [startFreshSession]
  );

  const handleBackToReal = useCallback(() => {
    setTrialType('real');
    setCheatPickerOpen(false);
    startFreshSession('real');
  }, [startFreshSession]);

  const handleChangePosture = useCallback(
    (nextMode: PostureMode) => {
      if (nextMode === postureMode) return;
      setPostureMode(nextMode);
    },
    [postureMode, setPostureMode]
  );

  const handleCopyCsv = useCallback(async () => {
    const csv = formatCalibrationCsv(
      [...repLogs].reverse(),
      [...sessionLogs].reverse()
    );
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(csv);
      setCopyFeedback({
        tone: 'success',
        text: i18n.calibration.copySuccess,
      });
    } catch {
      setCopyFeedback({
        tone: 'error',
        text: i18n.calibration.copyError,
      });
    }
  }, [repLogs, sessionLogs]);

  useEffect(() => {
    if (!copyFeedback) return;
    const timer = window.setTimeout(() => setCopyFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  const calTexts = i18n.calibration;
  const telTexts = calTexts.telemetry;
  const repCols = calTexts.repLog.cols;
  const sessionCols = calTexts.sessionLog.cols;

  // Khóa hoàn toàn trang nếu hằng số CALIBRATION_MODE đang tắt
  if (!CALIBRATION_MODE) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-black text-white">
            {calTexts.disabledTitle}
          </h1>
          <p className="text-sm text-slate-300">{calTexts.disabledDesc}</p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <Link
              href="/play"
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400"
            >
              {calTexts.backToPlay}
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              {calTexts.backHome}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const metricText =
    telemetry.metric !== null
      ? telemetry.isAngle
        ? `${telemetry.metric.toFixed(1)}°`
        : telemetry.metric.toFixed(2)
      : '—';

  const thresholdPairText = telemetry.isAngle
    ? `${telemetry.restThreshold}° → ${telemetry.peakThreshold}°`
    : `${telemetry.restThreshold.toFixed(2)} → ${telemetry.peakThreshold.toFixed(2)}`;

  const progressPct =
    telemetry.progress !== null
      ? Math.max(0, Math.round(telemetry.progress * 100))
      : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:px-4 sm:py-5">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Thanh tiêu đề */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-sky-300 sm:text-xl">
                🧪 {calTexts.title}
              </h1>
              <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                {calTexts.versionLabel} {THRESHOLDS_VERSION}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{calTexts.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCameraEnabled((prev) => {
                  if (prev) overlayRef.current?.clear();
                  return !prev;
                });
              }}
              className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                cameraEnabled
                  ? 'border-rose-500/50 bg-rose-950/50 text-rose-200 hover:bg-rose-900/60'
                  : 'border-emerald-500/50 bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              {cameraEnabled
                ? `📷 ${i18n.play.camera.turnOffButton}`
                : `📷 ${i18n.play.camera.turnOnButton}`}
            </button>

            <Link
              href="/play"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              {calTexts.backToPlay}
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              {calTexts.backHome}
            </Link>
          </div>
        </header>

        {/* Thanh thiết lập phiên thử: Người thử, Đứng/Ngồi, Kiểu thử (Thử gian lận), Chọn động tác */}
        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_auto_minmax(0,1fr)] md:items-end">
            {/* Ô nhập tên / nhãn người thử */}
            <div>
              <label
                htmlFor="calibrate-tester"
                className="block text-xs font-semibold text-slate-300"
              >
                {calTexts.testerLabel}
              </label>
              <input
                id="calibrate-tester"
                type="text"
                maxLength={40}
                value={tester}
                onChange={(e) => setTester(e.target.value)}
                placeholder={calTexts.testerPlaceholder}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
              />
            </div>

            {/* Công tắc Đứng / Ngồi */}
            <div>
              <span className="block text-xs font-semibold text-slate-300">
                {i18n.posture.label}
              </span>
              <div className="mt-1 inline-flex rounded-xl border border-slate-800 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => handleChangePosture('standing')}
                  className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                    postureMode === 'standing'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🧍 {i18n.posture.standing}
                </button>
                <button
                  type="button"
                  onClick={() => handleChangePosture('seated')}
                  className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                    postureMode === 'seated'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🪑 {i18n.posture.seated}
                </button>
              </div>
            </div>

            {/* Kiểu thử hiện tại + Nút "Bắt đầu thử gian lận" */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2">
              <div className="text-xs">
                <span className="text-slate-400">
                  {calTexts.activeTrialLabel}:{' '}
                </span>
                <span
                  className={`ml-1 inline-block rounded-full px-2.5 py-0.5 font-bold ${
                    trialType === 'real'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/25 text-amber-200'
                  }`}
                >
                  {calTexts.trialTypes[trialType]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheatPickerOpen((open) => !open)}
                  className="cursor-pointer rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-300"
                >
                  🕵️ {calTexts.startCheatButton}
                </button>

                {trialType !== 'real' && (
                  <button
                    type="button"
                    onClick={handleBackToReal}
                    className="cursor-pointer rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25"
                  >
                    ✓ {calTexts.backToRealButton}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bộ chọn 5 kiểu thử gian lận khi bấm "Bắt đầu thử gian lận" */}
          {cheatPickerOpen && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3">
              <p className="text-xs font-bold text-amber-200">
                {calTexts.cheatPickerTitle}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHEAT_TRIAL_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectCheatTrial(type)}
                    className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                      trialType === type
                        ? 'border-amber-300 bg-amber-400 text-slate-950'
                        : 'border-amber-500/40 bg-slate-950 text-amber-100 hover:bg-amber-500/20'
                    }`}
                  >
                    {calTexts.trialTypes[type]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chọn động tác */}
          <div
            className={`grid gap-2 ${
              isSeated
                ? 'grid-cols-1 sm:grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-5'
            }`}
          >
            {allowedExercises.map((id) => {
              const info = i18n.play.practice.exercises[id];
              const isSelected = id === selectedExercise;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedExercise(id)}
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition ${
                    isSelected
                      ? 'border-sky-400 bg-sky-500/15 text-white'
                      : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="text-sm font-bold">{info.name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {info.meta}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Trạng thái tải / lỗi mô hình AI */}
        {cameraEnabled && status === 'loading' && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span>{i18n.play.model.loading}</span>
          </div>
        )}

        {cameraEnabled && status === 'error' && (
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
              className="shrink-0 cursor-pointer rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
            >
              {i18n.play.retryButton}
            </button>
          </div>
        )}

        {/* Khu vực chính: Camera + Khung xương bên trái, Thông số thời gian thực ~100ms bên phải */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-3">
            <CameraView
              videoRef={videoRef}
              onReadyChange={handleCameraReadyChange}
              enabled={cameraEnabled}
              onRequestEnable={() => setCameraEnabled(true)}
              mirrored
            >
              {videoSize && (
                <PoseOverlay
                  ref={overlayRef}
                  width={videoSize.width}
                  height={videoSize.height}
                  mirrored
                  upperBodyOnly={isSeated}
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
                  {hasPose ? i18n.play.hud.poseDetected : i18n.play.hud.noPose}
                </span>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold backdrop-blur ${
                    trialType === 'real'
                      ? 'border-emerald-400/50 bg-emerald-950/80 text-emerald-200'
                      : 'border-amber-400/60 bg-amber-950/85 text-amber-200'
                  }`}
                >
                  {calTexts.trialTypes[trialType]}
                </span>
              </div>
            </CameraView>

            <p className="text-center text-xs text-slate-400">
              {i18n.play.privacyNotice}
            </p>
          </div>

          {/* Bảng thông số thời gian thực (~100ms) + Điều khiển chốt phiên & xuất CSV */}
          <aside className="flex flex-col gap-4">
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-sky-300">
                  {telTexts.title}
                </h2>
                <span className="font-mono text-xs text-slate-400">
                  {telTexts.sessionCounterLabel} #{telemetry.sessionId} ·{' '}
                  {(telemetry.sessionElapsedMs / 1000).toFixed(1)}s
                </span>
              </div>

              {/* Giá trị đo chính cạnh ngưỡng đang dùng */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    {telemetry.isAngle
                      ? telTexts.metricAngleLabel
                      : telTexts.metricRatioLabel}
                  </span>
                  <span className="font-mono text-2xl font-black text-sky-300">
                    {metricText}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span>{telTexts.thresholdLabel}</span>
                  <span className="font-mono font-bold text-slate-200">
                    {thresholdPairText} ({progressPct}%)
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-[width] duration-100 ${
                      progressPct >= 100 ? 'bg-emerald-400' : 'bg-sky-400'
                    }`}
                    style={{ width: `${Math.min(100, progressPct)}%` }}
                  />
                </div>
              </div>

              {/* Lưới thông số chi tiết */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 font-mono text-xs">
                <span className="font-sans text-slate-400">
                  {telTexts.holdLabel}:
                </span>
                <span className="text-right font-bold text-emerald-300">
                  {telemetry.targetHoldMs > 0
                    ? `${(telemetry.holdMs / 1000).toFixed(2)}s / ${(telemetry.targetHoldMs / 1000).toFixed(1)}s`
                    : telTexts.notHoldExercise}
                </span>

                <span className="font-sans text-slate-400">
                  {telTexts.repTimeBoundsLabel}:
                </span>
                <span className="text-right text-slate-200">
                  {telemetry.minRepMs}–{telemetry.maxRepMs} ms
                </span>

                <span className="font-sans text-slate-400">
                  {telTexts.velocityLabel}:
                </span>
                <span
                  className={`text-right font-bold ${
                    telemetry.liveVelocity > telemetry.maxVelocityThreshold
                      ? 'text-rose-400'
                      : 'text-slate-200'
                  }`}
                >
                  {telemetry.liveVelocity.toFixed(2)} /{' '}
                  {telemetry.maxVelocityThreshold.toFixed(2)} p/s
                </span>

                <span className="font-sans text-slate-400">
                  {telTexts.fpsDelegateLabel}:
                </span>
                <span className="text-right text-slate-100">
                  {detectionFps} FPS · {delegate ?? '—'}
                </span>

                <span className="font-sans text-slate-400">
                  {telTexts.qualityGateLabel}:
                </span>
                <span
                  className={`text-right font-bold ${
                    telemetry.engineQualityGate.ok
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }`}
                >
                  {telemetry.engineQualityGate.ok
                    ? telTexts.gateOk
                    : telemetry.engineQualityGate.reason ?? 'NO_POSE'}
                </span>

                <span className="font-sans text-slate-400">
                  {telTexts.frameCheckLabel}:
                </span>
                <span
                  className={`text-right font-bold ${
                    telemetry.frameCheck.ok
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }`}
                >
                  {telemetry.frameCheck.ok
                    ? telTexts.gateOk
                    : telemetry.frameCheck.reason ?? 'NO_POSE'}
                </span>
              </div>

              {/* Lý do hiện tại chưa tính rep */}
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {telTexts.reasonLabel}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-amber-200">
                  {telemetry.notCountedReason}
                </p>
              </div>

              {/* Đếm rep phiên hiện tại + nút Chốt phiên gọi finalizeRun */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-xs">
                <span className="text-slate-300">
                  {telTexts.sessionCounterLabel} #{telemetry.sessionId}:
                </span>
                <span className="font-mono font-bold">
                  <span className="text-emerald-400">
                    {telemetry.sessionCountedReps} {calTexts.repLog.yes}
                  </span>
                  {' · '}
                  <span className="text-rose-300">
                    {telemetry.sessionRejectedReps} {calTexts.repLog.no}
                  </span>
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={finalizeCurrentSession}
                  className="cursor-pointer rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400"
                >
                  ✓ {calTexts.finalizeSessionButton}
                </button>
                <button
                  type="button"
                  onClick={() => startFreshSession()}
                  className="cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-800"
                >
                  ↺ {calTexts.newSessionButton}
                </button>
              </div>
            </div>

            {/* Xuất CSV vào clipboard + Xoá nhật ký */}
            <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyCsv}
                  className="flex-1 cursor-pointer rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-sky-400"
                >
                  📋 {calTexts.copyCsvButton} ({repLogs.length} /{' '}
                  {sessionLogs.length})
                </button>
                <button
                  type="button"
                  onClick={clearAllLogs}
                  className="cursor-pointer rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-2.5 text-xs font-bold text-rose-200 transition hover:bg-rose-900/50"
                >
                  🗑️ {calTexts.clearLogsButton}
                </button>
              </div>

              {copyFeedback && (
                <p
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    copyFeedback.tone === 'success'
                      ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200'
                      : 'border-rose-500/40 bg-rose-950/50 text-rose-200'
                  }`}
                >
                  {copyFeedback.text}
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* Bảng Nhật ký Phiên — finalizeRun() */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3">
            <h2 className="text-sm font-extrabold text-white">
              {calTexts.sessionLog.title} ({sessionLogs.length})
            </h2>
          </div>

          {sessionLogs.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">
              {calTexts.sessionLog.empty}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
                    <th className="px-3 py-2">{sessionCols.session}</th>
                    <th className="px-3 py-2">{sessionCols.tester}</th>
                    <th className="px-3 py-2">{sessionCols.trial}</th>
                    <th className="px-3 py-2">{sessionCols.exercise}</th>
                    <th className="px-3 py-2">{sessionCols.reps}</th>
                    <th className="px-3 py-2">{sessionCols.verdict}</th>
                    <th className="px-3 py-2">{sessionCols.analyze}</th>
                    <th className="px-3 py-2">{sessionCols.reasons}</th>
                    <th className="px-3 py-2 text-right">{sessionCols.xp}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {sessionLogs.map((s) => (
                    <tr key={`${s.sessionId}-${s.timestampIso}`}>
                      <td className="px-3 py-2">#{s.sessionId}</td>
                      <td className="px-3 py-2 font-sans">{s.tester}</td>
                      <td className="px-3 py-2 font-sans">
                        {calTexts.trialTypes[s.trialType]}
                      </td>
                      <td className="px-3 py-2 font-sans">
                        {i18n.play.practice.exercises[s.exercise].name} (
                        {s.postureMode === 'seated'
                          ? i18n.posture.seated
                          : i18n.posture.standing}
                        )
                      </td>
                      <td className="px-3 py-2">
                        {s.countedReps}/{s.totalReps}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            s.verdict === 'verified'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : s.verdict === 'review'
                                ? 'bg-amber-500/20 text-amber-200'
                                : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {s.verdict}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {s.analyzeScore.toFixed(2)}{' '}
                        {s.analyzeFlags.length > 0
                          ? `[${s.analyzeFlags.join(', ')}]`
                          : '[]'}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {s.reasons.length > 0 ? s.reasons.join(', ') : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-300">
                        +{s.xp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Bảng Nhật ký Rep (RAM) */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3">
            <h2 className="text-sm font-extrabold text-white">
              {calTexts.repLog.title} ({repLogs.length})
            </h2>
          </div>

          {repLogs.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">
              {calTexts.repLog.empty}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
                    <th className="px-3 py-2">{repCols.index}</th>
                    <th className="px-3 py-2">{repCols.session}</th>
                    <th className="px-3 py-2">{repCols.tester}</th>
                    <th className="px-3 py-2">{repCols.trial}</th>
                    <th className="px-3 py-2">{repCols.exercise}</th>
                    <th className="px-3 py-2">{repCols.posture}</th>
                    <th className="px-3 py-2">{repCols.counted}</th>
                    <th className="px-3 py-2">{repCols.peakMetric}</th>
                    <th className="px-3 py-2">{repCols.duration}</th>
                    <th className="px-3 py-2">{repCols.quality}</th>
                    <th className="px-3 py-2">{repCols.flags}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {repLogs.map((r) => (
                    <tr key={`${r.index}-${r.timestampIso}`}>
                      <td className="px-3 py-2">{r.index}</td>
                      <td className="px-3 py-2">#{r.sessionId}</td>
                      <td className="px-3 py-2 font-sans">{r.tester}</td>
                      <td className="px-3 py-2 font-sans">
                        {calTexts.trialTypes[r.trialType]}
                      </td>
                      <td className="px-3 py-2 font-sans">
                        {i18n.play.practice.exercises[r.exercise].name}
                      </td>
                      <td className="px-3 py-2 font-sans">
                        {r.postureMode === 'seated'
                          ? i18n.posture.seated
                          : i18n.posture.standing}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 font-sans text-[10px] font-bold ${
                            r.counted
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {r.counted ? calTexts.repLog.yes : calTexts.repLog.no}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.peakMetric !== null ? r.peakMetric.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {(r.durationMs / 1000).toFixed(2)}s
                      </td>
                      <td className="px-3 py-2">{r.quality.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-300">
                        {r.flags.length > 0 ? r.flags.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Hướng dẫn ngắn bằng tiếng Việt cho người thử */}
        <CalibrationGuide activeTrialType={trialType} />
      </div>
    </main>
  );
}