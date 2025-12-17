/**
 * 計画線ゼロ点システム
 * 復元波形のゼロクロス点を検出し、それを結んだ線を計画線とする
 * 文書「057_復元波形を用いた軌道整正計算」の仕様に基づく実装
 */

class PlanLineZeroPointSystem {
  constructor(options = {}) {
    this.samplingInterval = options.samplingInterval || 0.25; // m
    this.smoothingWindow = options.smoothingWindow || 5; // points
    this.interpolationMethod = options.interpolationMethod || 'spline'; // 'linear' or 'spline'
  }

  /**
   * 復元波形からゼロクロス点を検出
   * @param {Array} restoredWaveform - 復元波形データ [{distance, value}]
   * @returns {Array} ゼロクロス点の配列 [{distance, value, type}]
   */
  detectZeroCrossPoints(restoredWaveform) {
    const zeroCrossPoints = [];

    // データが少ない場合のエラーチェック
    if (!restoredWaveform || restoredWaveform.length < 2) {
      throw new Error('復元波形データが不足しています');
    }

    // ゼロクロス点の検出
    for (let i = 1; i < restoredWaveform.length; i++) {
      const prev = restoredWaveform[i - 1];
      const curr = restoredWaveform[i];

      // 符号が変わる点を検出
      if (prev.value * curr.value < 0) {
        // 線形補間でゼロクロス点の正確な位置を計算
        const ratio = Math.abs(prev.value) / (Math.abs(prev.value) + Math.abs(curr.value));
        const crossDistance = prev.distance + (curr.distance - prev.distance) * ratio;

        // クロスの方向を判定（上昇または下降）
        const crossType = prev.value < curr.value ? 'ascending' : 'descending';

        zeroCrossPoints.push({
          distance: crossDistance,
          value: 0, // ゼロクロス点なので値は0
          type: crossType,
          originalIndex: i
        });
      }

      // 正確にゼロの点も検出
      if (curr.value === 0) {
        const crossType = i > 0 && i < restoredWaveform.length - 1
          ? (restoredWaveform[i - 1].value < restoredWaveform[i + 1].value ? 'ascending' : 'descending')
          : 'exact';

        zeroCrossPoints.push({
          distance: curr.distance,
          value: 0,
          type: crossType,
          originalIndex: i
        });
      }
    }

    // 開始点と終了点も追加（境界条件として）
    if (restoredWaveform[0].value === 0) {
      zeroCrossPoints.unshift({
        distance: restoredWaveform[0].distance,
        value: 0,
        type: 'boundary_start',
        originalIndex: 0
      });
    }

    if (restoredWaveform[restoredWaveform.length - 1].value === 0) {
      zeroCrossPoints.push({
        distance: restoredWaveform[restoredWaveform.length - 1].distance,
        value: 0,
        type: 'boundary_end',
        originalIndex: restoredWaveform.length - 1
      });
    }

    console.log(`検出されたゼロクロス点: ${zeroCrossPoints.length}個`);
    return zeroCrossPoints;
  }

  /**
   * ゼロ点を結んだ初期計画線を生成
   * @param {Array} zeroCrossPoints - ゼロクロス点の配列
   * @param {Array} restoredWaveform - 元の復元波形（補間用）
   * @returns {Array} 計画線データ [{distance, value}]
   */
  generateInitialPlanLine(zeroCrossPoints, restoredWaveform) {
    if (zeroCrossPoints.length < 2) {
      console.warn('ゼロクロス点が不足しています。移動平均で計画線を生成します。');
      return this.generateFallbackPlanLine(restoredWaveform);
    }

    const planLine = [];

    if (this.interpolationMethod === 'spline') {
      // スプライン補間を使用
      planLine.push(...this.splineInterpolation(zeroCrossPoints, restoredWaveform));
    } else {
      // 線形補間を使用
      planLine.push(...this.linearInterpolation(zeroCrossPoints, restoredWaveform));
    }

    return planLine;
  }

