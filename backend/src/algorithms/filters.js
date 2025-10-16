/**
 * 各種フィルタアルゴリズムの実装
 * VBシステムのフィルタ処理を現代的な手法で再実装
 */

import { FILTER_PARAMS } from '../utils/constants.js';

/**
 * 移動平均フィルタを適用
 * @param {Array} data - 軌道データ配列 [{distance, irregularity}, ...]
 * @param {number} windowSize - ウィンドウサイズ（3, 5, 7, 9等）
 * @returns {Array} フィルタ適用後のデータ
 */
export function applyMovingAverageFilter(data, windowSize = 3) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  if (windowSize < 3 || windowSize % 2 === 0) {
    throw new Error('ウィンドウサイズは3以上の奇数である必要があります');
  }

  const halfWindow = Math.floor(windowSize / 2);
  const filtered = [];

  for (let i = 0; i < data.length; i++) {
    if (i < halfWindow || i >= data.length - halfWindow) {
      // 境界点はそのまま
      filtered.push({ ...data[i] });
    } else {
      // ウィンドウ内の平均を計算
      let sum = 0;
      for (let j = i - halfWindow; j <= i + halfWindow; j++) {
        sum += data[j].irregularity;
      }
      const avg = sum / windowSize;

      filtered.push({
        distance: data[i].distance,
        irregularity: parseFloat(avg.toFixed(3))
      });
    }
  }

  return filtered;
}

/**
 * 重み付き移動平均フィルタを適用
 * @param {Array} data - 軌道データ配列
 * @param {Array} weights - 重み配列（例: [1, 2, 3, 2, 1]）
 * @returns {Array} フィルタ適用後のデータ
 */
export function applyWeightedMovingAverage(data, weights = FILTER_PARAMS.weighted.weights5) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  if (weights.length % 2 === 0) {
    throw new Error('重み配列の長さは奇数である必要があります');
  }

  const halfWindow = Math.floor(weights.length / 2);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const filtered = [];

  for (let i = 0; i < data.length; i++) {
    if (i < halfWindow || i >= data.length - halfWindow) {
      // 境界点はそのまま
      filtered.push({ ...data[i] });
    } else {
      // 重み付き平均を計算
      let sum = 0;
      for (let j = 0; j < weights.length; j++) {
        const dataIndex = i - halfWindow + j;
        sum += data[dataIndex].irregularity * weights[j];
      }
      const weightedAvg = sum / weightSum;

      filtered.push({
        distance: data[i].distance,
        irregularity: parseFloat(weightedAvg.toFixed(3))
      });
    }
  }

  return filtered;
}

/**
 * ローパスフィルタ（単純実装）
 * 高周波成分を除去
 * @param {Array} data - 軌道データ配列
 * @param {number} alpha - 平滑化係数 (0-1、小さいほど強い平滑化)
 * @returns {Array} フィルタ適用後のデータ
 */
export function applyLowPassFilter(data, alpha = 0.3) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  if (alpha <= 0 || alpha > 1) {
    throw new Error('alpha は 0 < alpha <= 1 の範囲である必要があります');
  }

  const filtered = [];
  let filteredValue = data[0].irregularity; // 初期値

  for (let i = 0; i < data.length; i++) {
    filteredValue = alpha * data[i].irregularity + (1 - alpha) * filteredValue;
    filtered.push({
      distance: data[i].distance,
      irregularity: parseFloat(filteredValue.toFixed(3))
    });
  }

  return filtered;
}

/**
 * ハイパスフィルタ（単純実装）
 * 低周波成分（トレンド）を除去
 * @param {Array} data - 軌道データ配列
 * @param {number} windowSize - ウィンドウサイズ
 * @returns {Array} フィルタ適用後のデータ
 */
export function applyHighPassFilter(data, windowSize = 21) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  // まず移動平均を計算（低周波成分）
  const lowFreq = applyMovingAverageFilter(data, windowSize);

  // 元データから低周波成分を引く（高周波成分のみ残る）
  const filtered = data.map((point, i) => ({
    distance: point.distance,
    irregularity: parseFloat((point.irregularity - lowFreq[i].irregularity).toFixed(3))
  }));

  return filtered;
}

/**
 * メディアンフィルタを適用
 * ノイズやスパイクの除去に有効
 * @param {Array} data - 軌道データ配列
 * @param {number} windowSize - ウィンドウサイズ（奇数）
 * @returns {Array} フィルタ適用後のデータ
 */
export function applyMedianFilter(data, windowSize = 5) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  if (windowSize < 3 || windowSize % 2 === 0) {
    throw new Error('ウィンドウサイズは3以上の奇数である必要があります');
  }

  const halfWindow = Math.floor(windowSize / 2);
  const filtered = [];

  for (let i = 0; i < data.length; i++) {
    if (i < halfWindow || i >= data.length - halfWindow) {
      // 境界点はそのまま
      filtered.push({ ...data[i] });
    } else {
      // ウィンドウ内の中央値を計算
      const windowValues = [];
      for (let j = i - halfWindow; j <= i + halfWindow; j++) {
        windowValues.push(data[j].irregularity);
      }
      windowValues.sort((a, b) => a - b);
      const median = windowValues[halfWindow];

      filtered.push({
        distance: data[i].distance,
        irregularity: parseFloat(median.toFixed(3))
      });
    }
  }

  return filtered;
}

