/**
 * 計画線修正・微調整モジュール
 * 計画線の細かい調整と最適化
 *
 * 機能:
 * - スプライン補間による平滑化
 * - 局所的な平滑化
 * - 異常値の除去
 * - 制約条件に基づく自動修正
 */

class PlanLineRefinement {
  constructor(samplingInterval = 0.25) {
    this.samplingInterval = samplingInterval; // サンプリング間隔（m）

    // 修正パラメータ
    this.parameters = {
      smoothingFactor: 0.5,     // 平滑化係数（0.0 ～ 1.0）
      outlierThreshold: 3.0,    // 異常値判定閾値（σの倍数）
      maxIteration: 10,         // 最大反復回数
      convergenceThreshold: 0.01 // 収束判定閾値
    };
  }

  /**
   * 3次スプライン補間
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number[]} controlDistances - 制御点の距離配列
   * @returns {MeasurementData[]} 補間後の計画線
   */
  cubicSplineInterpolation(planLine, controlDistances) {
    // 制御点の値を取得
    const controlPoints = [];
    for (const distance of controlDistances) {
      let closestIdx = 0;
      let minDist = Infinity;

      for (let i = 0; i < planLine.length; i++) {
        const d = Math.abs(planLine[i].distance - distance);
        if (d < minDist) {
          minDist = d;
          closestIdx = i;
        }
      }

      controlPoints.push({
        distance: planLine[closestIdx].distance,
        value: planLine[closestIdx].value
      });
    }

    // スプライン係数を計算
    const n = controlPoints.length;
    const h = new Array(n - 1);
    const alpha = new Array(n - 1);

    for (let i = 0; i < n - 1; i++) {
      h[i] = controlPoints[i + 1].distance - controlPoints[i].distance;
    }

    for (let i = 1; i < n - 1; i++) {
      alpha[i] =
        (3 / h[i]) * (controlPoints[i + 1].value - controlPoints[i].value) -
        (3 / h[i - 1]) * (controlPoints[i].value - controlPoints[i - 1].value);
    }

    // 三重対角行列を解く（簡易実装）
    const c = new Array(n).fill(0);
    const l = new Array(n).fill(1);
    const mu = new Array(n).fill(0);
    const z = new Array(n).fill(0);

    for (let i = 1; i < n - 1; i++) {
      l[i] = 2 * (controlPoints[i + 1].distance - controlPoints[i - 1].distance) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    for (let j = n - 2; j >= 0; j--) {
      c[j] = z[j] - mu[j] * c[j + 1];
    }

    // 新しい計画線を生成
    const result = [];

    for (let i = 0; i < planLine.length; i++) {
      const distance = planLine[i].distance;

      // 制御点区間を検索
      let segmentIdx = 0;
      for (let j = 0; j < n - 1; j++) {
        if (distance >= controlPoints[j].distance && distance <= controlPoints[j + 1].distance) {
          segmentIdx = j;
          break;
        }
      }

      // スプライン補間
      const x = distance - controlPoints[segmentIdx].distance;
      const a = controlPoints[segmentIdx].value;
      const b = (controlPoints[segmentIdx + 1].value - controlPoints[segmentIdx].value) / h[segmentIdx] -
                (h[segmentIdx] * (c[segmentIdx + 1] + 2 * c[segmentIdx])) / 3;
      const d = (c[segmentIdx + 1] - c[segmentIdx]) / (3 * h[segmentIdx]);

      const value = a + b * x + c[segmentIdx] * x * x + d * x * x * x;

      result.push({
        distance,
        value: parseFloat(value.toFixed(3))
      });
    }

    return result;
  }

  /**
   * ガウシアンフィルタによる平滑化
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} sigma - ガウシアンのσ（点数単位）
   * @returns {MeasurementData[]} 平滑化後の計画線
   */
  gaussianSmoothing(planLine, sigma = 5.0) {
    const windowSize = Math.ceil(sigma * 3) * 2 + 1;
    const halfWindow = Math.floor(windowSize / 2);

    // ガウシアンカーネルを生成
    const kernel = new Array(windowSize);
    let kernelSum = 0;

    for (let i = 0; i < windowSize; i++) {
      const x = i - halfWindow;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      kernelSum += kernel[i];
    }

    // 正規化
    for (let i = 0; i < windowSize; i++) {
      kernel[i] /= kernelSum;
    }

    // 畳み込み
    const result = [];

    for (let i = 0; i < planLine.length; i++) {
      let sum = 0;
      let weightSum = 0;

      for (let j = 0; j < windowSize; j++) {
        const idx = i - halfWindow + j;

        if (idx >= 0 && idx < planLine.length) {
          sum += planLine[idx].value * kernel[j];
          weightSum += kernel[j];
        }
      }

      result.push({
        distance: planLine[i].distance,
        value: parseFloat((sum / weightSum).toFixed(3))
      });
    }

    return result;
  }

  /**
   * 異常値を検出して除去
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} threshold - 異常値判定閾値（σの倍数）
   * @returns {{cleaned: MeasurementData[], outliers: number[]}} 除去後の計画線と異常値インデックス
   */
  removeOutliers(planLine, threshold = null) {
    const th = threshold || this.parameters.outlierThreshold;

    // 平均と標準偏差を計算
    let sum = 0;
    let sumSquare = 0;

    for (const point of planLine) {
      sum += point.value;
      sumSquare += point.value * point.value;
    }

    const mean = sum / planLine.length;
    const variance = sumSquare / planLine.length - mean * mean;
    const sigma = Math.sqrt(Math.max(0, variance));

    // 異常値を検出
    const outliers = [];
    const cleaned = [];

    for (let i = 0; i < planLine.length; i++) {
      const deviation = Math.abs(planLine[i].value - mean);

      if (deviation > th * sigma) {
        outliers.push(i);
        // 異常値は平均値で置き換え
        cleaned.push({
          distance: planLine[i].distance,
          value: parseFloat(mean.toFixed(3))
        });
      } else {
        cleaned.push({ ...planLine[i] });
      }
    }

    return { cleaned, outliers };
  }

  /**
   * 局所的な平滑化（移動平均）
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} startDistance - 開始距離（m）
   * @param {number} endDistance - 終了距離（m）
   * @param {number} windowSize - 窓サイズ（点数）
   * @returns {MeasurementData[]} 平滑化後の計画線
   */
  localSmoothing(planLine, startDistance, endDistance, windowSize = 20) {
    const result = [...planLine];

    // 区間のインデックスを検索
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < result.length; i++) {
      if (result[i].distance >= startDistance && startIdx === -1) {
        startIdx = i;
      }
      if (result[i].distance >= endDistance) {
        endIdx = i;
        break;
      }
    }

    if (startIdx === -1 || endIdx === -1) {
      throw new Error('Invalid distance range');
    }

    const halfWindow = Math.floor(windowSize / 2);

    for (let i = startIdx; i <= endIdx; i++) {
      let sum = 0;
      let count = 0;

      const winStart = Math.max(0, i - halfWindow);
      const winEnd = Math.min(planLine.length - 1, i + halfWindow);

      for (let j = winStart; j <= winEnd; j++) {
        sum += planLine[j].value;
        count++;
      }

      result[i].value = parseFloat((sum / count).toFixed(3));
    }

    return result;
  }