  /**
   * スプライン補間による計画線生成
   * @private
   */
  splineInterpolation(zeroCrossPoints, restoredWaveform) {
    const planLine = [];

    // 3次スプライン補間のための係数計算
    const n = zeroCrossPoints.length;
    const h = [];
    const alpha = [];

    // 間隔の計算
    for (let i = 0; i < n - 1; i++) {
      h[i] = zeroCrossPoints[i + 1].distance - zeroCrossPoints[i].distance;
    }

    // 2階微分の計算
    for (let i = 1; i < n - 1; i++) {
      alpha[i] = 3 * (zeroCrossPoints[i + 1].value - zeroCrossPoints[i].value) / h[i]
                - 3 * (zeroCrossPoints[i].value - zeroCrossPoints[i - 1].value) / h[i - 1];
    }

    // トリディアゴナル行列の解法
    const l = new Array(n).fill(1);
    const mu = new Array(n).fill(0);
    const z = new Array(n).fill(0);

    for (let i = 1; i < n - 1; i++) {
      l[i] = 2 * (zeroCrossPoints[i + 1].distance - zeroCrossPoints[i - 1].distance) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    const c = new Array(n).fill(0);
    const b = new Array(n).fill(0);
    const d = new Array(n).fill(0);

    for (let j = n - 2; j >= 0; j--) {
      c[j] = z[j] - mu[j] * c[j + 1];
      b[j] = (zeroCrossPoints[j + 1].value - zeroCrossPoints[j].value) / h[j]
            - h[j] * (c[j + 1] + 2 * c[j]) / 3;
      d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }

    // 各区間でスプライン曲線を生成
    for (let i = 0; i < restoredWaveform.length; i++) {
      const dist = restoredWaveform[i].distance;

      // どの区間に属するか判定
      let j = 0;
      for (let k = 0; k < n - 1; k++) {
        if (dist >= zeroCrossPoints[k].distance && dist <= zeroCrossPoints[k + 1].distance) {
          j = k;
          break;
        }
      }

      // 境界外の処理
      if (dist < zeroCrossPoints[0].distance) {
        j = 0;
      } else if (dist > zeroCrossPoints[n - 1].distance) {
        j = n - 2;
      }

      // スプライン値の計算
      const dx = dist - zeroCrossPoints[j].distance;
      const value = zeroCrossPoints[j].value
                  + b[j] * dx
                  + c[j] * dx * dx
                  + d[j] * dx * dx * dx;

      planLine.push({
        distance: dist,
        value: value
      });
    }

    return planLine;
  }

  /**
   * 線形補間による計画線生成
   * @private
   */
  linearInterpolation(zeroCrossPoints, restoredWaveform) {
    const planLine = [];

    for (let i = 0; i < restoredWaveform.length; i++) {
      const dist = restoredWaveform[i].distance;

      // 最も近い2つのゼロクロス点を見つける
      let leftPoint = zeroCrossPoints[0];
      let rightPoint = zeroCrossPoints[zeroCrossPoints.length - 1];

      for (let j = 0; j < zeroCrossPoints.length - 1; j++) {
        if (dist >= zeroCrossPoints[j].distance && dist <= zeroCrossPoints[j + 1].distance) {
          leftPoint = zeroCrossPoints[j];
          rightPoint = zeroCrossPoints[j + 1];
          break;
        }
      }

      // 線形補間
      const ratio = (dist - leftPoint.distance) / (rightPoint.distance - leftPoint.distance);
      const value = leftPoint.value + (rightPoint.value - leftPoint.value) * ratio;

      planLine.push({
        distance: dist,
        value: value
      });
    }

    return planLine;
  }

  /**
   * ゼロクロス点が不足している場合の代替計画線生成（移動平均）
   * @private
   */
  generateFallbackPlanLine(restoredWaveform) {
    const planLine = [];
    const windowSize = Math.min(this.smoothingWindow * 10, Math.floor(restoredWaveform.length / 4));
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < restoredWaveform.length; i++) {
      let sum = 0;
      let count = 0;

      const start = Math.max(0, i - halfWindow);
      const end = Math.min(restoredWaveform.length - 1, i + halfWindow);

      for (let j = start; j <= end; j++) {
        sum += restoredWaveform[j].value;
        count++;
      }

      planLine.push({
        distance: restoredWaveform[i].distance,
        value: sum / count
      });
    }

    return planLine;
  }

  /**
   * 移動量制限による計画線の調整
   * @param {Array} planLine - 初期計画線
   * @param {Array} restoredWaveform - 復元波形
   * @param {Object} restrictions - 制限設定 {standard: 30, maximum: 50, fixedPoints: []}
   * @returns {Array} 調整後の計画線
   */
  adjustPlanLineWithRestrictions(planLine, restoredWaveform, restrictions = {}) {
    const {
      standard = 30,     // 標準制限値 (mm)
      maximum = 50,      // 最大制限値 (mm)
      fixedPoints = [],  // 不動点 [{startDistance, endDistance, maxMovement}]
      upwardPriority = true  // こう上優先
    } = restrictions;

    const adjustedPlanLine = [...planLine];
    let adjustmentMade = true;
    let iterations = 0;
    const maxIterations = 10;

    // 収束するまで繰り返し調整
    while (adjustmentMade && iterations < maxIterations) {
      adjustmentMade = false;
      iterations++;

      for (let i = 0; i < adjustedPlanLine.length; i++) {
        const movement = adjustedPlanLine[i].value - restoredWaveform[i].value;
        const absMovement = Math.abs(movement);

        // 固定点チェック
        const isFixedPoint = fixedPoints.some(fp =>
          restoredWaveform[i].distance >= fp.startDistance &&
          restoredWaveform[i].distance <= fp.endDistance
        );

        const currentLimit = isFixedPoint
          ? fixedPoints.find(fp =>
              restoredWaveform[i].distance >= fp.startDistance &&
              restoredWaveform[i].distance <= fp.endDistance
            ).maxMovement
          : maximum;

        // 制限超過の場合、計画線を調整
        if (absMovement > currentLimit) {
          const targetMovement = currentLimit * 0.95; // 少し余裕を持たせる
          const adjustment = movement > 0
            ? targetMovement - movement
            : -targetMovement - movement;

          // こう上優先の場合、下方向への調整を制限
          if (upwardPriority && adjustment < 0) {
            // 周辺の計画線を上方向に調整
            this.adjustSurroundingPoints(
              adjustedPlanLine,
              i,
              Math.abs(adjustment),
              'upward'
            );
          } else {
            adjustedPlanLine[i].value += adjustment;
          }

          adjustmentMade = true;
        }

        // 標準制限のソフト警告（調整はしないが記録）
        if (absMovement > standard && absMovement <= currentLimit) {
          console.log(`標準制限超過: 位置 ${restoredWaveform[i].distance}m, 移動量 ${absMovement.toFixed(1)}mm`);
        }
      }
    }

    // スムージング処理（急激な変化を緩和）
    const smoothedPlanLine = this.smoothPlanLine(adjustedPlanLine, 3);

    console.log(`計画線調整完了: ${iterations}回の反復`);
    return smoothedPlanLine;
  }

