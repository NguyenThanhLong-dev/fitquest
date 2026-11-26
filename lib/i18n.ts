import type { ChallengeId, ExerciseId, GateReason, Verdict } from '@/lib/pose-engine';

/**
 * Toàn bộ chuỗi giao diện tiếng Việt cho FitQuest (F1 + F2 + F3 + F4 + F5a).
 * Giữ nguyên toàn bộ khóa cũ để chế độ luyện tập và các component F1–F4 không bị ảnh hưởng.
 */
export const i18n = {
  // ── F1: Metadata toàn cục ──
  app: {
    title: 'FitQuest',
    metaDescription:
      'RPG vận động 5–10 phút tại bàn học cho sinh viên IT, kiểm chứng động tác bằng camera ngay trên máy.',
  },

  // ── F1 + F5a: Trang chủ (app/page.tsx) ──
  home: {
    title: 'FitQuest',
    description:
      'Game RPG giúp sinh viên IT tập các bài vận động ngắn 5–10 phút ngay tại bàn học với camera kiểm chứng trực tiếp trên máy bạn.',
    nameLabel: 'Tên hiển thị (không bắt buộc)',
    namePlaceholder: 'Nhập tên của bạn...',
    startButton: 'Vào Hầm Ngục (Dungeon Run)',
    practiceButton: 'Chế độ luyện tập tự do',
    privacyNote: 'Video không bao giờ rời khỏi máy bạn.',
    reloadLossNotice: 'Tải lại trang sẽ mất tiến độ',
    levelPrefix: 'Cấp',
    xpUnit: 'XP',
  },

  // ── F1 + F2 + F3 + F4: Trang chơi, camera, AI, luyện tập & thử thách sống ──
  play: {
    // Khóa giữ nguyên từ F1
    placeholder: 'Camera sắp có',
    backHome: 'Quay lại trang chủ',
    playerPrefix: 'Người chơi:',
    defaultPlayer: 'Ẩn danh',
    xpPrefix: 'XP:',

    // Khóa dùng chung trên /play (F2)
    title: 'FitQuest',
    privacyNotice:
      'Video xử lý hoàn toàn trên máy bạn — không bao giờ gửi qua mạng.',
    retryButton: 'Thử lại',
    errorDetailPrefix: 'Chi tiết lỗi gốc:',

    // Chuyển chế độ trên /play (F5a giữ nguyên chế độ luyện tập F4)
    modeTabs: {
      dungeon: 'Dungeon Run',
      practice: 'Chế độ luyện tập',
    },

    // Thông báo lỗi camera (components/CameraView.tsx)
    camera: {
      starting: 'Đang mở camera...',
      unsupported:
        'Trình duyệt không hỗ trợ camera hoặc trang chưa chạy trên localhost / HTTPS.',
      permissionDenied:
        'Bạn đã chặn quyền truy cập camera. Hãy bấm biểu tượng ổ khóa hoặc camera trên thanh địa chỉ trình duyệt để cho phép, rồi bấm "Thử lại".',
      notFound:
        'Không tìm thấy camera trên thiết bị. Hãy kiểm tra lại kết nối webcam rồi bấm "Thử lại".',
      inUse:
        'Camera đang được ứng dụng khác sử dụng (ví dụ: Zoom, Google Meet, MS Teams). Hãy tắt ứng dụng đó rồi bấm "Thử lại".',
      genericError:
        'Không thể khởi động camera. Hãy kiểm tra thiết bị và quyền truy cập rồi thử lại.',
    },

    // Thông báo tải và khởi tạo mô hình AI (lib/pose/usePoseLandmarker.ts)
    model: {
      loading: 'Đang tải mô hình AI nhận diện tư thế từ máy (MediaPipe Lite)...',
      ready: 'AI sẵn sàng',
      loadError:
        'Không thể tải mô hình AI. Hãy kiểm tra các file trong thư mục public/wasm và public/models rồi thử lại.',
      assetLoadError:
        'Không tải được file WASM hoặc file mô hình AI. Hãy kiểm tra xem các file đã có đúng trong thư mục public/wasm và public/models hay chưa, sau đó bấm "Thử lại".',
      initFailedError:
        'Không thể khởi tạo mô hình AI trên cả GPU lẫn CPU. Hãy kiểm tra trình duyệt có hỗ trợ WebAssembly/WebGL không rồi thử lại.',
    },

    // Nhãn HUD góc camera (F2)
    hud: {
      poseDetected: 'Đang theo dõi khung xương',
      noPose: 'Chưa thấy người trong khung hình',
      fpsUnit: 'FPS',
    },

    // ── F3 + F4: Chế độ luyện tập 5 động tác ──
    practice: {
      modeBadge: 'Chế độ luyện tập',
      chooseExerciseLabel: 'Chọn động tác luyện tập',
      resetButton: 'Đặt lại bộ đếm',
      repCountLabel: 'Số rep đã tính',
      progressLabel: 'Tiến độ rep',
      holdProgressLabel: 'Thời gian giữ',
      reachPoseBarLabel: 'Độ vào tư thế giữ',
      qualityLabel: 'Chất lượng rep vừa xong (0–1)',
      qualityEmpty: 'Chưa có rep nào',
      repCountedBadge: 'Đã tính',
      repRejectedBadge: 'Không tính',
      formHintLabel: 'Gợi ý form theo thời gian thực',
      bodyScopeFull: 'Cần thấy thân & chân',
      bodyScopeSquat: 'Chỉ cần thấy vai, hông và gối (không cần cổ chân)',
      bodyScopeUpper: 'Chỉ cần thấy thân trên',
      holdUnit: 's',

      status: {
        waitingCamera: 'Đang chờ camera và AI sẵn sàng...',
        holding: 'Giữ nguyên tư thế...',
        holdComplete: 'Đã tính rep! Thả lỏng về tư thế nghỉ để tập rep tiếp theo',
        awaitingRest: 'Đã xong rep — hãy thả lỏng về tư thế nghỉ trước khi tập tiếp',
        startFromRest: 'Hãy về tư thế nghỉ trước khi bắt đầu giữ',
        repCancelledTitle: 'Rep đang tập đã bị hủy',
        poseLostTitle: 'Tạm dừng đếm (khung hình chưa đạt)',
        challengePaused: 'Đang tạm dừng đếm rep để thực hiện thử thách sống...',
        runEnded: 'Lượt tập thử đã kết thúc. Bấm "Bắt đầu lượt tập thử" để tập lượt mới.',
        countedGood: 'Rep chuẩn! Tiếp tục giữ nhịp',
        countedWithNotePrefix: 'Đã tính rep — lưu ý:',
        rejectedPrefix: 'Chưa tính rep:',
        unknownIssue: 'Động tác chưa đạt yêu cầu, hãy thử lại',
      },

      gateReasons: {
        NO_POSE: 'Không thấy người trong khung hình. Hãy đứng hoặc ngồi vào trước camera.',
        LOW_VISIBILITY:
          'Thiếu khớp bắt buộc hoặc ánh sáng yếu. Hãy bật thêm đèn và để lộ rõ đủ khớp cần thiết.',
        OUT_OF_FRAME:
          'Khớp bắt buộc đang sát mép hoặc ra ngoài khung hình. Hãy căn lại vị trí ở giữa camera.',
        TOO_FAR: 'Bạn đang đứng quá xa camera (thân quá nhỏ). Hãy tiến lại gần hơn.',
      } satisfies Record<GateReason, string>,

      exercises: {
        squat: {
          name: 'Squat',
          meta: 'Vai–hông–gối · Động tác động',
          scope: 'squat',
          readyCue: 'Tư thế tốt — bắt đầu hạ hông squat rồi đứng thẳng lên',
          depthCue: 'Hạ thấp hông thêm',
          peakCue: 'Đạt độ sâu! Đứng thẳng về tư thế nghỉ',
          notDeepEnough: 'Hạ thấp hông thêm',
        },
        overhead_reach: {
          name: 'Vươn vai',
          meta: 'Thân trên · Giữ 2s',
          scope: 'upper',
          readyCue: 'Tư thế tốt — vươn hai tay cao quá đầu và giữ liên tục 2 giây',
          depthCue: 'Đưa cả hai tay cao hơn quá đầu',
          peakCue: 'Giữ nguyên hai tay trên đầu...',
          notDeepEnough: 'Đưa hai tay cao quá đầu thêm',
        },
        side_bend: {
          name: 'Nghiêng người',
          meta: 'Thân trên · Giữ 1,5s',
          scope: 'upper',
          readyCue: 'Tư thế tốt — nghiêng người nhẹ sang một bên và giữ liên tục 1,5 giây',
          depthCue: 'Nghiêng người thêm một chút',
          peakCue: 'Giữ nguyên tư thế nghiêng...',
          notDeepEnough: 'Nghiêng người thêm một chút',
        },
        neck_tilt: {
          name: 'Nghiêng cổ',
          meta: 'Thân trên · Giữ 2s',
          scope: 'upper',
          readyCue: 'Tư thế tốt — nghiêng nhẹ đầu sang bên và giữ liên tục 2 giây',
          depthCue: 'Nghiêng cổ thêm một chút',
          peakCue: 'Giữ nguyên cổ nghiêng...',
          notDeepEnough: 'Nghiêng cổ thêm một chút',
        },
        high_knees: {
          name: 'Nâng gối',
          meta: 'Toàn thân · Động tác động',
          scope: 'full',
          readyCue: 'Tư thế tốt — nâng luân phiên đầu gối lên cao',
          depthCue: 'Nâng đầu gối cao hơn ngang hông',
          peakCue: 'Đạt độ cao! Hạ chân về tư thế nghỉ',
          notDeepEnough: 'Nâng đầu gối cao hơn',
        },
      } satisfies Record<
        ExerciseId,
        {
          name: string;
          meta: string;
          scope: 'full' | 'squat' | 'upper';
          readyCue: string;
          depthCue: string;
          peakCue: string;
          notDeepEnough: string;
        }
      >,

      formChecks: {
        TORSO_UPRIGHT: 'Giữ lưng thẳng hơn',
        HIPS_LEVEL: 'Giữ hông tương đối cân bằng',
        BOTH_WRISTS_UP: 'Đưa cả hai tay cao quá đầu',
        SHOULDERS_LEVEL: 'Giữ vai tương đối ngang',
      } as Record<string, string>,

      repFlags: {
        TOO_FAST: 'Chậm lại, kiểm soát động tác tốt hơn',
        TOO_SLOW: 'Thực hiện dứt khoát hơn (quá lâu)',
        HOLD_TOO_SHORT: 'Giữ liên tục đủ thời gian yêu cầu',
        JITTER: 'Di chuyển mượt và ổn định hơn',
        TELEPORT: 'Chuyển động quá đột ngột, hãy tập chậm lại',
        FORM_TORSO_UPRIGHT: 'Giữ lưng thẳng hơn',
        FORM_HIPS_LEVEL: 'Giữ hông tương đối cân bằng',
        FORM_BOTH_WRISTS_UP: 'Đưa cả hai tay cao quá đầu',
        FORM_SHOULDERS_LEVEL: 'Giữ vai tương đối ngang',
      } as Record<string, string>,

      frameCheck: {
        title: 'Kiểm tra khung hình',
        readyBadge: 'Sẵn sàng',
        notReadyBadge: 'Chưa đạt',
        stabilizingBadge: 'Đang ổn định...',
        readyMessage: 'Khung hình đạt chuẩn — có thể bắt đầu đếm rep.',
        reasons: {
          NO_POSE: 'Không thấy người trong khung hình. Hãy ngồi hoặc đứng vào trước camera.',
          LOW_VISIBILITY:
            'Thiếu khớp bắt buộc (độ tin cậy < 0,6). Hãy bật thêm đèn và để lộ rõ các khớp cần kiểm tra.',
          OUT_OF_FRAME:
            'Khớp bắt buộc đang sát mép hoặc ra ngoài khung hình. Hãy căn lại vị trí ở giữa khung.',
          TOO_FAR:
            'Bạn đang đứng quá xa camera (thân quá nhỏ trong khung). Hãy tiến lại gần hơn.',
          TOO_CLOSE:
            'Bạn đang đứng quá gần camera. Hãy lùi ra xa một chút để thấy rõ cơ thể.',
        },
      },

      liveness: {
        runTitle: 'Lượt tập thử (Run)',
        runActiveBadge: 'Đang trong lượt',
        runEndedBadge: 'Đã kết thúc lượt',
        startNewRunButton: 'Bắt đầu lượt tập thử',
        restartRunButton: 'Lượt tập thử mới',
        endRunButton: 'Kết thúc lượt',
        statsLabel: 'Thử thách sống (tạm lưu RAM)',
        passedLabel: 'Đạt',
        failedLabel: 'Thất bại',
        scheduledLabel: 'Theo lịch lượt này',
        runRepsLabel: 'Rep hợp lệ trong lượt',
        modalBadge: 'Thử thách sống · Đang tạm dừng đếm rep',
        prompts: {
          RAISE_LEFT_HAND: 'Giơ tay trái lên',
          RAISE_RIGHT_HAND: 'Giơ tay phải lên',
        } satisfies Record<ChallengeId, string>,
        holdInstruction: 'Giơ 1 tay cao hơn vai và giữ liên tục 0,5 giây (hạ tay còn lại).',
        countdownLabel: 'Còn lại',
        holdBarLabel: 'Giữ tư thế',
        outcomePassed: 'Vượt qua thử thách sống! Tiếp tục lượt tập.',
        outcomeFailed: 'Hết giờ thử thách — đã ghi nhận 1 lần thất bại (lượt tập vẫn tiếp tục).',
        scheduleItemStatuses: {
          pending: 'Chờ',
          active: 'Đang chạy',
          passed: 'Đạt',
          failed: 'Thất bại',
        },
      },

      debug: {
        toggleShowButton: 'Hiện Debug',
        toggleHideButton: 'Ẩn Debug',
        title: 'Debug F4 (Khung hình, Lịch thử thách & Góc)',
        f4SectionTitle: 'Lớp 0 & Lớp 3b (F4)',
        seedLabel: 'Seed lượt tập',
        seedFixedTag: 'Cố định',
        seedRandomTag: 'Ngẫu nhiên',
        scheduleLabel: 'Lịch thử thách (0–2)',
        scheduleEmpty: 'Lượt này có 0 thử thách theo seed.',
        scheduleTriggerPrefix: 'Sau',
        scheduleRepsUnit: 'rep',
        frameStatusLabel: 'Khung hình (sau chống nhấp nháy)',
        frameRawLabel: 'Khung hình thô (tức thời)',
        frameReasonLabel: 'Lý do chưa đạt',
        frameReasonNone: 'Không có (đạt)',
        frameSizeLabel: 'Vai / Thân (tỷ lệ khung)',
        mirrorMappingLabel: 'Ánh xạ trái/phải gương',
        mirrorCssOnly: 'CSS gương (L→L, R→R)',
        mirrorSwapped: 'Đảo giải phẫu (L→R, R→L)',
        f3SectionTitle: 'Góc, Giữ & Tốc độ (F3)',
        metricAngleLabel: 'Góc hiện tại / Ngưỡng',
        metricRatioLabel: 'Chỉ số hiện tại / Ngưỡng',
        holdTimeLabel: 'Thời gian đã giữ',
        holdNotApplicable: 'Không áp dụng',
        secondaryLabels: {
          shoulderTilt: 'Độ nghiêng vai / Dung sai',
          hipTilt: 'Độ nghiêng hông / Dung sai',
          torsoLean: 'Độ gập thân / Dung sai',
        },
        stateLabel: 'Trạng thái đếm',
        stateReady: 'Sẵn sàng',
        stateActive: 'Đang vào/giữ rep',
        stateAwaitingRest: 'Chờ thả lỏng về nghỉ',
        currentVelocityLabel: 'Tốc độ hiện tại',
        livePeakLabel: 'Đỉnh rep hiện tại',
        lastRepPeakLabel: 'Đỉnh rep vừa xong',
        thresholdLabel: 'Ngưỡng TELEPORT',
        velocityUnit: 'p/s',
        filterLabel: 'One Euro',
        filterOn: 'Bật',
        filterOff: 'Tắt',
        lastRejectionLabel: 'Lý do từ chối gần nhất',
        noRejection: 'Chưa có rep nào bị từ chối',
        flagsPrefix: 'Cờ:',
      },
    },
  },

  // ── F5a: Dungeon Run (Đánh quái bằng cơ thể) ──
  dungeon: {
    modeBadge: 'Hầm Ngục · Dungeon Run',
    stagePrefix: 'Phòng',
    bossTag: 'BOSS CUỐI',
    normalTag: 'QUÁI THƯỜNG',
    hpLabel: 'HP',
    chargeBarLabel: 'Nạp lực tung đòn',
    repProgressLabel: 'Nhịp tung đòn',
    comboLabel: 'COMBO',
    comboDamageHint: 'Tăng sát thương (không tăng XP)',
    critBanner: 'CHÍ MẠNG!',
    damageUnit: 'ST',
    xpFloatingPrefix: '+',
    xpUnit: 'XP',
    defeatedBanner: 'ĐÃ HẠ GỤC! Chuẩn bị đón quái kế tiếp...',
    pausedOverlayTitle: 'Đang tạm dừng',
    pausedOverlayDesc: 'Nhấn "Tiếp tục" để quay lại chiến đấu.',

    controls: {
      pause: 'Tạm dừng',
      resume: 'Tiếp tục',
      swapMonster: 'Đổi quái',
      swapUsed: 'Đã dùng Đổi quái',
      finishRun: 'Kết thúc lượt',
      newRun: 'Lượt mới',
    },

    xpBar: {
      levelPrefix: 'Cấp',
      nextLevelPrefix: 'Còn',
      capPrefix: 'Giới hạn phiên:',
      capReachedNotice: 'Hôm nay bạn đã tập đủ, nghỉ ngơi nhé',
      tentativeLabel: 'XP tạm trong lượt:',
    },

    monsters: {
      squat: {
        name: 'Golem Đá',
        bossName: 'Đại Golem Hắc Thạch',
        actionLabel: 'Squat để đập giáp đá',
      },
      overhead_reach: {
        name: 'Rồng Ngái Ngủ',
        bossName: 'Hỏa Long Thức Giấc',
        actionLabel: 'Vươn vai giữ 2s để nạp chưởng',
      },
      side_bend: {
        name: 'Rắn Lắc',
        bossName: 'Mãnh Xà Bóng Đêm',
        actionLabel: 'Nghiêng người giữ 1,5s để né độc',
      },
      neck_tilt: {
        name: 'Bóng Ma Cứng Cổ',
        bossName: 'Ác Linh Khóa Cổ',
        actionLabel: 'Nghiêng cổ giữ 2s để phá nguyền',
      },
      high_knees: {
        name: 'Nhện Nhảy',
        bossName: 'Chúa Nhện Hầm Ngục',
        actionLabel: 'Nâng gối liên hoàn để chặn tơ',
      },
    } satisfies Record<
      ExerciseId,
      { name: string; bossName: string; actionLabel: string }
    >,

    sideObjectives: {
      title: 'Mục tiêu phụ lượt này',
      subtitle: 'Thành tích hiển thị (không cộng thêm XP)',
      items: {
        crit_3: 'Đạt 3 đòn chí mạng (chất lượng ≥ 0,9)',
        combo_8: 'Đạt chuỗi Combo x8',
        boss_no_swap: 'Hạ Boss không dùng Đổi quái',
        high_quality_5: 'Đạt 5 rep chất lượng ≥ 0,85',
        boss_crit: 'Tung ít nhất 1 đòn chí mạng vào Boss',
      },
    },

    skills: {
      title: 'Kỹ năng theo cấp độ',
      realBadge: 'Hoạt động thật',
      comingSoonBadge: 'Sắp có',
      unlockedTag: 'Đã mở',
      lockedPrefix: 'Mở ở Cấp',
      items: {
        free_swap: {
          name: 'Đổi quái miễn phí',
          desc: 'Đổi 1 quái sang động tác khác miễn phí mỗi lượt.',
        },
        second_wind: {
          name: 'Hơi thở thứ hai',
          desc: 'Thêm 1 lần đổi quái miễn phí mỗi phiên chơi.',
        },
        focus: {
          name: 'Tập trung cao độ',
          desc: '+10% XP cho nhiệm vụ đầu tiên của lượt.',
        },
        dungeon_skin: {
          name: 'Giáp Hầm Ngục',
          desc: 'Mở khóa huy hiệu và giao diện nhân vật đặc biệt.',
        },
        raid_boss: {
          name: 'Đại Boss Hầm Ngục',
          desc: 'Mở khóa nhiệm vụ Boss đặc biệt với mức XP cao hơn.',
        },
      },
    },

    stats: {
      title: 'Chỉ số nhân vật (RAM)',
      str: 'STR (Sức mạnh)',
      agi: 'AGI (Nhanh nhẹn)',
      vit: 'VIT (Thể lực)',
      wis: 'WIS (Trí tuệ)',
    },

    verdicts: {
      verified: {
        label: 'ĐÃ XÁC THỰC (Verified)',
        desc: 'Lượt tập hợp lệ. XP chính thức và chỉ số đã được cộng vào nhân vật.',
      },
      review: {
        label: 'CẦN KIỂM TRA (Review)',
        desc: 'Phát hiện dấu hiệu bất thường nên hệ thống tạm giữ XP (chưa cộng XP vào nhân vật).',
      },
      rejected: {
        label: 'KHÔNG HỢP LỆ (Rejected)',
        desc: 'Lượt tập bị từ chối do vi phạm kiểm tra chống gian lận — KHÔNG cộng XP.',
      },
    } satisfies Record<Verdict, { label: string; desc: string }>,

    verdictReasons: {
      STATIC_SUBJECT: 'Hình ảnh quá tĩnh trong thời gian dài (nghi vấn ảnh tĩnh).',
      CHALLENGE_FAILED: 'Không vượt qua thử thách sống giơ tay trong lượt.',
      LOW_FPS: 'Tốc độ khung hình quá thấp, dữ liệu chuyển động thiếu tin cậy.',
      NOISY_REPS: 'Tỷ lệ rep bị giật/nhiễu bất thường quá cao.',
      LOOPED_MOTION: 'Quỹ đạo các rep lặp lại gần như giống hệt nhau (nghi vấn phát lại video).',
      UNIFORM_TEMPO: 'Nhịp thời gian giữa các rep đều bất thường.',
      TOO_MANY_REPS: 'Số rep vượt quá giới hạn vật lý so với thời lượng lượt.',
      INVALID_REP: 'Có rep không vượt qua bước kiểm tra lại của engine.',
    } as Record<string, string>,

    xpDiffExplanations: {
      xp_cap:
        'XP chính thức từ finalizeRun thấp hơn XP tạm vì đã chạm giới hạn 600 XP trong lần tải trang này.',
      review_held:
        'XP chính thức là 0 vì lượt ở trạng thái Cần kiểm tra (review) — engine tạm giữ toàn bộ XP.',
      rejected_zero:
        'XP chính thức là 0 vì lượt bị từ chối (rejected) — không cộng XP cho lượt không hợp lệ.',
      recheck_adjusted:
        'XP chính thức được tính lại bởi finalizeRun sau bước kiểm tra lại từng rep.',
    },

    summary: {
      titleVictory: 'Hoàn thành Hầm Ngục!',
      titleEnded: 'Kết thúc lượt tập',
      officialXpLabel: 'XP chính thức (finalizeRun)',
      tentativeXpLabel: 'XP tạm cộng dồn trên UI',
      repsLabel: 'Rep đạt / bị loại / hủy',
      livenessLabel: 'Thử thách sống (Đạt / Trượt)',
      monstersClearedLabel: 'Quái đã hạ',
      levelChangeLabel: 'Cấp độ',
      statsChangeLabel: 'Chỉ số nhân vật',
      objectivesLabel: 'Mục tiêu phụ trong lượt',
      reasonsTitle: 'Chi tiết kiểm định chống gian lận',
      noReasonsText: 'Không phát hiện bất thường nào.',
      playAgainButton: 'Chơi lượt mới',
      backHomeButton: 'Về trang chủ',
    },

    debug: {
      title: 'Debug Dungeon (F5a)',
      sampleRunButton: 'Lượt mẫu (3 quái × 2 rep)',
      sampleRunTag: 'Đang chạy Lượt mẫu',
      normalRunTag: 'Lượt chuẩn (3–5 quái)',
      seedLabel: 'Seed hầm ngục',
      tentativeXpLabel: 'XP tạm (UI)',
      officialXpLabel: 'XP finalizeRun',
      pendingOfficial: 'Chờ kết thúc lượt',
      swapsLabel: 'Lượt Đổi quái còn lại',
    },
  },
} as const;