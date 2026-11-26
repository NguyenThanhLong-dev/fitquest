'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Frame, Landmark } from '@/lib/pose-engine';
import { i18n } from '@/lib/i18n';

// Đường dẫn nội bộ trong thư mục public/ (không tải từ bên ngoài)
const LOCAL_WASM_DIR = '/wasm';
const LOCAL_MODEL_PATH = '/models/pose_landmarker_lite.task';

// Danh sách các file local bắt buộc phải tồn tại trong public/
const REQUIRED_LOCAL_ASSETS = [
  '/wasm/vision_wasm_internal.js',
  '/wasm/vision_wasm_internal.wasm',
  '/wasm/vision_wasm_module_internal.js',
  '/wasm/vision_wasm_module_internal.wasm',
  LOCAL_MODEL_PATH,
] as const;

// Số điểm khớp cố định của MediaPipe Pose
const POSE_LANDMARK_COUNT = 33;

// Giới hạn tốc độ tối đa ~30 FPS khi gặp webcam 60Hz, nhưng dùng ngưỡng 28ms
// để không vô tình bỏ lỡ khung hình từ webcam 30Hz (vốn dao động tự nhiên 31–34ms).
const MIN_DETECT_INTERVAL_MS = 28;

// Cấu hình tính FPS trung bình trượt trong cửa sổ 1 giây, cập nhật UI mỗi ~500ms
const FPS_WINDOW_MS = 1000;
const FPS_UI_UPDATE_MS = 500;
const TS_BUFFER_SIZE = 128;

export type ModelStatus = 'loading' | 'ready' | 'error';
export type ComputeDelegate = 'GPU' | 'CPU';

export interface UsePoseLandmarkerOptions {
  /** Ref trỏ tới thẻ <video> đang phát webcam nội bộ. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Chỉ chạy vòng lặp nhận diện khi camera đã sẵn sàng. */
  enabled: boolean;
  /**
   * Callback nhận 33 điểm khớp trực tiếp mỗi frame (dùng chung bộ đệm tái sử dụng,
   * chỉ đọc ngay trong callback để vẽ canvas mà không gây React re-render).
   */
  onPose?: (landmarks: readonly Landmark[] | null) => void;
  /**
   * Callback tùy chọn phát Frame cho pose-engine.ts (dùng ở F3/F4).
   * Chỉ cấp phát bản sao khi callback này được truyền vào.
   */
  onFrame?: (frame: Frame) => void;
}

export interface UsePoseLandmarkerResult {
  status: ModelStatus;
  /** Thông báo lỗi tiếng Việt dễ hiểu cho người dùng. */
  error: string | null;
  /** Chuỗi lỗi kỹ thuật gốc để tiện kiểm tra / báo lỗi. */
  errorDetail: string | null;
  /** Delegate đang chạy thực tế: GPU hoặc CPU. */
  delegate: ComputeDelegate | null;
  /** FPS nhận diện tính theo trung bình trượt 1 giây (cập nhật UI mỗi ~500ms). */
  detectionFps: number;
  /** True khi đang phát hiện người trong khung hình (chỉ re-render khi đổi trạng thái). */
  hasPose: boolean;
  /** Thử khởi tạo lại mô hình khi gặp lỗi. */
  retry: () => void;
}

/** Rút gọn đối tượng lỗi thành chuỗi gọn gàng để hiển thị dòng lỗi gốc. */
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

