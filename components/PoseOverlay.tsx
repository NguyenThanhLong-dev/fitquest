'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Landmark } from '@/lib/pose-engine';

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
const DRAW_MIN_VISIBILITY = 0.5;
const RELIABLE_VISIBILITY = 0.6;

export interface PoseOverlayHandle {
  draw: (landmarks: readonly Landmark[] | null) => void;
  clear: () => void;
}

export interface PoseOverlayProps {
  width: number;
  height: number;
  mirrored?: boolean;
}

/**
 * Canvas trong suốt phủ đúng kích thước video, vẽ khung xương trực tiếp qua ref
 * để không gây re-render React mỗi frame.
 */
export const PoseOverlay = forwardRef<PoseOverlayHandle, PoseOverlayProps>(
  function PoseOverlay({ width, height, mirrored = true }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

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

          const scale = Math.max(1, w / 640);

          // 1. Vẽ toàn bộ đường nối xương trong 1 lượt stroke()
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

          // 2. Vẽ khớp rõ (visibility >= 0.6) màu xanh
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

          // 3. Vẽ khớp hơi mờ (0.5..0.6) màu vàng
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
        className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${
          mirrored ? '-scale-x-100' : ''
        }`}
      />
    );
  }
);