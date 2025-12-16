/**
 * こう上優先最適化アルゴリズム
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P20に基づく
 * 「高低狂いについては、なるべく、こう上になるように計画線を変更する」
 */

class UpwardPriorityOptimizer {
  constructor(options = {}) {
    this.maxUpward = options.maxUpward || 50;           // 最大こう上量 (mm)
    this.maxDownward = options.maxDownward || 10;       // 最大こう下量 (mm)
    this.targetUpwardRatio = options.targetUpwardRatio || 0.7; // 目標こう上率 (70%)
    this.iterationLimit = options.iterationLimit || 100; // 最大反復回数
    this.convergenceThreshold = options.convergenceThreshold || 0.01; // 収束閾値
  }

  /**
   * こう上優先で計画線を最適化
   * @param {Array} restoredWaveform - 復元波形データ
   * @param {Array} initialPlanLine - 初期計画線
   * @param {Object} options - 最適化オプション
   * @returns {Object} 最適化結果
   */
  optimizePlanLine(restoredWaveform, initialPlanLine, options = {}) {
    const config = { ...this, ...options };

    // 初期状態の評価
    const initialStats = this.evaluatePlanLine(restoredWaveform, initialPlanLine);

    if (this.verbose) {
      console.log('初期こう上率:', (initialStats.upwardRatio * 100).toFixed(1) + '%');
    }

    // すでに目標を達成している場合
    if (initialStats.upwardRatio >= config.targetUpwardRatio) {
      return {
        optimizedPlanLine: initialPlanLine,
        statistics: initialStats,
        iterations: 0,
        converged: true,
        message: 'すでに目標こう上率を達成しています'
      };
    }

    // 最適化処理
    let currentPlanLine = [...initialPlanLine];
    let iteration = 0;
    let converged = false;
    let bestPlanLine = currentPlanLine;
    let bestScore = initialStats.score;

    while (iteration < config.iterationLimit && !converged) {
      // 計画線の調整
      const adjustedPlanLine = this.adjustPlanLine(
        restoredWaveform,
        currentPlanLine,
        config
      );

      // 評価
      const stats = this.evaluatePlanLine(restoredWaveform, adjustedPlanLine);

      // スコアが改善した場合
      if (stats.score > bestScore) {
        bestPlanLine = adjustedPlanLine;
        bestScore = stats.score;
      }

      // 収束判定
      const improvement = Math.abs(stats.upwardRatio - initialStats.upwardRatio);
      if (stats.upwardRatio >= config.targetUpwardRatio ||
          improvement < config.convergenceThreshold) {
        converged = true;
      }

      currentPlanLine = adjustedPlanLine;
      iteration++;

      if (this.verbose && iteration % 10 === 0) {
        console.log(`反復 ${iteration}: こう上率 ${(stats.upwardRatio * 100).toFixed(1)}%`);
      }
    }

    // 最終評価
    const finalStats = this.evaluatePlanLine(restoredWaveform, bestPlanLine);

    return {
      optimizedPlanLine: bestPlanLine,
      statistics: finalStats,
      iterations: iteration,
      converged: converged,
      improvement: {
        upwardRatio: finalStats.upwardRatio - initialStats.upwardRatio,
        score: finalStats.score - initialStats.score
      }
    };
  }

  /**
   * 計画線を調整してこう上を増やす
   * @param {Array} restoredWaveform - 復元波形
   * @param {Array} planLine - 現在の計画線
   * @param {Object} config - 設定
   * @returns {Array} 調整済み計画線
   */
  adjustPlanLine(restoredWaveform, planLine, config) {
    const adjusted = [];

    for (let i = 0; i < planLine.length; i++) {
      const restored = restoredWaveform[i] || { value: 0 };
      const plan = planLine[i] || { value: 0 };

      // 現在の移動量
      const currentMovement = plan.value - restored.value;

      // 調整後の移動量
      let adjustedMovement = currentMovement;

      if (currentMovement < 0) {
        // こう下の場合、できるだけ減らす
        adjustedMovement = this.adjustDownwardMovement(
          currentMovement,
          config.maxDownward
        );
      } else if (currentMovement < config.maxUpward * 0.5) {
        // こう上が少ない場合、増やす
        adjustedMovement = this.adjustUpwardMovement(
          currentMovement,
          config.maxUpward,
          config.targetUpwardRatio
        );
      }

      // スムージング（急激な変化を避ける）
      if (i > 0 && i < planLine.length - 1) {
        const prevMovement = adjusted[i - 1] ?
          adjusted[i - 1].value - restoredWaveform[i - 1].value : currentMovement;
        const nextMovement = planLine[i + 1] ?
          planLine[i + 1].value - restoredWaveform[i + 1].value : currentMovement;

        adjustedMovement = this.smoothMovement(
          adjustedMovement,
          prevMovement,
          nextMovement
        );
      }

      adjusted.push({
        position: plan.position || restored.position,
        value: restored.value + adjustedMovement
      });
    }

    // 全体的な平滑化
    return this.smoothPlanLine(adjusted);
  }