  /**
   * 反復平滑化
   * @param {MeasurementData[]} planLine - 計画線
   * @param {number} iterations - 反復回数
   * @param {number} smoothingFactor - 平滑化係数（0.0 ～ 1.0）
   * @returns {MeasurementData[]} 平滑化後の計画線
   */
  iterativeSmoothing(planLine, iterations = null, smoothingFactor = null) {
    const maxIter = iterations || this.parameters.maxIteration;
    const factor = smoothingFactor !== null ? smoothingFactor : this.parameters.smoothingFactor;

    let result = [...planLine];

    for (let iter = 0; iter < maxIter; iter++) {
      const previous = [...result];

      // 各点を前後の平均で更新
      for (let i = 1; i < result.length - 1; i++) {
        const avg = (previous[i - 1].value + previous[i + 1].value) / 2;
        result[i].value = parseFloat((previous[i].value * (1 - factor) + avg * factor).toFixed(3));
      }

      // 収束判定
      let maxChange = 0;
      for (let i = 0; i < result.length; i++) {
        const change = Math.abs(result[i].value - previous[i].value);
        if (change > maxChange) {
          maxChange = change;
        }
      }

      if (maxChange < this.parameters.convergenceThreshold) {
        break;
      }
    }

    return result;
  }

  /**
   * 二値化マスクを適用した選択的平滑化
   * @param {MeasurementData[]} planLine - 計画線
   * @param {boolean[]} mask - マスク配列（true: 平滑化する、false: 保持）
   * @param {number} windowSize - 窓サイズ（点数）
   * @returns {MeasurementData[]} 平滑化後の計画線
   */
  selectiveSmoothing(planLine, mask, windowSize = 20) {
    if (mask.length !== planLine.length) {
      throw new Error('Mask length must match plan line length');
    }

    const result = [...planLine];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < result.length; i++) {
      if (!mask[i]) {
        continue; // マスクがfalseの場合はスキップ
      }

      let sum = 0;
      let count = 0;

      const winStart = Math.max(0, i - halfWindow);
      const winEnd = Math.min(planLine.length - 1, i + halfWindow);

      for (let j = winStart; j <= winEnd; j++) {
        sum += planLine[j].value;
        count++;
      }

      result[i].value = parseFloat((sum / count).toFixed(3));
    }

    return result;
  }

  /**
   * パラメータを設定
   * @param {Object} params - パラメータ
   */
  setParameters(params) {
    this.parameters = { ...this.parameters, ...params };
  }

  /**
   * パラメータを取得
   * @returns {Object} パラメータ
   */
  getParameters() {
    return { ...this.parameters };
  }

  /**
   * RMS誤差を計算
   * @param {MeasurementData[]} original - 元の計画線
   * @param {MeasurementData[]} refined - 修正後の計画線
   * @returns {number} RMS誤差
   */
  calculateRMSError(original, refined) {
    if (original.length !== refined.length) {
      throw new Error('Plan line lengths must match');
    }

    let sumSquare = 0;

    for (let i = 0; i < original.length; i++) {
      const diff = original[i].value - refined[i].value;
      sumSquare += diff * diff;
    }

    return Math.sqrt(sumSquare / original.length);
  }
}

module.exports = { PlanLineRefinement };
