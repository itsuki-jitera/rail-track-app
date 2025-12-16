/**
 * 凸型計画線生成アルゴリズム
 * こう上優先で下方向移動を最小限に抑える
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 復元波形のゼロ点を結んだ線が当初の計画線
 * - 高低狂いについては、なるべく「こう上」になるように計画線を変更
 * - 下方向への修正を最小限に抑え、道床への負荷を軽減
 */

class ConvexPlanLine {
  /**
   * こう上優先の凸型計画線を生成
   *
   * @param {Array} restoredWaveform - 復元波形データ { position, level, alignment }
   * @param {Object} constraints - 制約条件
   * @param {number} constraints.maxUpwardMovement - 最大上方向移動量 (mm)
   * @param {number} constraints.maxDownwardMovement - 最大下方向移動量 (mm) - より小さい値を設定
   * @param {Array} constraints.fixedPoints - 固定点 [{ position, mustKeep }]
   * @param {Array} constraints.movementLimits - 移動量制限箇所 [{ start, end, maxMovement }]
   * @returns {Object} { planLine, movementAmounts, statistics }
   */
  static generateConvexPlan(restoredWaveform, constraints = {}) {
    const {
      maxUpwardMovement = 50,    // デフォルト最大上方向移動量 50mm
      maxDownwardMovement = 10,   // デフォルト最大下方向移動量 10mm（こう上優先）
      fixedPoints = [],
      movementLimits = []
    } = constraints;

    console.log('凸型計画線生成開始');
    console.log(`データ点数: ${restoredWaveform.length}`);
    console.log(`最大上方向移動: ${maxUpwardMovement}mm, 最大下方向移動: ${maxDownwardMovement}mm`);

    // 1. ゼロクロス点の検出
    const zeroCrossPoints = this.findZeroCrossPoints(restoredWaveform);
    console.log(`ゼロクロス点数: ${zeroCrossPoints.length}`);

    // 2. 初期計画線の生成（復元波形のゼロ点を結ぶ）
    let planLine = this.generateInitialPlanLine(restoredWaveform, zeroCrossPoints);

    // 3. 固定点の適用
    if (fixedPoints.length > 0) {
      planLine = this.applyFixedPoints(planLine, fixedPoints);
    }

    // 4. こう上優先の最適化
    planLine = this.optimizeForUpwardPriority(
      planLine,
      restoredWaveform,
      maxUpwardMovement,
      maxDownwardMovement
    );

    // 5. 移動量制限の適用
    if (movementLimits.length > 0) {
      planLine = this.applyMovementLimits(planLine, restoredWaveform, movementLimits);
    }

    // 6. 平滑化処理（急激な変化を避ける）
    planLine = this.smoothPlanLine(planLine);

    // 7. 移動量の計算
    const movementAmounts = this.calculateMovementAmounts(restoredWaveform, planLine);

    // 8. 統計情報の計算
    const statistics = this.calculateStatistics(movementAmounts);

    return {
      planLine,
      movementAmounts,
      statistics,
      zeroCrossPoints
    };
  }

  /**
   * ゼロクロス点の検出
   * 復元波形が0を横切る点を検出
   */
  static findZeroCrossPoints(waveform) {
    const zeroCrossPoints = [];

    for (let i = 1; i < waveform.length; i++) {
      const prev = waveform[i - 1].level;
      const curr = waveform[i].level;

      // 符号が変わる点を検出
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
        // 線形補間でゼロクロス位置を計算
        const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
        const position = waveform[i - 1].position +
          (waveform[i].position - waveform[i - 1].position) * ratio;

        zeroCrossPoints.push({
          index: i,
          position: position,
          type: prev >= 0 ? 'down' : 'up'  // down: 下降ゼロクロス, up: 上昇ゼロクロス
        });
      }
    }

