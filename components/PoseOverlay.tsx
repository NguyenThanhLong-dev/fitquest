'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { LM, type Landmark } from '@/lib/pose-engine';

/**
 * Chỉ hiển thị đúng 15 điểm khớp gọn gàng:
 * - Mặt: mũi + 2 tai (ẩn mắt, miệng và các điểm mặt khác)
 * - Tay: vai, khuỷu, cổ tay (ẩn toàn bộ ngón tay)
 * - Chân: hông, gối, cổ chân (ẩn gót chân và mũi bàn chân)
 */
const VISIBLE_LANDMARK_INDICES: readonly number[] = [
  LM.NOSE,
  LM.L_EAR,
  LM.R_EAR,
  LM.L_SHOULDER,
  LM.R_SHOULDER,
  LM.L_ELBOW,
  LM.R_ELBOW,
  LM.L_WRIST,
  LM.R_WRIST,
  LM.L_HIP,
  LM.R_HIP,
  LM.L_KNEE,
  LM.R_KNEE,
  LM.L_ANKLE,
  LM.R_ANKLE,
];

// Đường nối 2 tai riêng biệt để dễ quan sát độ nghiêng đầu (bài nghiêng cổ)
const EAR_TILT_CONNECTION: readonly [number, number] = [LM.L_EAR, LM.R_EAR];

// Đường nối thân, tay (tới cổ tay) và chân (tới cổ chân)
const BODY_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Thân trên
  [LM.L_SHOULDER, LM.R_SHOULDER],
  [LM.L_SHOULDER, LM.L_HIP],
  [LM.R_SHOULDER, LM.R_HIP],
  [LM.L_HIP, LM.R_HIP],
  // Tay trái (vai -> khuỷu -> cổ tay)
  [LM.L_SHOULDER, LM.L_ELBOW],
  [LM.L_ELBOW, LM.L_WRIST],
  // Tay phải (vai -> khuỷu -> cổ tay)
  [LM.R_SHOULDER, LM.R_ELBOW],
  [LM.R_ELBOW, LM.R_WRIST],
  // Chân trái (hông -> gối -> cổ chân)
  [LM.L_HIP, LM.L_KNEE],
  [LM.L_KNEE, LM.L_ANKLE],
  // Chân phải (hông -> gối -> cổ chân)
  [LM.R_HIP, LM.R_KNEE],
  [LM.R_KNEE, LM.R_ANKLE],
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
 * Canvas trong suốt phủ đúng kích thước video, vẽ khung xương rút gọn trực tiếp qua ref
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

          // 1. Vẽ toàn bộ đường xương thân/tay/chân trong 1 lượt stroke()
          ctx.lineWidth = 2.5 * scale;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#34d399';
          ctx.beginPath();

          for (let i = 0; i < BODY_CONNECTIONS.length; i++) {
            const pair = BODY_CONNECTIONS[i];
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

          // 2. Vẽ đường nối hai tai bằng màu xanh dương nổi bật để thấy rõ độ nghiêng đầu
          const leftEar = landmarks[EAR_TILT_CONNECTION[0]];
          const rightEar = landmarks[EAR_TILT_CONNECTION[1]];
          if (
            leftEar &&
            rightEar &&
            leftEar.visibility >= DRAW_MIN_VISIBILITY &&
            rightEar.visibility >= DRAW_MIN_VISIBILITY
          ) {
            ctx.lineWidth = 2.5 * scale;
            ctx.strokeStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(leftEar.x * w, leftEar.y * h);
            ctx.lineTo(rightEar.x * w, rightEar.y * h);
            ctx.stroke();
          }

          // 3. Vẽ các khớp rõ (visibility >= 0.6) trong 15 điểm được phép hiển thị
          const dotRadius = 4 * scale;
          ctx.lineWidth = 1.5 * scale;
          ctx.strokeStyle = '#020617';
          ctx.fillStyle = '#10b981';
          ctx.beginPath();

          let hasAmber = false;
          for (let i = 0; i < VISIBLE_LANDMARK_INDICES.length; i++) {
            const pt = landmarks[VISIBLE_LANDMARK_INDICES[i]];
            if (!pt || pt.visibility < DRAW_MIN_VISIBILITY) continue;
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

          // 4. Vẽ các khớp hơi mờ (0.5..0.6) màu vàng
          if (hasAmber) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            for (let i = 0; i < VISIBLE_LANDMARK_INDICES.length; i++) {
              const pt = landmarks[VISIBLE_LANDMARK_INDICES[i]];
              if (
                !pt ||
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