  /**
   * こう下移動量を調整
   * @param {number} movement - 現在の移動量
   * @param {number} maxDownward - 最大こう下量
   * @returns {number} 調整後の移動量
   */
  adjustDownwardMovement(movement, maxDownward) {
    // こう下を最小限に抑える
    if (Math.abs(movement) > maxDownward) {
      // 最大こう下量に制限
      return -maxDownward;
    } else if (Math.abs(movement) < maxDownward * 0.3) {
      // 小さなこう下は0にする
      return 0;
    } else {
      // 段階的に減少
      return movement * 0.5;
    }
  }

  /**
   * こう上移動量を調整
   * @param {number} movement - 現在の移動量
   * @param {number} maxUpward - 最大こう上量
   * @param {number} targetRatio - 目標こう上率
   * @returns {number} 調整後の移動量
   */
  adjustUpwardMovement(movement, maxUpward, targetRatio) {
    // 目標こう上量
    const targetUpward = maxUpward * targetRatio;

    if (movement < targetUpward * 0.5) {
      // こう上が少ない場合、増やす
      return Math.min(movement * 1.5, targetUpward);
    } else {
      // 適度なこう上は維持
      return movement;
    }
  }

  /**
   * 移動量を平滑化
   * @param {number} current - 現在の移動量
   * @param {number} prev - 前の移動量
   * @param {number} next - 次の移動量
   * @returns {number} 平滑化後の移動量
   */
  smoothMovement(current, prev, next) {
    // 3点の重み付き平均
    const weights = [0.25, 0.5, 0.25];
    return prev * weights[0] + current * weights[1] + next * weights[2];
  }

  /**
   * 計画線全体を平滑化
   * @param {Array} planLine - 計画線
   * @returns {Array} 平滑化後の計画線
   */
  smoothPlanLine(planLine) {
    const smoothed = [];
    const windowSize = 5; // 平滑化窓サイズ

    for (let i = 0; i < planLine.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = -windowSize; j <= windowSize; j++) {
        const index = i + j;
        if (index >= 0 && index < planLine.length) {
          sum += planLine[index].value;
          count++;
        }
      }

      smoothed.push({
        ...planLine[i],
        value: count > 0 ? sum / count : planLine[i].value
      });
    }