  /**
   * 周辺点の調整（こう上優先時の処理）
   * @private
   */
  adjustSurroundingPoints(planLine, centerIndex, adjustmentAmount, direction) {
    const influenceRadius = 20; // 影響範囲（点数）
    const start = Math.max(0, centerIndex - influenceRadius);
    const end = Math.min(planLine.length - 1, centerIndex + influenceRadius);

    for (let i = start; i <= end; i++) {
      if (i === centerIndex) continue;

      const distance = Math.abs(i - centerIndex);
      const influence = Math.exp(-distance / 5); // ガウシアン減衰
      const adjustment = adjustmentAmount * influence;

      if (direction === 'upward') {
        planLine[i].value += adjustment;
      } else {
        planLine[i].value -= adjustment;
      }
    }
  }

  /**
   * 計画線の平滑化
   * @private
   */
  smoothPlanLine(planLine, windowSize = 3) {
    const smoothed = [...planLine];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = halfWindow; i < planLine.length - halfWindow; i++) {
      let sum = 0;
      let count = 0;

      for (let j = i - halfWindow; j <= i + halfWindow; j++) {
        sum += planLine[j].value;
        count++;
      }

      smoothed[i] = {
        ...planLine[i],
        value: sum / count
      };
    }

    return smoothed;
  }

  /**
   * 計画線の品質評価
   * @param {Array} planLine - 計画線
   * @param {Array} restoredWaveform - 復元波形
   * @returns {Object} 評価結果
   */
  evaluatePlanLineQuality(planLine, restoredWaveform) {
    const movements = [];
    let totalMovement = 0;
    let maxMovement = 0;
    let upwardMovement = 0;
    let downwardMovement = 0;

    for (let i = 0; i < planLine.length; i++) {
      const movement = planLine[i].value - restoredWaveform[i].value;
      movements.push(movement);

      totalMovement += Math.abs(movement);
      maxMovement = Math.max(maxMovement, Math.abs(movement));

      if (movement > 0) {
        upwardMovement += movement;
      } else {
        downwardMovement += Math.abs(movement);
      }
    }

    const averageMovement = totalMovement / planLine.length;
    const upwardRatio = upwardMovement / (upwardMovement + downwardMovement);

    // 標準偏差の計算
    let variance = 0;
    for (const movement of movements) {
      variance += Math.pow(movement - averageMovement, 2);
    }
    const stdDev = Math.sqrt(variance / movements.length);

    return {
      averageMovement: averageMovement.toFixed(2),
      maxMovement: maxMovement.toFixed(2),
      totalMovement: totalMovement.toFixed(2),
      upwardRatio: (upwardRatio * 100).toFixed(1),
      standardDeviation: stdDev.toFixed(2),
      quality: this.calculateQualityScore(averageMovement, maxMovement, upwardRatio)
    };
  }

  /**
   * 品質スコアの計算
   * @private
   */
  calculateQualityScore(avgMovement, maxMovement, upwardRatio) {
    let score = 100;

    // 平均移動量によるペナルティ
    if (avgMovement > 10) score -= (avgMovement - 10) * 2;
    if (avgMovement > 20) score -= (avgMovement - 20) * 3;

    // 最大移動量によるペナルティ
    if (maxMovement > 30) score -= (maxMovement - 30);
    if (maxMovement > 50) score -= (maxMovement - 50) * 2;

    // こう上率によるボーナス
    if (upwardRatio > 0.7) score += 10;
    if (upwardRatio > 0.8) score += 10;

    return Math.max(0, Math.min(100, score));
  }
}

module.exports = PlanLineZeroPointSystem;