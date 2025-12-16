/**
 * 移動量補正オプション
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」P8-11に基づく
 * 移動量の補正設定：無、有、M の3種類
 */

class MovementCorrectionOptions {
  constructor(options = {}) {
    this.mttType = options.mttType || '08-475';
    this.correctionMode = options.correctionMode || 'none'; // none, standard, mtt
  }

  /**
   * 移動量補正を適用
   * @param {Array} movementData - 移動量データ
   * @param {Array} restoredWaveform - 復元波形データ
   * @param {Array} planLine - 計画線データ
   * @param {string} correctionMode - 補正モード（none/standard/mtt）
   * @returns {Array} 補正済み移動量データ
   */
  applyCorrection(movementData, restoredWaveform, planLine, correctionMode) {
    switch (correctionMode) {
      case 'none':
        // 無: こう上量のみ（復元波形と計画線との差）
        return this.applyCorrectionNone(movementData, restoredWaveform, planLine);

      case 'standard':
        // 有: こう上量 + 計画線の歪みに対する補正量
        return this.applyCorrectionStandard(movementData, restoredWaveform, planLine);

      case 'mtt':
        // M: こう上量 + 整備後予測波形の偏心矢の約3倍
        return this.applyCorrectionMTT(movementData, restoredWaveform, planLine);

      default:
        throw new Error(`Unknown correction mode: ${correctionMode}`);
    }
  }

  /**
   * 補正なし（無）
   * こう上量のみを移動量とする
   */
  applyCorrectionNone(movementData, restoredWaveform, planLine) {
    return movementData.map((point, index) => {
      const restored = restoredWaveform[index] || { value: 0 };
      const plan = planLine[index] || { value: 0 };

      // こう上量 = 計画線 - 復元波形
      const liftingAmount = plan.value - restored.value;

      return {
        ...point,
        correctionMode: 'none',
        lateralMovement: liftingAmount,
        verticalMovement: liftingAmount,
        correctionAmount: 0,
        description: 'こう上量のみ'
      };
    });
  }

  /**
   * 標準補正（有）
   * こう上量 + 計画線の歪みに対する補正量
   */
  applyCorrectionStandard(movementData, restoredWaveform, planLine) {
    // 計画線の歪み（曲率変化）を計算
    const planCurvature = this.calculateCurvature(planLine);

    return movementData.map((point, index) => {
      const restored = restoredWaveform[index] || { value: 0 };
      const plan = planLine[index] || { value: 0 };
      const curvature = planCurvature[index] || 0;

      // こう上量
      const liftingAmount = plan.value - restored.value;

      // 計画線の歪みに対する補正量
      // 曲率変化が大きい箇所に追加補正を加える
      const correctionAmount = this.calculateStandardCorrection(curvature);

      return {
        ...point,
        correctionMode: 'standard',
        lateralMovement: point.lateralMovement + correctionAmount,
        verticalMovement: liftingAmount + correctionAmount,
        correctionAmount: correctionAmount,
        curvature: curvature,
        description: 'こう上量 + 歪み補正'
      };
    });
  }

  /**
   * MTT補正（M）
   * こう上量 + 整備後予測波形の偏心矢の約3倍
   */
  applyCorrectionMTT(movementData, restoredWaveform, planLine) {
    // MTT機械特性パラメータ
    const mttParams = this.getMTTParameters(this.mttType);

    // 整備後予測波形を計算
    const predictedWaveform = this.calculatePredictedWaveform(
      restoredWaveform,
      planLine,
      movementData
    );

    // 偏心矢を計算
    const eccentricityData = this.calculateEccentricity(
      predictedWaveform,
      mttParams
    );

    return movementData.map((point, index) => {
      const restored = restoredWaveform[index] || { value: 0 };
      const plan = planLine[index] || { value: 0 };
      const eccentricity = eccentricityData[index] || 0;

      // こう上量
      const liftingAmount = plan.value - restored.value;

      // MTT偏心矢の約3倍を補正量とする
      const correctionAmount = eccentricity * 3;

      return {
        ...point,
        correctionMode: 'mtt',
        lateralMovement: point.lateralMovement + correctionAmount,
        verticalMovement: liftingAmount + correctionAmount,
        correctionAmount: correctionAmount,
        eccentricity: eccentricity,
        mttType: this.mttType,
        description: 'こう上量 + MTT偏心矢×3'
      };
    });
  }