    return smoothed;
  }

  /**
   * 計画線を評価
   * @param {Array} restoredWaveform - 復元波形
   * @param {Array} planLine - 計画線
   * @returns {Object} 評価結果
   */
  evaluatePlanLine(restoredWaveform, planLine) {
    const stats = {
      totalPoints: 0,
      upwardPoints: 0,
      downwardPoints: 0,
      zeroPoints: 0,
      totalUpward: 0,
      totalDownward: 0,
      maxUpward: 0,
      maxDownward: 0,
      avgUpward: 0,
      avgDownward: 0,
      upwardRatio: 0,
      score: 0
    };

    for (let i = 0; i < planLine.length; i++) {
      const restored = restoredWaveform[i] || { value: 0 };
      const plan = planLine[i] || { value: 0 };
      const movement = plan.value - restored.value;

      stats.totalPoints++;

      if (movement > 0) {
        stats.upwardPoints++;
        stats.totalUpward += movement;
        stats.maxUpward = Math.max(stats.maxUpward, movement);
      } else if (movement < 0) {
        stats.downwardPoints++;
        stats.totalDownward += Math.abs(movement);
        stats.maxDownward = Math.max(stats.maxDownward, Math.abs(movement));
      } else {
        stats.zeroPoints++;
      }
    }

    // 統計計算
    if (stats.upwardPoints > 0) {
      stats.avgUpward = stats.totalUpward / stats.upwardPoints;
    }

    if (stats.downwardPoints > 0) {
      stats.avgDownward = stats.totalDownward / stats.downwardPoints;
    }

    stats.upwardRatio = stats.upwardPoints / stats.totalPoints;

    // スコア計算（こう上率と制限違反のバランス）
    stats.score = this.calculateScore(stats);

    return stats;
  }

  /**
   * 最適化スコアを計算
   * @param {Object} stats - 統計情報
   * @returns {number} スコア
   */
  calculateScore(stats) {
    let score = 0;

    // こう上率スコア（最重要）
    score += stats.upwardRatio * 100;

    // 過大なこう下のペナルティ
    if (stats.maxDownward > this.maxDownward) {
      score -= (stats.maxDownward - this.maxDownward) * 2;
    }

    // 過大なこう上のペナルティ
    if (stats.maxUpward > this.maxUpward) {
      score -= (stats.maxUpward - this.maxUpward);
    }

    // バランススコア（こう上とこう下の差）
    const balance = stats.totalUpward - stats.totalDownward;
    score += balance * 0.01;

    return score;
  }

  /**
   * 制約条件をチェック
   * @param {Array} planLine - 計画線
   * @param {Array} restoredWaveform - 復元波形
   * @returns {Object} 制約違反情報
   */
  checkConstraints(planLine, restoredWaveform) {
    const violations = {
      upwardViolations: [],
      downwardViolations: [],
      totalViolations: 0,
      maxViolation: 0
    };

    for (let i = 0; i < planLine.length; i++) {
      const restored = restoredWaveform[i] || { value: 0 };
      const plan = planLine[i] || { value: 0 };
      const movement = plan.value - restored.value;

      if (movement > this.maxUpward) {
        violations.upwardViolations.push({
          position: plan.position || i * 0.25,
          movement: movement,
          excess: movement - this.maxUpward
        });
        violations.maxViolation = Math.max(violations.maxViolation, movement - this.maxUpward);
      }

      if (movement < -this.maxDownward) {
        violations.downwardViolations.push({
          position: plan.position || i * 0.25,
          movement: movement,
          excess: Math.abs(movement) - this.maxDownward
        });
        violations.maxViolation = Math.max(violations.maxViolation, Math.abs(movement) - this.maxDownward);
      }
    }

    violations.totalViolations = violations.upwardViolations.length + violations.downwardViolations.length;

    return violations;
  }

  /**
   * 最適化結果のレポートを生成
   * @param {Object} result - 最適化結果
   * @returns {Object} レポート
   */
  generateReport(result) {
    const report = {
      summary: {
        optimized: result.converged,
        iterations: result.iterations,
        upwardRatio: (result.statistics.upwardRatio * 100).toFixed(1) + '%',
        targetAchieved: result.statistics.upwardRatio >= this.targetUpwardRatio
      },
      statistics: {
        upwardPoints: result.statistics.upwardPoints,
        downwardPoints: result.statistics.downwardPoints,
        maxUpward: result.statistics.maxUpward.toFixed(1) + 'mm',
        maxDownward: result.statistics.maxDownward.toFixed(1) + 'mm',
        avgUpward: result.statistics.avgUpward.toFixed(1) + 'mm',
        avgDownward: result.statistics.avgDownward.toFixed(1) + 'mm'
      },
      improvement: {
        upwardRatioIncrease: (result.improvement.upwardRatio * 100).toFixed(1) + '%',
        scoreIncrease: result.improvement.score.toFixed(2)
      },
      recommendation: this.getRecommendation(result.statistics)
    };

    return report;
  }

  /**
   * 推奨事項を生成
   * @param {Object} stats - 統計情報
   * @returns {string} 推奨事項
   */
  getRecommendation(stats) {
    if (stats.upwardRatio >= this.targetUpwardRatio) {
      return '目標こう上率を達成しています。現在の計画線を使用することを推奨します。';
    } else if (stats.upwardRatio >= this.targetUpwardRatio * 0.9) {
      return 'こう上率は目標に近い値です。部分的な手動調整で目標を達成できます。';
    } else if (stats.maxDownward > this.maxDownward) {
      return 'こう下量が制限を超えています。制限箇所の見直しが必要です。';
    } else {
      return '更なる最適化が必要です。制約条件の緩和を検討してください。';
    }
  }
}

module.exports = UpwardPriorityOptimizer;