/**
 * 初期計画線生成モジュール
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P13に基づく
 * 復元波形をベースとした適切な初期計画線の生成
 */

class InitialPlanLineGenerator {
  constructor(options = {}) {
    this.method = options.method || 'restored-based'; // restored-based, convex, manual
    this.smoothingFactor = options.smoothingFactor || 0.3;
    this.upwardBias = options.upwardBias || 5; // 初期こう上量(mm)
    this.maxUpward = options.maxUpward || 50;
    this.maxDownward = options.maxDownward || 10;
  }

  /**
   * 初期計画線を生成
   * @param {Array} restoredWaveform - 復元波形データ
   * @param {Object} options - 生成オプション
   * @returns {Object} 初期計画線データ
   */
  generateInitialPlanLine(restoredWaveform, options = {}) {
    const config = { ...this, ...options };

    // 生成方法に応じて処理を分岐
    switch (config.method) {
      case 'restored-based':
        // 復元波形ベース（推奨）
        return this.generateFromRestoredWaveform(restoredWaveform, config);

      case 'convex':
        // 凸型自動生成
        return this.generateConvexPlanLine(restoredWaveform, config);

      case 'flat':
        // フラット（テスト用）
        return this.generateFlatPlanLine(restoredWaveform, config);

      case 'manual':
        // 手動入力用の初期値
        return this.generateManualBaseline(restoredWaveform, config);

      default:
        throw new Error(`Unknown generation method: ${config.method}`);
    }
  }

  /**
   * 復元波形ベースの計画線生成（仕様書P13準拠）
   * @param {Array} restoredWaveform - 復元波形
   * @param {Object} config - 設定
   * @returns {Object} 計画線データ
   */
  generateFromRestoredWaveform(restoredWaveform, config) {
    if (!restoredWaveform || restoredWaveform.length === 0) {
      throw new Error('復元波形データが必要です');
    }

    // Step 1: 復元波形を平滑化
    const smoothedWaveform = this.smoothWaveform(
      restoredWaveform,
      config.smoothingFactor
    );

    // Step 2: こう上バイアスを追加
    const biasedWaveform = smoothedWaveform.map(point => ({
      ...point,
      value: point.value + config.upwardBias
    }));

    // Step 3: 長波長成分を強調（40m以上の成分）
    const longWaveform = this.extractLongWavelength(biasedWaveform, 40);

    // Step 4: こう上/こう下の制限を適用
    const limitedWaveform = this.applyMovementLimits(
      longWaveform,
      restoredWaveform,
      config
    );

    // Step 5: 端部処理（スムーズな接続）
    const finalPlanLine = this.processEdges(limitedWaveform);

    // 統計情報を計算
    const statistics = this.calculateStatistics(
      finalPlanLine,
      restoredWaveform
    );

    return {
      planLine: finalPlanLine,
      method: 'restored-based',
      statistics,
      parameters: {
        smoothingFactor: config.smoothingFactor,
        upwardBias: config.upwardBias,
        maxUpward: config.maxUpward,
        maxDownward: config.maxDownward
      }
    };
  }

  /**
   * 凸型計画線の自動生成
   * @param {Array} restoredWaveform - 復元波形
   * @param {Object} config - 設定
   * @returns {Object} 計画線データ
   */
  generateConvexPlanLine(restoredWaveform, config) {
    const length = restoredWaveform.length;
    const planLine = [];

    // 区間を分割して凸型を生成
    const segments = 10; // 区間数
    const segmentLength = Math.floor(length / segments);

    for (let i = 0; i < length; i++) {
      const restored = restoredWaveform[i];
      const segmentIndex = Math.floor(i / segmentLength);

      // 凸型の係数（中央部で最大）
      const centerFactor = 1 - Math.abs((segmentIndex - segments / 2) / (segments / 2));

      // こう上量を計算
      const baseUpward = config.upwardBias;
      const convexUpward = centerFactor * 20; // 中央部で最大20mm追加

      planLine.push({
        position: restored.position,
        value: restored.value + baseUpward + convexUpward
      });
    }

    // 平滑化
    const smoothedPlanLine = this.smoothWaveform(planLine, 0.5);

    // 統計情報
    const statistics = this.calculateStatistics(
      smoothedPlanLine,
      restoredWaveform
    );

    return {
      planLine: smoothedPlanLine,
      method: 'convex',
      statistics,
      parameters: config
    };
  }