/**
 * Kiểm tra trước các file WASM và model trong public/ để phân biệt rõ
 * lỗi thiếu/không tải được file với lỗi khởi tạo GPU/CPU.
 */
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
 * thử GPU trước rồi tự động chuyển sang CPU nếu GPU lỗi, và chạy vòng lặp
 * detectForVideo() trong requestAnimationFrame tối ưu hiệu năng (zero-allocation).
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

  // Giữ instance PoseLandmarker trong ref để chỉ khởi tạo đúng 1 lần
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  // Cấp phát sẵn đúng 1 lần bộ đệm 33 khớp để ghi đè mỗi frame (không tạo object mới mỗi frame)
  const landmarkPoolRef = useRef<Landmark[] | null>(null);
  if (landmarkPoolRef.current === null) {
    landmarkPoolRef.current = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0,
    }));
  }

  // Luôn đọc callback mới nhất từ ref để không làm khởi động lại vòng lặp
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

  // 1. Chỉ khởi tạo một lần phía client trong useEffect (hoặc khi bấm "Thử lại")
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    async function initLandmarker() {
      setStatus('loading');
      setError(null);
      setErrorDetail(null);
      setDelegate(null);

      // Bước 1: Xác minh các file WASM và model nội bộ đều tải được
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

      // Bước 2: Import động thư viện MediaPipe (chỉ chạy phía trình duyệt) và tạo FilesetResolver
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

      // Bước 3: Thử delegate GPU trước; nếu lỗi thì ghi console.error và thử lại với CPU
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

      // Nếu người dùng đã rời trang trong lúc đang tải, đóng ngay để tránh rò rỉ bộ nhớ
      if (cancelled) {
        instance.close();
        return;
      }

      landmarkerRef.current = instance;
      setDelegate(activeDelegate);
      setStatus('ready');
    }

    initLandmarker();

    // Dọn dẹp khi rời trang: giải phóng landmarker hoàn toàn
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [reloadCount]);

  // 2. Vòng lặp nhận diện tư thế bằng requestAnimationFrame
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
    let lastDetectAt = 0;
    let lastTimestampMs = -1;
    let lastHasPose = false;

    // Ring buffer cố định để tính FPS trung bình trượt 1 giây (không tạo mảng mới)
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

      const now = performance.now();

      // Cập nhật FPS lên UI mỗi ~500ms theo trung bình trượt 1 giây
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

      // Chờ thẻ video có dữ liệu hình ảnh và kích thước thật
      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return;
      }

      // Chỉ gọi detectForVideo khi video.currentTime thay đổi so với lần trước (bỏ qua frame trùng)
      const currentVideoTime = video.currentTime;
      if (currentVideoTime === lastVideoTime) return;

      // Ngăn quá tải trên webcam 60Hz mà không làm rớt nhịp webcam 30Hz
      if (now - lastDetectAt < MIN_DETECT_INTERVAL_MS) return;

      lastVideoTime = currentVideoTime;
      lastDetectAt = now;

      // Chế độ VIDEO của MediaPipe yêu cầu timestamp luôn tăng dần
      const timestampMs = now > lastTimestampMs ? now : lastTimestampMs + 0.01;
      lastTimestampMs = timestampMs;

      try {
        const result = landmarker.detectForVideo(video, timestampMs);
        const firstPose = result.landmarks[0];
        const detected = Boolean(
          firstPose && firstPose.length >= POSE_LANDMARK_COUNT
        );

        // Ghi mốc thời gian vào ring buffer để tính FPS trung bình trượt 1 giây
        if (firstDetectAt === 0) firstDetectAt = now;
        const writeIdx = (tsHead + tsCount) % TS_BUFFER_SIZE;
        tsBuffer[writeIdx] = now;
        if (tsCount < TS_BUFFER_SIZE) {
          tsCount += 1;
        } else {
          tsHead = (tsHead + 1) % TS_BUFFER_SIZE;
        }

        if (detected && firstPose) {
          // Ghi đè trực tiếp vào bộ đệm 33 khớp sẵn có (không tạo object mới mỗi frame)
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

          // Chỉ sao chép Frame khi có caller truyền onFrame (dùng ở F3/F4)
          if (onFrameRef.current) {
            const snapshot: Landmark[] = new Array(POSE_LANDMARK_COUNT);
            for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
              const p = pool[i];
              snapshot[i] = {
                x: p.x,
                y: p.y,
                z: p.z,
                visibility: p.visibility,
              };
            }
            onFrameRef.current({
              t: timestampMs,
              aspect: video.videoWidth / video.videoHeight,
              lm: snapshot,
            });
          }
        } else {
          if (lastHasPose) {
            lastHasPose = false;
            setHasPose(false);
            onPoseRef.current?.(null);
          }

          if (onFrameRef.current) {
            onFrameRef.current({
              t: timestampMs,
              aspect: video.videoWidth / video.videoHeight,
              lm: [],
            });
          }
        }
      } catch (err) {
        console.error('[FitQuest] Lỗi khi nhận diện khung hình:', err);
      }
    };

    rafId = requestAnimationFrame(tick);

    // Hủy requestAnimationFrame và xóa khung xương khi dừng hoặc rời trang
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