    return zeroCrossPoints;
  }

  /**
   * 初期計画線の生成
   * ゼロクロス点を結ぶ線形補間
   */
  static generateInitialPlanLine(waveform, zeroCrossPoints) {
    const planLine = [];

    // 始点の処理
    if (zeroCrossPoints.length === 0) {
      // ゼロクロス点がない場合は水平線（0レベル）
      return waveform.map(w => ({
        position: w.position,
        targetLevel: 0,
        targetAlignment: 0
      }));
    }

    let currentZeroIndex = 0;

    for (let i = 0; i < waveform.length; i++) {
      const position = waveform[i].position;
      let targetLevel = 0;

      // 最初のゼロクロス点より前
      if (currentZeroIndex === 0 && position < zeroCrossPoints[0].position) {
        targetLevel = 0;
      }
      // 最後のゼロクロス点より後
      else if (currentZeroIndex >= zeroCrossPoints.length - 1) {
        targetLevel = 0;
      }
      // ゼロクロス点間の補間
      else {
        while (currentZeroIndex < zeroCrossPoints.length - 1 &&
               position > zeroCrossPoints[currentZeroIndex + 1].position) {
          currentZeroIndex++;
        }

        if (currentZeroIndex < zeroCrossPoints.length - 1) {
          // 線形補間
          const p1 = zeroCrossPoints[currentZeroIndex].position;
          const p2 = zeroCrossPoints[currentZeroIndex + 1].position;
          const ratio = (position - p1) / (p2 - p1);
          targetLevel = 0; // ゼロ点を結ぶので常に0
        }
      }

      planLine.push({
        position: position,
        targetLevel: targetLevel,
        targetAlignment: 0  // 通りは別途処理
      });
    }

    return planLine;
  }

  /**
   * 固定点の適用
   */
  static applyFixedPoints(planLine, fixedPoints) {
    fixedPoints.forEach(fixed => {
      const index = planLine.findIndex(p =>
        Math.abs(p.position - fixed.position) < 0.25  // 0.25m以内の点を固定
      );
      if (index >= 0 && fixed.mustKeep) {
        planLine[index].targetLevel = fixed.level || 0;
        planLine[index].fixed = true;
      }
    });
    return planLine;
  }

  /**
   * こう上優先の最適化
   * 下方向移動を最小化し、上方向移動を優先
   */
  static optimizeForUpwardPriority(planLine, waveform, maxUp, maxDown) {
    const optimizedPlan = [...planLine];

    for (let i = 0; i < waveform.length; i++) {
      if (optimizedPlan[i].fixed) continue;  // 固定点はスキップ

      const currentLevel = waveform[i].level;
      const targetLevel = optimizedPlan[i].targetLevel;
      const movementRequired = targetLevel - currentLevel;

      // 移動量が下方向の制限を超える場合
      if (movementRequired < -maxDown) {
        // 計画線を上げて下方向移動を制限内に収める
        optimizedPlan[i].targetLevel = currentLevel - maxDown;
      }
      // 移動量が上方向の制限を超える場合
      else if (movementRequired > maxUp) {
        // 計画線を下げて上方向移動を制限内に収める
        optimizedPlan[i].targetLevel = currentLevel + maxUp;
      }
      // こう上優先: 可能な限り上方向への修正を選択
      else if (movementRequired < 0 && Math.abs(movementRequired) > maxDown * 0.5) {
        // 下方向移動が大きい場合、計画線を少し上げる
        optimizedPlan[i].targetLevel = currentLevel - maxDown * 0.5;
      }
    }

    return optimizedPlan;
  }

  /**
   * 移動量制限の適用
   */
  static applyMovementLimits(planLine, waveform, movementLimits) {
    const limitedPlan = [...planLine];

    movementLimits.forEach(limit => {
      for (let i = 0; i < waveform.length; i++) {
        const position = waveform[i].position;

        // 制限区間内かチェック
        if (position >= limit.start && position <= limit.end) {
          const currentLevel = waveform[i].level;
          const targetLevel = limitedPlan[i].targetLevel;
          const movement = Math.abs(targetLevel - currentLevel);

          // 制限を超える場合は調整
          if (movement > limit.maxMovement) {
            const sign = targetLevel > currentLevel ? 1 : -1;
            limitedPlan[i].targetLevel = currentLevel + sign * limit.maxMovement;
            limitedPlan[i].limited = true;
          }
        }
      }
    });

    return limitedPlan;
  }

  /**
   * 計画線の平滑化
   * 急激な変化を避けるための移動平均
   */
  static smoothPlanLine(planLine, windowSize = 5) {
    const smoothed = [...planLine];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = halfWindow; i < planLine.length - halfWindow; i++) {
      if (planLine[i].fixed) continue;  // 固定点は平滑化しない

      let sum = 0;
      let count = 0;

      for (let j = -halfWindow; j <= halfWindow; j++) {
        sum += planLine[i + j].targetLevel;
        count++;
      }

      smoothed[i].targetLevel = sum / count;
    }

    return smoothed;
  }

  /**
   * 移動量の計算
   */
  static calculateMovementAmounts(waveform, planLine) {
    return waveform.map((w, i) => ({
      position: w.position,
      currentLevel: w.level,
      targetLevel: planLine[i].targetLevel,
      movementAmount: planLine[i].targetLevel - w.level,
      direction: planLine[i].targetLevel - w.level > 0 ? 'up' : 'down',
      limited: planLine[i].limited || false,
      fixed: planLine[i].fixed || false
    }));
  }

  /**
   * 統計情報の計算
   */
  static calculateStatistics(movementAmounts) {
    const upwardMovements = movementAmounts.filter(m => m.direction === 'up');
    const downwardMovements = movementAmounts.filter(m => m.direction === 'down');

    const stats = {
      totalPoints: movementAmounts.length,
      upwardPoints: upwardMovements.length,
      downwardPoints: downwardMovements.length,
      averageUpward: 0,
      averageDownward: 0,
      maxUpward: 0,
      maxDownward: 0,
      totalUpwardVolume: 0,
      totalDownwardVolume: 0,
      limitedPoints: movementAmounts.filter(m => m.limited).length,
      fixedPoints: movementAmounts.filter(m => m.fixed).length
    };

    if (upwardMovements.length > 0) {
      const upAmounts = upwardMovements.map(m => Math.abs(m.movementAmount));
      stats.averageUpward = upAmounts.reduce((a, b) => a + b, 0) / upAmounts.length;
      stats.maxUpward = Math.max(...upAmounts);
      stats.totalUpwardVolume = upAmounts.reduce((a, b) => a + b, 0);
    }

    if (downwardMovements.length > 0) {
      const downAmounts = downwardMovements.map(m => Math.abs(m.movementAmount));
      stats.averageDownward = downAmounts.reduce((a, b) => a + b, 0) / downAmounts.length;
      stats.maxDownward = Math.max(...downAmounts);
      stats.totalDownwardVolume = downAmounts.reduce((a, b) => a + b, 0);
    }

    // こう上率の計算（上方向移動の割合）
    stats.upwardRatio = (stats.upwardPoints / stats.totalPoints) * 100;

    console.log('統計情報:');
    console.log(`  総点数: ${stats.totalPoints}`);
    console.log(`  上方向移動: ${stats.upwardPoints}点 (${stats.upwardRatio.toFixed(1)}%)`);
    console.log(`  下方向移動: ${stats.downwardPoints}点`);
    console.log(`  平均上方向移動量: ${stats.averageUpward.toFixed(2)}mm`);
    console.log(`  平均下方向移動量: ${stats.averageDownward.toFixed(2)}mm`);
    console.log(`  総上方向土量: ${stats.totalUpwardVolume.toFixed(2)}mm`);
    console.log(`  総下方向土量: ${stats.totalDownwardVolume.toFixed(2)}mm`);

    return stats;
  }
}

module.exports = ConvexPlanLine;