  /**
   * フラットな計画線（問題のある初期値）
   * @deprecated 使用非推奨 - テスト用のみ
   */
  generateFlatPlanLine(restoredWaveform, config) {
    const avgValue = restoredWaveform.reduce((sum, p) => sum + p.value, 0) / restoredWaveform.length;

    const planLine = restoredWaveform.map(point => ({
      position: point.position,
      value: avgValue + config.upwardBias
    }));

    return {
      planLine,
      method: 'flat',
      statistics: this.calculateStatistics(planLine, restoredWaveform),
      warning: 'フラット初期値は推奨されません'
    };
  }

  /**
   * 手動調整用のベースライン
   * @param {Array} restoredWaveform - 復元波形
   * @param {Object} config - 設定
   * @returns {Object} 計画線データ
   */
  generateManualBaseline(restoredWaveform, config) {
    // 復元波形に軽い平滑化のみ適用
    const baseline = this.smoothWaveform(restoredWaveform, 0.1);

    return {
      planLine: baseline,
      method: 'manual',
      statistics: this.calculateStatistics(baseline, restoredWaveform),
      note: '手動調整が必要です'
    };
  }

  /**
   * 波形の平滑化
   * @param {Array} waveform - 波形データ
   * @param {number} factor - 平滑化係数 (0-1)
   * @returns {Array} 平滑化後の波形
   */
  smoothWaveform(waveform, factor) {
    const smoothed = [];
    const windowSize = Math.max(3, Math.floor(waveform.length * factor * 0.1));

    for (let i = 0; i < waveform.length; i++) {
      let sum = 0;
      let count = 0;
      let positionSum = 0;

      // 移動平均
      for (let j = -windowSize; j <= windowSize; j++) {
        const index = i + j;
        if (index >= 0 && index < waveform.length) {
          // ガウシアン重み
          const weight = Math.exp(-(j * j) / (2 * windowSize * windowSize / 9));
          sum += waveform[index].value * weight;
          positionSum += waveform[index].position * weight;
          count += weight;
        }
      }

      smoothed.push({
        position: waveform[i].position,
        value: count > 0 ? sum / count : waveform[i].value
      });
    }

    return smoothed;
  }

  /**
   * 長波長成分の抽出
   * @param {Array} waveform - 波形データ
   * @param {number} minWavelength - 最小波長(m)
   * @returns {Array} 長波長成分
   */
  extractLongWavelength(waveform, minWavelength) {
    // サンプリング間隔（通常0.25m）
    const samplingInterval = 0.25;
    const windowSize = Math.round(minWavelength / samplingInterval);

    // ローパスフィルタ適用
    return this.smoothWaveform(waveform, windowSize / waveform.length);
  }

  /**
   * 移動量制限の適用
   * @param {Array} planLine - 計画線
   * @param {Array} restoredWaveform - 復元波形
   * @param {Object} config - 設定
   * @returns {Array} 制限適用後の計画線
   */
  applyMovementLimits(planLine, restoredWaveform, config) {
    const limited = [];

    for (let i = 0; i < planLine.length; i++) {
      const plan = planLine[i];
      const restored = restoredWaveform[i];
      const movement = plan.value - restored.value;

      let limitedValue = plan.value;

      // こう上制限
      if (movement > config.maxUpward) {
        limitedValue = restored.value + config.maxUpward;
      }
      // こう下制限
      else if (movement < -config.maxDownward) {
        limitedValue = restored.value - config.maxDownward;
      }

      limited.push({
        position: plan.position,
        value: limitedValue
      });
    }

    return limited;
  }

  /**
   * 端部処理
   * @param {Array} planLine - 計画線
   * @returns {Array} 端部処理後の計画線
   */
  processEdges(planLine) {
    const processed = [...planLine];
    const edgeLength = Math.min(20, Math.floor(planLine.length * 0.05));

    // 始端部の処理
    for (let i = 0; i < edgeLength; i++) {
      const factor = i / edgeLength; // 0から1へ
      const originalValue = processed[i].value;
      const targetValue = processed[edgeLength].value;
      processed[i].value = originalValue * factor + targetValue * (1 - factor);
    }

    // 終端部の処理
    const endStart = planLine.length - edgeLength;
    for (let i = endStart; i < planLine.length; i++) {
      const factor = (planLine.length - 1 - i) / edgeLength; // 1から0へ
      const originalValue = processed[i].value;
      const targetValue = processed[endStart - 1].value;
      processed[i].value = originalValue * factor + targetValue * (1 - factor);
    }

    return processed;
  }

