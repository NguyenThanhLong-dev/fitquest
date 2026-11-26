'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Frame, Landmark } from '@/lib/pose-engine';
import { i18n } from '@/lib/i18n';

// Đường dẫn nội bộ trong thư mục public/ (không tải từ mạng ngoài)
const LOCAL_WASM_DIR = '/wasm';
const LOCAL_MODEL_PATH = '/models/pose_landmarker_lite.task';

// Danh sách file local bắt buộc phải có trong public/
const REQUIRED_LOCAL_ASSETS = [
  '/wasm/vision_wasm_internal.js',
  '/wasm/vision_wasm_internal.wasm',
  '/wasm/vision_wasm_module_internal.js',
  '/wasm/vision_wasm_module_internal.wasm',
  LOCAL_MODEL_PATH,
] as const;

const POSE_LANDMARK_COUNT = 33;
// Mảng rỗng dùng chung để không cấp phát lại khi khung hình không có người
const EMPTY_LANDMARKS: Landmark[] = [];

// Ngưỡng ~28ms giữ ổn định 30 FPS trên webcam 30Hz và bảo đảm dt đủ lớn cho phép tính tốc độ
const MIN_DETECT_INTERVAL_MS = 28;

// Tính FPS trung bình trượt 1 giây, cập nhật UI mỗi ~500ms
const FPS_WINDOW_MS = 1000;
const FPS_UI_UPDATE_MS = 500;
const TS_BUFFER_SIZE = 128;

export type ModelStatus = 'loading' | 'ready' | 'error';
export type ComputeDelegate = 'GPU' | 'CPU';

export interface UsePoseLandmarkerOptions {
  /** Ref trỏ tới thẻ <video> đang phát webcam cục bộ. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Chỉ chạy vòng lặp nhận diện khi camera đã sẵn sàng. */
  enabled: boolean;
  /**
   * Callback nhận bộ đệm 33 khớp tái sử dụng để vẽ canvas trực tiếp (0 cấp phát).
   */
  onPose?: (landmarks: readonly Landmark[] | null) => void;
  /**
   * Callback nhận Frame chuẩn (timestamp tính bằng ms) cho RepCounter của pose-engine.ts.
   */
  onFrame?: (frame: Frame) => void;
}

