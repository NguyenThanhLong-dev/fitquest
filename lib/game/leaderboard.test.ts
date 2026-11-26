import { describe, expect, it } from 'vitest';
import { getRankOf, getWeeklyScore } from '@/lib/game/engineAdapter';
import {
  LEADERBOARD_CONFIG,
  advanceDemoDayState,
  applyDebugVerifiedXpToWeek,
  applyRunVerdictToWeek,
  buildLeaderboardSnapshot,
  computePlayerWeeklyScore,
  createInitialWeeklyState,
  resetWeekState,
  simulateWeekendClaim,
} from '@/lib/game/leaderboard';

describe('F7 — Bảng xếp hạng minh họa & Thưởng tuần', () => {
  it('Cùng seed ra cùng một bảng 20 người chơi giả và sắp xếp đúng thứ tự giảm dần theo điểm', () => {
    const snapA = buildLeaderboardSnapshot({
      seed: LEADERBOARD_CONFIG.defaultSeed,
      playerName: 'Long_dev',
      verifiedXp: 450,
      activeDays: new Set([1, 2]),
    });
    const snapB = buildLeaderboardSnapshot({
      seed: LEADERBOARD_CONFIG.defaultSeed,
      playerName: 'Long_dev',
      verifiedXp: 450,
      activeDays: new Set([1, 2]),
    });

    expect(snapA.rows).toEqual(snapB.rows);
    expect(snapA.rows).toHaveLength(21); // 20 người giả + 1 người chơi thật
    expect(snapA.totalParticipants).toBe(21);

    // Kiểm tra thứ tự giảm dần nghiêm ngặt theo điểm
    for (let i = 1; i < snapA.rows.length; i++) {
      expect(snapA.rows[i - 1].score).toBeGreaterThanOrEqual(snapA.rows[i].score);
    }

    // Kiểm tra hạng người chơi khớp 100% hàm rankOf của pose-engine.ts
    const demoScores = snapA.rows.filter((r) => r.isDemo).map((r) => r.score);
    expect(snapA.playerRank).toBe(getRankOf(snapA.playerScore, demoScores));
  });

  it('Phiên review và rejected KHÔNG cộng điểm tuần và KHÔNG đánh dấu ngày hoạt động', () => {
    let week = createInitialWeeklyState();

    week = applyRunVerdictToWeek(week, 'review', 120, 10);
    expect(week.verifiedXp).toBe(0);
    expect(week.activeDays.size).toBe(0);
    expect(computePlayerWeeklyScore(week.verifiedXp, week.activeDays)).toBe(0);

    week = applyRunVerdictToWeek(week, 'rejected', 200, 15);
    expect(week.verifiedXp).toBe(0);
    expect(week.activeDays.size).toBe(0);

    // Chưa có điểm -> không hiện người chơi ở cuối bảng xếp hạng
    const unrankedSnap = buildLeaderboardSnapshot({
      seed: LEADERBOARD_CONFIG.defaultSeed,
      playerName: 'Long_dev',
      verifiedXp: week.verifiedXp,
      activeDays: week.activeDays,
    });
    expect(unrankedSnap.hasScored).toBe(false);
    expect(unrankedSnap.playerRank).toBeNull();
    expect(unrankedSnap.rows).toHaveLength(20);
    expect(unrankedSnap.rows.some((r) => r.isPlayer)).toBe(false);

    // Phiên verified mới được cộng điểm tuần và đánh dấu ngày hiện tại
    week = applyRunVerdictToWeek(week, 'verified', 120, 8);
    expect(week.verifiedXp).toBe(120);
    expect(week.activeDays.has(1)).toBe(true);
    expect(computePlayerWeeklyScore(week.verifiedXp, week.activeDays)).toBe(
      getWeeklyScore(120, 1)
    );
  });

  it('Số ngày hoạt động tối đa được tính là 5 giống đúng hàm weeklyScore của engine', () => {
    let week = createInitialWeeklyState();

    // Mô phỏng 7 ngày liên tiếp đều có phiên verified
    for (let day = 1; day <= 7; day++) {
      week = applyRunVerdictToWeek(week, 'verified', 50, 5);
      if (day < 7) {
        week = advanceDemoDayState(week);
      }
    }

    expect(week.activeDays.size).toBe(7);
    expect(week.verifiedXp).toBe(350);

    const score7Days = computePlayerWeeklyScore(week.verifiedXp, week.activeDays);
    const score5Days = getWeeklyScore(350, 5);
    expect(score7Days).toBe(score5Days); // 350 + 50 * 5 = 600 (không vượt quá 5 ngày)

    const snap = buildLeaderboardSnapshot({
      seed: LEADERBOARD_CONFIG.defaultSeed,
      playerName: 'Long_dev',
      verifiedXp: week.verifiedXp,
      activeDays: week.activeDays,
    });
    expect(snap.effectiveActiveDays).toBe(5);
    expect(snap.totalRecordedDays).toBe(7);
  });

  it('Tính chính xác khoảng cách tới người đứng ngay trên (và null khi đã dẫn đầu #1)', () => {
    const snapMid = buildLeaderboardSnapshot({
      seed: LEADERBOARD_CONFIG.defaultSeed,
      playerName: 'Long_dev',
      verifiedXp: 350,
      activeDays: new Set([1]), // 400 điểm
    });

    expect(snapMid.nextAbove).not.toBeNull();
    if (snapMid.nextAbove) {
      expect(snapMid.nextAbove.score).toBeGreaterThan(snapMid.playerScore);
      expect(snapMid.nextAbove.pointsNeeded).toBe(
        snapMid.nextAbove.score - snapMid.playerScore
      );

      // Không có người chơi giả nào có điểm nằm giữa playerScore và nextAbove.score
      const demoScores = snapMid.rows
        .filter((r) => r.isDemo)
        .map((r) => r.score);
      const strictlyBetween = demoScores.filter(
        (s) => s > snapMid.playerScore && s < snapMid.nextAbove!.score
      );
      expect(strictlyBetween).toHaveLength(0);
    }

    // Khi điểm vượt tất cả 20 người chơi giả -> hạng #1, nextAbove là null
    const snapTop = buildLeaderboardSnapshot({
      seed: LEADERBOARD_CONFIG.defaultSeed,
      playerName: 'Long_dev',
      verifiedXp: 5000,
      activeDays: new Set([1, 2, 3, 4, 5]),
    });
    expect(snapTop.playerRank).toBe(1);
    expect(snapTop.nextAbove).toBeNull();
  });

  it('Thưởng cuối tuần không phát khi 0 điểm, chỉ nhận được 1 lần mỗi tuần cho đến khi Đặt lại tuần', () => {
    const emptyWeek = createInitialWeeklyState();
    const noScoreRes = simulateWeekendClaim(
      emptyWeek,
      LEADERBOARD_CONFIG.defaultSeed
    );
    expect(noScoreRes.status).toBe('no_score');
    expect(noScoreRes.reward).toBeNull();

    // Cộng nhanh 300 XP verified -> đủ điều kiện nhận thưởng lần 1
    const activeWeek = applyDebugVerifiedXpToWeek(emptyWeek, 300);
    const firstClaim = simulateWeekendClaim(
      activeWeek,
      LEADERBOARD_CONFIG.defaultSeed
    );
    expect(firstClaim.status).toBe('claimed');
    expect(firstClaim.reward).not.toBeNull();
    expect(firstClaim.nextWeek.rewardClaimed).toBe(true);

    // Bấm nhận lần 2 trong cùng tuần -> bị khóa
    const secondClaim = simulateWeekendClaim(
      firstClaim.nextWeek,
      LEADERBOARD_CONFIG.defaultSeed
    );
    expect(secondClaim.status).toBe('already_claimed');
    expect(secondClaim.reward).toBeNull();

    // Sau khi Đặt lại tuần -> mở khóa nhận thưởng lại và xóa điểm tuần
    const resetWeek = resetWeekState();
    expect(resetWeek.rewardClaimed).toBe(false);
    expect(resetWeek.verifiedXp).toBe(0);
    expect(resetWeek.currentDemoDay).toBe(1);
    expect(resetWeek.activeDays.size).toBe(0);
  });
});