  /**
   * 統計情報の計算
   * @param {Array} planLine - 計画線
   * @param {Array} restoredWaveform - 復元波形
   * @returns {Object} 統計情報
   */
  calculateStatistics(planLine, restoredWaveform) {
    const stats = {
      totalPoints: planLine.length,
      upwardPoints: 0,
      downwardPoints: 0,
      zeroPoints: 0,
      maxUpward: 0,
      maxDownward: 0,
      avgUpward: 0,
      avgDownward: 0,
      totalUpward: 0,
      totalDownward: 0,
      upwardRatio: 0
    };

    for (let i = 0; i < planLine.length; i++) {
      const movement = planLine[i].value - restoredWaveform[i].value;

      if (movement > 0.1) {
        stats.upwardPoints++;
        stats.totalUpward += movement;
        stats.maxUpward = Math.max(stats.maxUpward, movement);
      } else if (movement < -0.1) {
        stats.downwardPoints++;
        stats.totalDownward += Math.abs(movement);
        stats.maxDownward = Math.max(stats.maxDownward, Math.abs(movement));
      } else {
        stats.zeroPoints++;
      }
    }

    // 平均値計算
    if (stats.upwardPoints > 0) {
      stats.avgUpward = stats.totalUpward / stats.upwardPoints;
    }
    if (stats.downwardPoints > 0) {
      stats.avgDownward = stats.totalDownward / stats.downwardPoints;
    }

    // こう上率
    stats.upwardRatio = stats.upwardPoints / stats.totalPoints;

    return stats;
  }

  /**
   * 初期値の妥当性検証
   * @param {Array} planLine - 計画線
   * @param {Array} restoredWaveform - 復元波形
   * @returns {Object} 検証結果
   */
  validateInitialPlanLine(planLine, restoredWaveform) {
    const stats = this.calculateStatistics(planLine, restoredWaveform);
    const issues = [];
    const warnings = [];

    // こう上率チェック
    if (stats.upwardRatio < 0.3) {
      issues.push('こう上率が低すぎます（30%未満）');
    } else if (stats.upwardRatio < 0.5) {
      warnings.push('こう上率が推奨値以下です（50%未満）');
    }

    // 最大移動量チェック
    if (stats.maxUpward > 60) {
      issues.push(`最大こう上量が過大です（${stats.maxUpward.toFixed(1)}mm）`);
    }
    if (stats.maxDownward > 20) {
      issues.push(`最大こう下量が過大です（${stats.maxDownward.toFixed(1)}mm）`);
    }

    // フラットチェック（変化が少なすぎる）
    const variance = this.calculateVariance(planLine);
    if (variance < 1) {
      issues.push('計画線がフラットすぎます（変化が少ない）');
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      statistics: stats,
      recommendation: this.getRecommendation(stats, issues)
    };
  }

  /**
   * 分散の計算
   * @param {Array} data - データ配列
   * @returns {number} 分散
   */
  calculateVariance(data) {
    const mean = data.reduce((sum, p) => sum + p.value, 0) / data.length;
    const variance = data.reduce((sum, p) => sum + Math.pow(p.value - mean, 2), 0) / data.length;
    return variance;
  }

  /**
   * 推奨事項の生成
   * @param {Object} stats - 統計情報
   * @param {Array} issues - 問題点
   * @returns {string} 推奨事項
   */
  getRecommendation(stats, issues) {
    if (issues.length === 0) {
      if (stats.upwardRatio > 0.7) {
        return '良好な初期計画線です。そのまま使用できます。';
      } else {
        return '初期計画線として使用可能です。必要に応じて調整してください。';
      }
    } else if (issues.some(i => i.includes('フラット'))) {
      return '復元波形ベースの生成方法を使用してください。';
    } else if (stats.upwardRatio < 0.5) {
      return 'こう上優先最適化の実行を推奨します。';
    } else {
      return '手動調整または再生成を検討してください。';
    }
  }
}

module.exports = InitialPlanLineGenerator;