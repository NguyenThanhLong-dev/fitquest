'use client';

import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { i18n } from '@/lib/i18n';

// Mặc định dùng 640x480 để tối ưu FPS cho MediaPipe Lite cục bộ.
const CAMERA_PRESETS = {
  '480p': { width: 640, height: 480 },
  '720p': { width: 1280, height: 720 },
} as const;
const ACTIVE_CAMERA_PRESET: keyof typeof CAMERA_PRESETS = '480p';
const CAMERA = CAMERA_PRESETS[ACTIVE_CAMERA_PRESET];

export interface VideoSize {
  width: number;
  height: number;
}

export interface CameraViewProps {
  /** Ref trỏ tới thẻ <video> để usePoseLandmarker đọc khung hình cục bộ. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Gọi khi camera sẵn sàng (kèm videoWidth/videoHeight thật) hoặc khi dừng/tắt/lỗi. */
  onReadyChange?: (ready: boolean, size: VideoSize | null) => void;
  /** Bật/tắt camera chủ động (mặc định true). Khi false sẽ tắt mọi track ngay lập tức. */
  enabled?: boolean;
  /** Callback khi người dùng bấm nút "Bật camera" ngay trên khung đang tắt. */
  onRequestEnable?: () => void;
  /** Lật ngang hình như soi gương (đồng bộ với PoseOverlay). */
  mirrored?: boolean;
  /** Các lớp hiển thị đè lên video (PoseOverlay, HUD, ChallengeModal...). */
  children?: ReactNode;
}

type CameraStatus = 'off' | 'starting' | 'ready' | 'error';

/** Rút gọn lỗi gốc từ trình duyệt để hiển thị dòng chẩn đoán nhỏ. */
function formatCameraError(err: unknown): string {
  if (err instanceof Error) {
    return err.name && err.name !== 'Error'
      ? `${err.name}: ${err.message}`
      : err.message;
  }
  return String(err);
}

/** Chuyển mã lỗi getUserMedia sang thông báo tiếng Việt thân thiện, rõ nguyên nhân. */
function getCameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return i18n.play.camera.permissionDenied;
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return i18n.play.camera.notFound;
      case 'NotReadableError':
      case 'TrackStartError':
        return i18n.play.camera.inUse;
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return i18n.play.camera.overconstrained;
      case 'SecurityError':
        return i18n.play.camera.securityError;
      default:
        return i18n.play.camera.genericError;
    }
  }
  return i18n.play.camera.genericError;
}

/**
 * Mở webcam nội bộ (chỉ lấy video, không gửi dữ liệu ra mạng):
 * - Có dòng nhỏ giải thích quyền riêng tư ngay trên màn hình xin mở camera.
 * - Hỗ trợ bật/tắt chủ động qua prop `enabled`: tắt là dừng toàn bộ track và tắt đèn camera ngay.
 * - Dọn dẹp bắt buộc khi rời trang (giữ nguyên chuẩn F2).
 */