  /**
   * 曲率を計算
   * @param {Array} data - データ配列
   * @returns {Array} 曲率配列
   */
  calculateCurvature(data) {
    const curvature = [];

    for (let i = 1; i < data.length - 1; i++) {
      const prev = data[i - 1].value;
      const curr = data[i].value;
      const next = data[i + 1].value;

      // 2階差分（曲率の近似）
      const secondDerivative = prev - 2 * curr + next;

      // 曲率 = |d²y/dx²| / (1 + (dy/dx)²)^(3/2)
      // 簡略化のため、2階差分の絶対値を使用
      curvature.push(Math.abs(secondDerivative));
    }

    // 端点は0とする
    curvature.unshift(0);
    curvature.push(0);

    return curvature;
  }

  /**
   * 標準補正量を計算
   * @param {number} curvature - 曲率
   * @returns {number} 補正量
   */
  calculateStandardCorrection(curvature) {
    // 曲率に応じた補正係数
    // 曲率が大きいほど補正量を増やす
    const correctionFactor = 0.5;

    // 補正量 = 曲率 × 係数
    // 最大10mmに制限
    return Math.min(curvature * correctionFactor, 10);
  }

  /**
   * 整備後予測波形を計算
   * @param {Array} restoredWaveform - 復元波形
   * @param {Array} planLine - 計画線
   * @param {Array} movementData - 移動量データ
   * @returns {Array} 予測波形
   */
  calculatePredictedWaveform(restoredWaveform, planLine, movementData) {
    const predicted = [];

    for (let i = 0; i < restoredWaveform.length; i++) {
      const restored = restoredWaveform[i] || { value: 0 };
      const plan = planLine[i] || { value: 0 };
      const movement = movementData[i] || { lateralMovement: 0, verticalMovement: 0 };

      // 予測波形 = 現況波形 + 移動量
      // ただし、6m未満の成分は除外（MTT機械特性）
      const predictedValue = restored.value + movement.verticalMovement;

      predicted.push({
        position: restored.position || i * 0.25,
        value: predictedValue
      });
    }

    // 6m未満の短波長成分を除去
    return this.removeShortWavelength(predicted, 6);
  }

  /**
   * 偏心矢を計算
   * @param {Array} waveform - 波形データ
   * @param {Object} mttParams - MTTパラメータ
   * @returns {Array} 偏心矢配列
   */
  calculateEccentricity(waveform, mttParams) {
    const eccentricity = [];
    const bcDistance = mttParams.bcDistance; // BC間距離
    const cdDistance = mttParams.cdDistance; // CD間距離

    // BC間距離とCD間距離に相当するインデックス
    const bcIndex = Math.round(bcDistance / 0.25);
    const cdIndex = Math.round(cdDistance / 0.25);

    for (let i = 0; i < waveform.length; i++) {
      if (i < bcIndex + cdIndex) {
        eccentricity.push(0);
        continue;
      }

      const b = waveform[i - bcIndex - cdIndex] || { value: 0 };
      const c = waveform[i - cdIndex] || { value: 0 };
      const d = waveform[i] || { value: 0 };

      // 偏心矢 = D - (B + C) / 2
      // MTTの測定原理に基づく計算
      const ecc = d.value - (b.value + c.value) / 2;

      eccentricity.push(ecc);
    }

    return eccentricity;
  }

  /**
   * 短波長成分を除去
   * @param {Array} data - データ配列
   * @param {number} minWavelength - 最小波長 (m)
   * @returns {Array} フィルタリング済みデータ
   */
  removeShortWavelength(data, minWavelength) {
    // 移動平均によるローパスフィルタ
    const windowSize = Math.round(minWavelength / 0.25);
    const filtered = [];

    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = -windowSize/2; j <= windowSize/2; j++) {
        const index = i + j;
        if (index >= 0 && index < data.length) {
          sum += data[index].value;
          count++;
        }
      }