/**
 * サビツキー-ゴレイフィルタ（2次多項式、ウィンドウサイズ5の簡易実装）
 * 滑らかな曲線フィッティング
 * @param {Array} data - 軌道データ配列
 * @returns {Array} フィルタ適用後のデータ
 */
export function applySavitzkyGolayFilter(data) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  // 5点、2次多項式のサビツキー-ゴレイ係数
  const coefficients = [-3, 12, 17, 12, -3];
  const norm = 35;
  const halfWindow = 2;
  const filtered = [];

  for (let i = 0; i < data.length; i++) {
    if (i < halfWindow || i >= data.length - halfWindow) {
      // 境界点はそのまま
      filtered.push({ ...data[i] });
    } else {
      // サビツキー-ゴレイフィルタを適用
      let sum = 0;
      for (let j = 0; j < coefficients.length; j++) {
        const dataIndex = i - halfWindow + j;
        sum += data[dataIndex].irregularity * coefficients[j];
      }
      const smoothed = sum / norm;

      filtered.push({
        distance: data[i].distance,
        irregularity: parseFloat(smoothed.toFixed(3))
      });
    }
  }

  return filtered;
}

/**
 * ガウシアンフィルタを適用
 * @param {Array} data - 軌道データ配列
 * @param {number} sigma - ガウス分布の標準偏差
 * @param {number} windowSize - ウィンドウサイズ（奇数）
 * @returns {Array} フィルタ適用後のデータ
 */
export function applyGaussianFilter(data, sigma = 1.0, windowSize = 5) {
  if (!data || data.length === 0) {
    throw new Error('データが空です');
  }

  if (windowSize % 2 === 0) {
    throw new Error('ウィンドウサイズは奇数である必要があります');
  }

  // ガウス分布の重みを計算
  const halfWindow = Math.floor(windowSize / 2);
  const weights = [];
  let weightSum = 0;

  for (let i = -halfWindow; i <= halfWindow; i++) {
    const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
    weights.push(weight);
    weightSum += weight;
  }

  // 正規化
  const normalizedWeights = weights.map(w => w / weightSum);

  // フィルタ適用
  const filtered = [];

  for (let i = 0; i < data.length; i++) {
    if (i < halfWindow || i >= data.length - halfWindow) {
      // 境界点はそのまま
      filtered.push({ ...data[i] });
    } else {
      // ガウス重み付き平均を計算
      let sum = 0;
      for (let j = 0; j < normalizedWeights.length; j++) {
        const dataIndex = i - halfWindow + j;
        sum += data[dataIndex].irregularity * normalizedWeights[j];
      }

      filtered.push({
        distance: data[i].distance,
        irregularity: parseFloat(sum.toFixed(3))
      });
    }
  }

  return filtered;
}

/**
 * フィルタタイプに応じて適切なフィルタを適用
 * @param {Array} data - 軌道データ配列
 * @param {string} filterType - フィルタタイプ
 * @param {Object} options - フィルタオプション
 * @returns {Object} フィルタ適用結果
 */
export function applyFilter(data, filterType, options = {}) {
  let filtered;
  let description;

  try {
    switch (filterType) {
      case 'moving_average_3':
        filtered = applyMovingAverageFilter(data, 3);
        description = '3点移動平均フィルタ';
        break;

      case 'moving_average_5':
        filtered = applyMovingAverageFilter(data, 5);
        description = '5点移動平均フィルタ';
        break;

      case 'moving_average_7':
        filtered = applyMovingAverageFilter(data, 7);
        description = '7点移動平均フィルタ';
        break;

      case 'moving_average_9':
        filtered = applyMovingAverageFilter(data, 9);
        description = '9点移動平均フィルタ';
        break;

      case 'weighted_average':
        const weights = options.weights || FILTER_PARAMS.weighted.weights5;
        filtered = applyWeightedMovingAverage(data, weights);
        description = `重み付き移動平均フィルタ（${weights.length}点）`;
        break;

      case 'low_pass':
        const alpha = options.alpha || 0.3;
        filtered = applyLowPassFilter(data, alpha);
        description = `ローパスフィルタ (α=${alpha})`;
        break;

      case 'high_pass':
        const windowSize = options.windowSize || 21;
        filtered = applyHighPassFilter(data, windowSize);
        description = `ハイパスフィルタ (window=${windowSize})`;
        break;

      case 'median':
        const medianWindow = options.windowSize || 5;
        filtered = applyMedianFilter(data, medianWindow);
        description = `メディアンフィルタ（${medianWindow}点）`;
        break;

      case 'savitzky_golay':
        filtered = applySavitzkyGolayFilter(data);
        description = 'サビツキー-ゴレイフィルタ（5点、2次）';
        break;

      case 'gaussian':
        const sigma = options.sigma || 1.0;
        const gaussWindow = options.windowSize || 5;
        filtered = applyGaussianFilter(data, sigma, gaussWindow);
        description = `ガウシアンフィルタ (σ=${sigma}, window=${gaussWindow})`;
        break;

      default:
        // デフォルトは3点移動平均
        filtered = applyMovingAverageFilter(data, 3);
        description = '3点移動平均フィルタ（デフォルト）';
    }

    return {
      success: true,
      data: filtered,
      filterType,
      description,
      dataPoints: filtered.length
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      filterType,
      dataPoints: 0
    };
  }
}