export interface UsePoseLandmarkerResult {
  status: ModelStatus;
  error: string | null;
  errorDetail: string | null;
  delegate: ComputeDelegate | null;
  detectionFps: number;
  hasPose: boolean;
  retry: () => void;
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.name && err.name !== 'Error'
      ? `${err.name}: ${err.message}`
      : err.message;
  }
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function verifyLocalAssets(): Promise<void> {
  for (const assetUrl of REQUIRED_LOCAL_ASSETS) {
    const response = await fetch(assetUrl, {
      method: 'HEAD',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} (${assetUrl})`);
    }
  }
}

/**
 * Khởi tạo MediaPipe PoseLandmarker hoàn toàn từ file local (/wasm và /models),
 * thử GPU trước rồi tự động chuyển sang CPU nếu GPU lỗi, và chạy detectForVideo()
 * trong requestAnimationFrame tối ưu hiệu năng.
 */
export function usePoseLandmarker({
  videoRef,
  enabled,
  onPose,
  onFrame,
}: UsePoseLandmarkerOptions): UsePoseLandmarkerResult {
  const [status, setStatus] = useState<ModelStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [delegate, setDelegate] = useState<ComputeDelegate | null>(null);
  const [detectionFps, setDetectionFps] = useState<number>(0);
  const [hasPose, setHasPose] = useState<boolean>(false);
  const [reloadCount, setReloadCount] = useState<number>(0);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  // Bộ đệm 33 điểm tái sử dụng để vẽ canvas không cấp phát object mỗi frame
  const landmarkPoolRef = useRef<Landmark[] | null>(null);
  if (landmarkPoolRef.current === null) {
    landmarkPoolRef.current = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0,
    }));
  }

  const onPoseRef = useRef(onPose);
  useEffect(() => {
    onPoseRef.current = onPose;
  }, [onPose]);

  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const retry = useCallback(() => {
    setReloadCount((n) => n + 1);
  }, []);

  // 1. Khởi tạo MediaPipe đúng 1 lần phía client từ /wasm và /models
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    async function initLandmarker() {
      setStatus('loading');
      setError(null);
      setErrorDetail(null);
      setDelegate(null);

      try {
        await verifyLocalAssets();
      } catch (assetErr) {
        console.error(
          '[FitQuest] Không tải được file WASM/model nội bộ trong public/wasm hoặc public/models:',
          assetErr
        );
        if (!cancelled) {
          setError(i18n.play.model.assetLoadError);
          setErrorDetail(formatError(assetErr));
          setStatus('error');
        }
        return;
      }

      let PoseLandmarkerClass: typeof import('@mediapipe/tasks-vision').PoseLandmarker;
      let vision: Awaited<
        ReturnType<
          typeof import('@mediapipe/tasks-vision').FilesetResolver.forVisionTasks
        >
      >;

      try {
        const visionPkg = await import('@mediapipe/tasks-vision');
        PoseLandmarkerClass = visionPkg.PoseLandmarker;
        vision = await visionPkg.FilesetResolver.forVisionTasks(LOCAL_WASM_DIR);
      } catch (resolverErr) {
        console.error(
          '[FitQuest] Lỗi nạp MediaPipe FilesetResolver từ /wasm:',
          resolverErr
        );
        if (!cancelled) {
          setError(i18n.play.model.assetLoadError);
          setErrorDetail(formatError(resolverErr));
          setStatus('error');
        }
        return;
      }

      if (cancelled) return;

      const createWithDelegate = (targetDelegate: ComputeDelegate) =>
        PoseLandmarkerClass.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: LOCAL_MODEL_PATH,
            delegate: targetDelegate,
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });

      let instance: PoseLandmarker | null = null;
      let activeDelegate: ComputeDelegate = 'GPU';
      let gpuErr: unknown = null;

      try {
        instance = await createWithDelegate('GPU');
      } catch (err) {
        gpuErr = err;
        console.error(
          '[FitQuest] Khởi tạo PoseLandmarker với GPU thất bại, đang chuyển sang CPU:',
          err
        );

        activeDelegate = 'CPU';
        try {
          instance = await createWithDelegate('CPU');
        } catch (cpuErr) {
          console.error(
            '[FitQuest] Khởi tạo PoseLandmarker với CPU cũng thất bại:',
            cpuErr
          );

          if (!cancelled) {
            const combinedDetail = `GPU: ${formatError(gpuErr)} | CPU: ${formatError(cpuErr)}`;
            const lower = combinedDetail.toLowerCase();
            const looksLikeAssetError =
              lower.includes('404') ||
              lower.includes('failed to fetch') ||
              lower.includes('networkerror') ||
              lower.includes('magic word') ||
              lower.includes('unexpected token');

            setError(
              looksLikeAssetError
                ? i18n.play.model.assetLoadError
                : i18n.play.model.initFailedError
            );
            setErrorDetail(combinedDetail);
            setStatus('error');
          }
          return;
        }
      }

      if (cancelled) {
        instance.close();
        return;
      }

      landmarkerRef.current = instance;
      setDelegate(activeDelegate);
      setStatus('ready');
    }

    initLandmarker();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [reloadCount]);

  // 2. Vòng lặp requestAnimationFrame: bỏ qua frame trùng, đẩy pose ra canvas & RepCounter
  useEffect(() => {
    if (status !== 'ready' || !enabled) {
      setHasPose(false);
      setDetectionFps(0);
      onPoseRef.current?.(null);
      return;
    }

    const pool = landmarkPoolRef.current!;
    let rafId = 0;
    let lastVideoTime = -1;
    let lastTimestampMs = -1;
    let lastHasPose = false;

    const tsBuffer = new Float64Array(TS_BUFFER_SIZE);
    let tsHead = 0;
    let tsCount = 0;
    let firstDetectAt = 0;
    let lastFpsUiUpdate = performance.now();
    let lastReportedFps = -1;

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker) return;

      // Mốc thời gian thực bằng mili-giây (ms) theo chuẩn Frame.t của pose-engine.ts
      const now = performance.now();

      // Cập nhật FPS trung bình trượt 1 giây lên UI mỗi ~500ms
      if (now - lastFpsUiUpdate >= FPS_UI_UPDATE_MS) {
        while (tsCount > 0 && now - tsBuffer[tsHead] > FPS_WINDOW_MS) {
          tsHead = (tsHead + 1) % TS_BUFFER_SIZE;
          tsCount -= 1;
        }

        let nextFps = 0;
        if (firstDetectAt > 0 && tsCount > 0) {
          const windowMs = Math.min(
            FPS_WINDOW_MS,
            Math.max(250, now - firstDetectAt)
          );
          nextFps = Math.round((tsCount * 1000) / windowMs);
        }

        if (nextFps !== lastReportedFps) {
          lastReportedFps = nextFps;
          setDetectionFps(nextFps);
        }
        lastFpsUiUpdate = now;
      }

      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return;
      }

      // Chỉ gọi detectForVideo khi video.currentTime thay đổi
      const currentVideoTime = video.currentTime;
      if (currentVideoTime === lastVideoTime) return;

      // Bảo đảm timestamp (ms) luôn tăng thực tế tối thiểu MIN_DETECT_INTERVAL_MS (tránh dt siêu nhỏ gây TELEPORT giả)
      if (lastTimestampMs >= 0 && now - lastTimestampMs < MIN_DETECT_INTERVAL_MS) {
        return;
      }

      lastVideoTime = currentVideoTime;
      lastTimestampMs = now;

      try {
        const result = landmarker.detectForVideo(video, now);
        const firstPose = result.landmarks[0];
        const detected = Boolean(
          firstPose && firstPose.length >= POSE_LANDMARK_COUNT
        );

        if (firstDetectAt === 0) firstDetectAt = now;
        const writeIdx = (tsHead + tsCount) % TS_BUFFER_SIZE;
        tsBuffer[writeIdx] = now;
        if (tsCount < TS_BUFFER_SIZE) {
          tsCount += 1;
        } else {
          tsHead = (tsHead + 1) % TS_BUFFER_SIZE;
        }

        const aspect = video.videoWidth / video.videoHeight;

        if (detected && firstPose) {
          for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
            const src = firstPose[i];
            const dst = pool[i];
            dst.x = src.x;
            dst.y = src.y;
            dst.z = src.z;
            dst.visibility = src.visibility ?? 0;
          }

          onPoseRef.current?.(pool);

          if (!lastHasPose) {
            lastHasPose = true;
            setHasPose(true);
          }

          if (onFrameRef.current) {
            // Tạo bản sao gọn nhẹ để RepCounter.peakFrame không bị ghi đè bởi frame sau
            const lmSnapshot: Landmark[] = new Array(POSE_LANDMARK_COUNT);
            for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
              const p = pool[i];
              lmSnapshot[i] = {
                x: p.x,
                y: p.y,
                z: p.z,
                visibility: p.visibility,
              };
            }
            onFrameRef.current({ t: now, aspect, lm: lmSnapshot });
          }
        } else {
          if (lastHasPose) {
            lastHasPose = false;
            setHasPose(false);
            onPoseRef.current?.(null);
          }

          if (onFrameRef.current) {
            onFrameRef.current({ t: now, aspect, lm: EMPTY_LANDMARKS });
          }
        }
      } catch (err) {
        console.error('[FitQuest] Lỗi khi nhận diện khung hình:', err);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      onPoseRef.current?.(null);
    };
  }, [status, enabled, videoRef]);

  return {
    status,
    error,
    errorDetail,
    delegate,
    detectionFps,
    hasPose,
    retry,
  };
}