export function CameraView({
  videoRef,
  onReadyChange,
  enabled = true,
  onRequestEnable,
  mirrored = true,
  children,
}: CameraViewProps) {
  const [status, setStatus] = useState<CameraStatus>(
    enabled ? 'starting' : 'off'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [realSize, setRealSize] = useState<VideoSize | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  const onReadyChangeRef = useRef(onReadyChange);
  useEffect(() => {
    onReadyChangeRef.current = onReadyChange;
  }, [onReadyChange]);

  useEffect(() => {
    const videoEl = videoRef.current;

    // Nếu người dùng chủ động bấm "Tắt camera" -> đảm bảo không giữ stream và báo ready = false
    if (!enabled) {
      setStatus('off');
      setErrorMessage(null);
      setErrorDetail(null);
      setRealSize(null);
      if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
      }
      onReadyChangeRef.current?.(false, null);
      return;
    }

    let cancelled = false;
    let activeStream: MediaStream | null = null;

    const syncRealSize = () => {
      if (!videoEl || cancelled) return;
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        const nextSize: VideoSize = {
          width: videoEl.videoWidth,
          height: videoEl.videoHeight,
        };
        setRealSize(nextSize);
        onReadyChangeRef.current?.(true, nextSize);
      }
    };

    async function startCamera() {
      setStatus('starting');
      setErrorMessage(null);
      setErrorDetail(null);
      setRealSize(null);
      onReadyChangeRef.current?.(false, null);

      if (!navigator.mediaDevices?.getUserMedia) {
        const detail = 'navigator.mediaDevices.getUserMedia is unavailable';
        setErrorMessage(i18n.play.camera.unsupported);
        setErrorDetail(detail);
        setStatus('error');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: CAMERA.width },
            height: { ideal: CAMERA.height },
            facingMode: 'user',
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        activeStream = stream;
        if (!videoEl) return;

        videoEl.srcObject = stream;
        videoEl.addEventListener('resize', syncRealSize);

        await new Promise<void>((resolve) => {
          if (videoEl.readyState >= HTMLMediaElement.HAVE_METADATA) {
            resolve();
            return;
          }
          const onMeta = () => {
            videoEl.removeEventListener('loadedmetadata', onMeta);
            resolve();
          };
          videoEl.addEventListener('loadedmetadata', onMeta);
        });

        if (cancelled) return;

        await videoEl.play();
        if (cancelled) return;

        setStatus('ready');
        syncRealSize();
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(getCameraErrorMessage(err));
        setErrorDetail(formatCameraError(err));
        setStatus('error');
        onReadyChangeRef.current?.(false, null);
      }
    }

    startCamera();

    // Dọn dẹp bắt buộc: tắt mọi track của stream để đèn webcam tắt ngay khi tắt camera hoặc rời trang
    return () => {
      cancelled = true;
      videoEl?.removeEventListener('resize', syncRealSize);
      activeStream?.getTracks().forEach((track) => track.stop());
      if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
      }
      onReadyChangeRef.current?.(false, null);
    };
  }, [videoRef, enabled, retryCount]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-xl"
      style={{
        aspectRatio: realSize
          ? `${realSize.width} / ${realSize.height}`
          : `${CAMERA.width} / ${CAMERA.height}`,
      }}
    >
      {/* Khung video webcam: object-contain và lật ngang khớp hoàn toàn với PoseOverlay */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-contain ${
          mirrored ? '-scale-x-100' : ''
        } ${status === 'off' ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Lớp phủ khung xương và HUD chỉ hiện khi camera đang chạy */}
      {status === 'ready' && realSize && children}

      {/* Trạng thái camera đang tắt chủ động */}
      {status === 'off' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 text-center">
          <div className="text-4xl" aria-hidden="true">
            📷
          </div>
          <p className="text-base font-bold text-white">
            {i18n.play.camera.offTitle}
          </p>
          <p className="max-w-md text-xs leading-relaxed text-slate-300">
            {i18n.play.camera.offDesc}
          </p>
          {onRequestEnable && (
            <button
              type="button"
              onClick={onRequestEnable}
              className="mt-1 cursor-pointer rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400"
            >
              {i18n.play.camera.turnOnButton}
            </button>
          )}
        </div>
      )}

      {/* Trạng thái đang mở / xin quyền camera (kèm dòng quyền riêng tư nhỏ) */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-200">
            {i18n.play.camera.starting}
          </p>
          <p className="max-w-md text-xs leading-relaxed text-slate-400">
            🔒 {i18n.privacy.cameraRequestLine}
          </p>
        </div>
      )}

      {/* Trạng thái lỗi camera kèm hướng dẫn tiếng Việt thân thiện + nút Thử lại lớn */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 text-center">
          <p className="max-w-md text-sm font-medium leading-relaxed text-rose-300">
            {errorMessage}
          </p>
          {errorDetail && (
            <p className="max-w-md break-all font-mono text-xs text-slate-400">
              {i18n.play.errorDetailPrefix} {errorDetail}
            </p>
          )}
          <button
            type="button"
            onClick={() => setRetryCount((n) => n + 1)}
            className="mt-1 cursor-pointer rounded-xl bg-emerald-500 px-6 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400"
          >
            {i18n.play.retryButton}
          </button>
        </div>
      )}
    </div>
  );
}