'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { CameraView, type VideoSize } from '@/components/CameraView';
import { PoseOverlay, type PoseOverlayHandle } from '@/components/PoseOverlay';
import { usePoseLandmarker } from '@/lib/pose/usePoseLandmarker';
import { useGameStore } from '@/lib/game/store';
import type { Landmark } from '@/lib/pose-engine';
import { i18n } from '@/lib/i18n';

/**
 * Trang camera thực tế ("/play") cho task F2 (đã tối ưu FPS).
 * Mở webcam 640x480 mặc định, chạy MediaPipe PoseLandmarker nội bộ,
 * vẽ khung xương trực tiếp qua canvas ref và hiển thị độ phân giải, FPS + delegate (GPU/CPU).
 */
export default function PlayPage() {
  const displayName = useGameStore((state) => state.displayName);
  const totalXp = useGameStore((state) => state.totalXp);

  // Ref dùng chung để usePoseLandmarker đọc khung hình từ thẻ <video>
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Ref điều khiển canvas vẽ khung xương trực tiếp (tránh React re-render 30 lần/giây)
  const overlayRef = useRef<PoseOverlayHandle | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [videoSize, setVideoSize] = useState<VideoSize | null>(null);

  const handleCameraReadyChange = useCallback(
    (ready: boolean, size: VideoSize | null) => {
      setCameraReady(ready);
      setVideoSize(size);
    },
    []
  );

  // Vẽ trực tiếp mỗi khi có kết quả nhận diện mới
  const handlePose = useCallback((landmarks: readonly Landmark[] | null) => {
    overlayRef.current?.draw(landmarks);
  }, []);

  // Chỉ chạy nhận diện tư thế khi camera đã sẵn sàng
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
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Thanh tiêu đề: thông tin người chơi + nút quay lại trang chủ */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3">
          <div>
            <h1 className="text-lg font-bold text-emerald-400">
              {i18n.play.title}
            </h1>
            <p className="text-xs text-slate-400">
              {i18n.play.playerPrefix}{' '}
              <span className="font-medium text-slate-200">
                {displayName.trim() || i18n.play.defaultPlayer}
              </span>{' '}
              · {i18n.play.xpPrefix}{' '}
              <span className="font-medium text-slate-200">{totalXp}</span>
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
          >
            {i18n.play.backHome}
          </Link>
        </header>

        {/* Thông báo đang tải mô hình AI */}
        {status === 'loading' && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span>{i18n.play.model.loading}</span>
          </div>
        )}

        {/* Thông báo lỗi mô hình AI + dòng lỗi gốc + nút thử lại */}
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

        {/* Khung camera + lớp vẽ khung xương */}
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

          {/* Thông số góc trên trái: trạng thái nhận diện, độ phân giải thật, FPS và delegate (GPU/CPU) */}
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
        </CameraView>

        {/* Thông báo quyền riêng tư */}
        <p className="text-center text-xs text-slate-400">
          {i18n.play.privacyNotice}
        </p>
      </div>
    </main>
  );
}