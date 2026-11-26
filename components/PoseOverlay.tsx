'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Landmark } from '@/lib/pose-engine';

/**
 * Các đoạn nối xương chuẩn của 33 điểm MediaPipe Pose.
 * Khai báo tĩnh ở mức module để không bao giờ tạo lại mảng mới mỗi frame.
 */
const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Khuôn mặt
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Thân trên
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Tay trái
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // Tay phải
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Chân trái
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // Chân phải
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

const TWO_PI = Math.PI * 2;
// Chỉ vẽ các khớp đạt ngưỡng hiển thị tối thiểu
const DRAW_MIN_VISIBILITY = 0.5;
// Khớp với ngưỡng qualityGate (0.6) trong pose-engine.ts: xanh = rõ, vàng = hơi mờ
const RELIABLE_VISIBILITY = 0.6;

export interface PoseOverlayHandle {
  /** Vẽ trực tiếp lên canvas (không kích hoạt React re-render mỗi frame). */
  draw: (landmarks: readonly Landmark[] | null) => void;
  /** Xóa sạch khung xương trên canvas. */
  clear: () => void;
}

export interface PoseOverlayProps {
  /** Kích thước thật video.videoWidth từ webcam. */
  width: number;
  /** Kích thước thật video.videoHeight từ webcam. */
  height: number;
  /** Phải trùng với prop mirrored của CameraView để xương khớp chính xác cơ thể. */
  mirrored?: boolean;
}

/**
 * Canvas trong suốt phủ đúng kích thước video.
 * Gộp đường vẽ xương và điểm khớp thành tối đa 3 lượt vẽ (stroke/fill) mỗi frame
 * và vẽ trực tiếp qua ref để React không phải render lại 30 lần/giây.
 */
export const PoseOverlay = forwardRef<PoseOverlayHandle, PoseOverlayProps>(
  function PoseOverlay({ width, height, mirrored = true }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    // Lấy sẵn context 2D một lần khi canvas gắn vào DOM
    useEffect(() => {
      const canvas = canvasRef.current;
      ctxRef.current = canvas ? canvas.getContext('2d') : null;
    }, [width, height]);

    useImperativeHandle(
      ref,
      () => ({
        clear() {
          const canvas = canvasRef.current;
          const ctx = ctxRef.current ?? canvas?.getContext('2d') ?? null;
          if (!canvas || !ctx) return;
          ctxRef.current = ctx;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        },

        draw(landmarks) {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = ctxRef.current ?? canvas.getContext('2d');
          if (!ctx) return;
          ctxRef.current = ctx;

          const w = canvas.width;
          const h = canvas.height;
          if (w <= 0 || h <= 0) return;

          ctx.clearRect(0, 0, w, h);
          if (!landmarks || landmarks.length === 0) return;

          // Tự điều chỉnh nét vẽ hài hòa cho cả 640x480 lẫn 1280x720
          const scale = Math.max(1, w / 640);

          // 1. Gộp toàn bộ đường xương vào đúng 1 lệnh stroke()
          ctx.lineWidth = 2.5 * scale;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#34d399';
          ctx.beginPath();

          for (let i = 0; i < POSE_CONNECTIONS.length; i++) {
            const pair = POSE_CONNECTIONS[i];
            const a = landmarks[pair[0]];
            const b = landmarks[pair[1]];
            if (!a || !b) continue;
            if (
              a.visibility < DRAW_MIN_VISIBILITY ||
              b.visibility < DRAW_MIN_VISIBILITY
            ) {
              continue;
            }
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
          }
          ctx.stroke();

          // 2. Gộp toàn bộ khớp rõ (visibility >= 0.6) vào 1 đường path màu xanh
          const dotRadius = 4 * scale;
          ctx.lineWidth = 1.5 * scale;
          ctx.strokeStyle = '#020617';
          ctx.fillStyle = '#10b981';
          ctx.beginPath();

          let hasAmber = false;
          for (let i = 0; i < landmarks.length; i++) {
            const pt = landmarks[i];
            if (pt.visibility < DRAW_MIN_VISIBILITY) continue;
            if (pt.visibility < RELIABLE_VISIBILITY) {
              hasAmber = true;
              continue;
            }
            const cx = pt.x * w;
            const cy = pt.y * h;
            ctx.moveTo(cx + dotRadius, cy);
            ctx.arc(cx, cy, dotRadius, 0, TWO_PI);
          }
          ctx.fill();
          ctx.stroke();

          // 3. Nếu có khớp mờ (0.5..0.6), gộp hết vào 1 đường path màu vàng
          if (hasAmber) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            for (let i = 0; i < landmarks.length; i++) {
              const pt = landmarks[i];
              if (
                pt.visibility < DRAW_MIN_VISIBILITY ||
                pt.visibility >= RELIABLE_VISIBILITY
              ) {
                continue;
              }
              const cx = pt.x * w;
              const cy = pt.y * h;
              ctx.moveTo(cx + dotRadius, cy);
              ctx.arc(cx, cy, dotRadius, 0, TWO_PI);
            }
            ctx.fill();
            ctx.stroke();
          }
        },
      }),
      []
    );

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        aria-hidden="true"
        // Kích thước CSS, object-contain và lật ngang khớp tuyệt đối với <video> trong CameraView
        className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${
          mirrored ? '-scale-x-100' : ''
        }`}
      />
    );
  }
);