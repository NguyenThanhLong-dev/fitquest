'use client';

/**
 * Bộ tổng hợp hiệu ứng âm thanh bằng Web Audio API (không tải file từ mạng hay đĩa).
 * - Chỉ khởi tạo và phát sau lần bấm/tương tác đầu tiên của người dùng (tuân thủ Autoplay Policy).
 * - Luôn tôn trọng trạng thái bật/tắt tiếng (`enabled`).
 */

export type SoundEffect =
  | 'hit'
  | 'crit'
  | 'defeat'
  | 'bossIntro'
  | 'bossFinisher'
  | 'levelUp'
  | 'comboMilestone'
  | 'challengeTick'
  | 'chestOpen';

let audioCtx: AudioContext | null = null;
let unlockedByUser = false;

/** Tạo hoặc đánh thức AudioContext sau lần bấm/tương tác đầu tiên của người dùng. */
export function unlockGameAudio(): void {
  if (typeof window === 'undefined') return;
  unlockedByUser = true;

  try {
    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtxCtor) return;

    if (!audioCtx) {
      audioCtx = new AudioCtxCtor();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
  } catch {
    // Bỏ qua an toàn nếu trình duyệt không hỗ trợ Web Audio
  }
}

/** Phát một nốt ngắn với đường bao âm lượng mượt để không bị tiếng "tách". */
function playTone(
  ctx: AudioContext,
  options: {
    freq: number;
    endFreq?: number;
    startOffset: number;
    duration: number;
    gain: number;
    type?: OscillatorType;
  }
): void {
  const now = ctx.currentTime + options.startOffset;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = options.type ?? 'triangle';
  osc.frequency.setValueAtTime(options.freq, now);
  if (options.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, options.endFreq),
      now + options.duration
    );
  }

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(options.gain, now + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);

  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + options.duration + 0.02);
}

/**
 * Phát hiệu ứng âm thanh tương ứng với sự kiện game.
 * Chỉ phát khi `enabled === true` VÀ người dùng đã từng bấm tương tác ít nhất 1 lần.
 */
export function playGameSound(effect: SoundEffect, enabled: boolean): void {
  if (!enabled || !unlockedByUser || typeof window === 'undefined') return;

  try {
    if (!audioCtx) {
      unlockGameAudio();
    }
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const ctx = audioCtx;
    switch (effect) {
      case 'hit':
        playTone(ctx, {
          freq: 360,
          endFreq: 210,
          startOffset: 0,
          duration: 0.09,
          gain: 0.14,
          type: 'triangle',
        });
        break;

      case 'crit':
        playTone(ctx, {
          freq: 520,
          endFreq: 780,
          startOffset: 0,
          duration: 0.1,
          gain: 0.16,
          type: 'sawtooth',
        });
        playTone(ctx, {
          freq: 880,
          endFreq: 1180,
          startOffset: 0.07,
          duration: 0.14,
          gain: 0.14,
          type: 'triangle',
        });
        break;

      case 'defeat':
        playTone(ctx, { freq: 392, startOffset: 0, duration: 0.1, gain: 0.14 });
        playTone(ctx, { freq: 523.25, startOffset: 0.09, duration: 0.12, gain: 0.14 });
        playTone(ctx, { freq: 659.25, startOffset: 0.18, duration: 0.22, gain: 0.16 });
        break;

      case 'bossIntro':
        playTone(ctx, {
          freq: 140,
          endFreq: 95,
          startOffset: 0,
          duration: 0.35,
          gain: 0.18,
          type: 'sawtooth',
        });
        playTone(ctx, {
          freq: 196,
          endFreq: 130,
          startOffset: 0.25,
          duration: 0.4,
          gain: 0.16,
          type: 'sawtooth',
        });
        break;

      case 'bossFinisher':
        playTone(ctx, {
          freq: 300,
          endFreq: 90,
          startOffset: 0,
          duration: 0.22,
          gain: 0.18,
          type: 'sawtooth',
        });
        playTone(ctx, { freq: 523.25, startOffset: 0.16, duration: 0.12, gain: 0.16 });
        playTone(ctx, { freq: 783.99, startOffset: 0.28, duration: 0.14, gain: 0.16 });
        playTone(ctx, { freq: 1046.5, startOffset: 0.4, duration: 0.3, gain: 0.18 });
        break;

      case 'levelUp':
        playTone(ctx, { freq: 523.25, startOffset: 0, duration: 0.11, gain: 0.14 });
        playTone(ctx, { freq: 659.25, startOffset: 0.1, duration: 0.11, gain: 0.14 });
        playTone(ctx, { freq: 783.99, startOffset: 0.2, duration: 0.12, gain: 0.15 });
        playTone(ctx, { freq: 1046.5, startOffset: 0.31, duration: 0.28, gain: 0.17 });
        break;

      case 'comboMilestone':
        playTone(ctx, { freq: 587.33, startOffset: 0, duration: 0.09, gain: 0.12 });
        playTone(ctx, { freq: 880, startOffset: 0.08, duration: 0.15, gain: 0.14 });
        break;

      case 'challengeTick':
        playTone(ctx, {
          freq: 740,
          startOffset: 0,
          duration: 0.06,
          gain: 0.1,
          type: 'sine',
        });
        break;

      case 'chestOpen':
        playTone(ctx, { freq: 440, startOffset: 0, duration: 0.1, gain: 0.14 });
        playTone(ctx, { freq: 659.25, startOffset: 0.09, duration: 0.12, gain: 0.15 });
        playTone(ctx, { freq: 880, startOffset: 0.19, duration: 0.24, gain: 0.16 });
        break;
    }
  } catch {
    // Bỏ qua lỗi âm thanh để không bao giờ ảnh hưởng vòng lặp game
  }
}