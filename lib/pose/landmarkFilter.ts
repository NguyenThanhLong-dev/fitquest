import type { Landmark } from '@/lib/pose-engine';

/**
 * Cấu hình bộ lọc One Euro Filter cho 33 điểm khớp trước khi đưa vào pose-engine.
 * - enabled: bật/tắt làm mượt nhanh bằng hằng số.
 * - minCutoff (Hz): tần số cắt khi chuyển động chậm/đứng yên. Nhỏ hơn = cắt nhiễu mạnh hơn.
 * - beta: hệ số tăng băng thông khi di chuyển nhanh. Vừa phải để không trễ rep nhưng vẫn dịu đỉnh vận tốc giả.
 * - dCutoff (Hz): tần số cắt cho đạo hàm tốc độ.
 */
export const LANDMARK_FILTER_CONFIG = {
  enabled: true,
  minCutoff: 1.4,
  beta: 0.4,
  dCutoff: 1.0,
} as const;

const LANDMARK_COUNT = 33;
const CHANNELS_PER_LANDMARK = 3; // Chỉ làm mượt x, y, z; giữ nguyên visibility để qualityGate phản ứng tức thì
const TOTAL_CHANNELS = LANDMARK_COUNT * CHANNELS_PER_LANDMARK;
const TWO_PI = Math.PI * 2;
// Nếu khoảng cách giữa 2 khung hình vượt quá 500ms (chuyển tab/mất pose lâu), khởi tạo lại bộ lọc
const MAX_DT_SEC = 0.5;

function smoothingFactor(cutoffHz: number, dtSec: number): number {
  const r = TWO_PI * cutoffHz * dtSec;
  return r / (r + 1);
}

/**
 * One Euro Filter cho toàn bộ 33 landmarks, dùng Float64Array cố định
 * nên KHÔNG cấp phát thêm bất kỳ object nào mỗi frame.
 */
export class LandmarkOneEuroFilter {
  private readonly prevX = new Float64Array(TOTAL_CHANNELS);
  private readonly prevDx = new Float64Array(TOTAL_CHANNELS);
  private initialized = false;
  private lastTMs = 0;

  reset(): void {
    this.initialized = false;
    this.lastTMs = 0;
    this.prevX.fill(0);
    this.prevDx.fill(0);
  }

  /**
   * Làm mượt trực tiếp tọa độ x, y, z của mảng landmarks (đã là bản sao riêng của frame).
   * @param landmarks Mảng 33 điểm khớp của khung hình hiện tại.
   * @param timestampMs Mốc thời gian tính bằng mili-giây (ms).
   */
  applyInPlace(landmarks: Landmark[], timestampMs: number): void {
    if (!LANDMARK_FILTER_CONFIG.enabled) return;

    if (landmarks.length < LANDMARK_COUNT) {
      this.reset();
      return;
    }

    const dtSec = (timestampMs - this.lastTMs) / 1000;

    // Lần đầu hoặc bị gián đoạn lâu: nạp trực tiếp vị trí hiện tại để không tạo bước nhảy tốc độ
    if (!this.initialized || dtSec <= 0 || dtSec > MAX_DT_SEC) {
      for (let i = 0; i < LANDMARK_COUNT; i++) {
        const lm = landmarks[i];
        const base = i * CHANNELS_PER_LANDMARK;
        this.prevX[base] = lm.x;
        this.prevX[base + 1] = lm.y;
        this.prevX[base + 2] = lm.z;
        this.prevDx[base] = 0;
        this.prevDx[base + 1] = 0;
        this.prevDx[base + 2] = 0;
      }
      this.initialized = true;
      this.lastTMs = timestampMs;
      return;
    }

    const { minCutoff, beta, dCutoff } = LANDMARK_FILTER_CONFIG;
    const alphaD = smoothingFactor(dCutoff, dtSec);
    const invAlphaD = 1 - alphaD;

    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const lm = landmarks[i];
      const base = i * CHANNELS_PER_LANDMARK;

      lm.x = this.filterChannel(base, lm.x, dtSec, alphaD, invAlphaD, minCutoff, beta);
      lm.y = this.filterChannel(base + 1, lm.y, dtSec, alphaD, invAlphaD, minCutoff, beta);
      lm.z = this.filterChannel(base + 2, lm.z, dtSec, alphaD, invAlphaD, minCutoff, beta);
    }

    this.lastTMs = timestampMs;
  }

  private filterChannel(
    idx: number,
    raw: number,
    dtSec: number,
    alphaD: number,
    invAlphaD: number,
    minCutoff: number,
    beta: number
  ): number {
    const prevVal = this.prevX[idx];
    const rawDx = (raw - prevVal) / dtSec;
    const smoothDx = alphaD * rawDx + invAlphaD * this.prevDx[idx];
    this.prevDx[idx] = smoothDx;

    const cutoff = minCutoff + beta * Math.abs(smoothDx);
    const alpha = smoothingFactor(cutoff, dtSec);
    const filtered = alpha * raw + (1 - alpha) * prevVal;

    this.prevX[idx] = filtered;
    return filtered;
  }
}