      filtered.push({
        ...data[i],
        value: count > 0 ? sum / count : data[i].value
      });
    }

    return filtered;
  }

  /**
   * MTTパラメータを取得
   * @param {string} mttType - MTT機種
   * @returns {Object} パラメータ
   */
  getMTTParameters(mttType) {
    const params = {
      '08-475': {
        bcDistance: 3.63,  // BC間距離
        cdDistance: 9.37,  // CD間距離
        liftingPoints: 3,
        liningPoints: 2,
        eccFactor: 3       // 偏心矢の倍率
      },
      '08-275': {
        bcDistance: 3.2,
        cdDistance: 8.5,
        liftingPoints: 3,
        liningPoints: 2,
        eccFactor: 3
      },
      '09-16': {
        bcDistance: 7.5,
        cdDistance: 7.5,
        liftingPoints: 4,
        liningPoints: 2,
        eccFactor: 3
      },
      '09-32': {
        bcDistance: 8.0,
        cdDistance: 8.0,
        liftingPoints: 4,
        liningPoints: 3,
        eccFactor: 3
      },
      'MTT-15': {
        bcDistance: 10.0,
        cdDistance: 10.0,
        liftingPoints: 4,
        liningPoints: 3,
        eccFactor: 2.5
      }
    };

    return params[mttType] || params['08-475'];
  }

  /**
   * 補正モードの説明を取得
   * @param {string} mode - 補正モード
   * @returns {Object} 説明情報
   */
  getCorrectionModeDescription(mode) {
    const descriptions = {
      'none': {
        label: '無',
        shortDesc: 'こう上量のみ',
        longDesc: '復元波形と計画線との差分（こう上量）をそのまま移動量とします。',
        formula: '移動量 = 計画線 - 復元波形',
        useCase: '通常の軌道整正作業'
      },
      'standard': {
        label: '有',
        shortDesc: 'こう上量 + 歪み補正',
        longDesc: 'こう上量に加えて、計画線の歪み（曲率変化）に対する補正量を追加します。',
        formula: '移動量 = (計画線 - 復元波形) + 歪み補正量',
        useCase: '曲線区間や変化の大きい箇所での作業'
      },
      'mtt': {
        label: 'M',
        shortDesc: 'こう上量 + MTT偏心矢×3',
        longDesc: 'こう上量に加えて、整備後予測波形の偏心矢の約3倍を補正量として追加します。',
        formula: '移動量 = (計画線 - 復元波形) + (偏心矢 × 3)',
        useCase: 'MTT機械特性を考慮した精密な作業'
      }
    };

    return descriptions[mode] || descriptions['none'];
  }

  /**
   * 補正結果の統計を計算
   * @param {Array} correctedData - 補正済みデータ
   * @returns {Object} 統計情報
   */
  calculateStatistics(correctedData) {
    const stats = {
      mode: correctedData[0]?.correctionMode || 'none',
      totalPoints: correctedData.length,
      maxCorrection: 0,
      minCorrection: Infinity,
      avgCorrection: 0,
      maxMovement: 0,
      minMovement: Infinity,
      avgMovement: 0
    };

    let correctionSum = 0;
    let movementSum = 0;

    correctedData.forEach(point => {
      const correction = Math.abs(point.correctionAmount || 0);
      const movement = Math.abs(point.verticalMovement || 0);

      stats.maxCorrection = Math.max(stats.maxCorrection, correction);
      stats.minCorrection = Math.min(stats.minCorrection, correction);
      correctionSum += correction;

      stats.maxMovement = Math.max(stats.maxMovement, movement);
      stats.minMovement = Math.min(stats.minMovement, movement);
      movementSum += movement;
    });

    stats.avgCorrection = correctionSum / stats.totalPoints;
    stats.avgMovement = movementSum / stats.totalPoints;

    return stats;
  }
}

module.exports = MovementCorrectionOptions;