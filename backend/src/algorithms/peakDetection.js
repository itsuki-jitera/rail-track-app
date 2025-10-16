/**
 * ピーク検出アルゴリズムの実装
 * VBシステムのHPP系サブルーチンを再実装
 */

import { PEAK_DETECTION_PARAMS } from '../utils/constants.js';

/**
 * 基本統計量を計算
 * @param {Array} values - 数値配列
 * @returns {Object} 統計量
 */
function calculateBasicStats(values) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0, stdDev: 0 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, avg, stdDev };
}

/**
 * 局所最大値（ピーク）を検出
 * @param {Array} data - 軌道データ配列
 * @param {Object} options - 検出オプション
 * @returns {Array} ピーク配列
 */
export function detectMaxima(data, options = {}) {
  if (!data || data.length < 3) {
    return [];
  }

  const minHeight = options.minHeight || PEAK_DETECTION_PARAMS.minPeakHeight;
  const minDistance = options.minDistance || PEAK_DETECTION_PARAMS.minPeakDistance;
  const threshold = options.threshold || PEAK_DETECTION_PARAMS.threshold;

  const values = data.map(d => d.irregularity);
  const stats = calculateBasicStats(values);
  const heightThreshold = stats.avg + stats.stdDev * threshold;

  const peaks = [];

  for (let i = 1; i < data.length - 1; i++) {
    const current = data[i].irregularity;
    const prev = data[i - 1].irregularity;
    const next = data[i + 1].irregularity;

    // 局所最大値判定
    if (current > prev && current > next && current >= minHeight && current >= heightThreshold) {
      peaks.push({
        index: i,
        distance: data[i].distance,
        value: parseFloat(current.toFixed(3)),
        type: 'maximum',
        prominence: parseFloat((current - Math.min(prev, next)).toFixed(3))
      });
    }
  }

  // 距離フィルタリング（近接ピークの除去）
  if (peaks.length > 0 && minDistance > 0) {
    const filtered = [peaks[0]];

    for (let i = 1; i < peaks.length; i++) {
      const lastPeak = filtered[filtered.length - 1];
      const currentPeak = peaks[i];

      if (currentPeak.distance - lastPeak.distance >= minDistance) {
        filtered.push(currentPeak);
      } else {
        // 近接している場合、より大きい方を採用
        if (currentPeak.value > lastPeak.value) {
          filtered[filtered.length - 1] = currentPeak;
        }
      }
    }

    return filtered;
  }

  return peaks;
}

/**
 * 局所最小値（谷）を検出
 * @param {Array} data - 軌道データ配列
 * @param {Object} options - 検出オプション
 * @returns {Array} 谷配列
 */
export function detectMinima(data, options = {}) {
  if (!data || data.length < 3) {
    return [];
  }

  const minDepth = options.minDepth || -PEAK_DETECTION_PARAMS.minPeakHeight;
  const minDistance = options.minDistance || PEAK_DETECTION_PARAMS.minPeakDistance;
  const threshold = options.threshold || PEAK_DETECTION_PARAMS.threshold;

  const values = data.map(d => d.irregularity);
  const stats = calculateBasicStats(values);
  const depthThreshold = stats.avg - stats.stdDev * threshold;

  const valleys = [];

  for (let i = 1; i < data.length - 1; i++) {
    const current = data[i].irregularity;
    const prev = data[i - 1].irregularity;
    const next = data[i + 1].irregularity;

    // 局所最小値判定
    if (current < prev && current < next && current <= depthThreshold) {
      valleys.push({
        index: i,
        distance: data[i].distance,
        value: parseFloat(current.toFixed(3)),
        type: 'minimum',
        prominence: parseFloat((Math.max(prev, next) - current).toFixed(3))
      });
    }
  }

  // 距離フィルタリング
  if (valleys.length > 0 && minDistance > 0) {
    const filtered = [valleys[0]];

    for (let i = 1; i < valleys.length; i++) {
      const lastValley = filtered[filtered.length - 1];
      const currentValley = valleys[i];

      if (currentValley.distance - lastValley.distance >= minDistance) {
        filtered.push(currentValley);
      } else {
        // 近接している場合、より小さい方を採用
        if (currentValley.value < lastValley.value) {
          filtered[filtered.length - 1] = currentValley;
        }
      }
    }

    return filtered;
  }

  return valleys;
}

/**
 * 両方向のピーク検出（最大値と最小値）
 * @param {Array} data - 軌道データ配列
 * @param {Object} options - 検出オプション
 * @returns {Object} ピーク検出結果
 */
export function detectPeaks(data, options = {}) {
  if (!data || data.length < 3) {
    return {
      success: false,
      error: 'データが不十分です（最低3点必要）',
      maxima: [],
      minima: [],
      totalPeaks: 0
    };
  }

  try {
    const maxima = options.detectMaxima !== false ? detectMaxima(data, options) : [];
    const minima = options.detectMinima !== false ? detectMinima(data, options) : [];

    // すべてのピークを距離順にソート
    const allPeaks = [...maxima, ...minima].sort((a, b) => a.distance - b.distance);

    return {
      success: true,
      maxima,
      minima,
      allPeaks,
      totalPeaks: allPeaks.length,
      maximaCount: maxima.length,
      minimaCount: minima.length
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      maxima: [],
      minima: [],
      totalPeaks: 0
    };
  }
}

/**
 * 異常値（outlier）を検出
 * @param {Array} data - 軌道データ配列
 * @param {number} sigmaMul - 標準偏差の倍数（デフォルト3）
 * @returns {Array} 異常値の配列
 */
export function detectOutliers(data, sigmaMul = 3.0) {
  if (!data || data.length === 0) {
    return [];
  }

  const values = data.map(d => d.irregularity);
  const stats = calculateBasicStats(values);
  const upperLimit = stats.avg + stats.stdDev * sigmaMul;
  const lowerLimit = stats.avg - stats.stdDev * sigmaMul;

  const outliers = [];

  data.forEach((point, i) => {
    if (point.irregularity > upperLimit || point.irregularity < lowerLimit) {
      outliers.push({
        index: i,
        distance: point.distance,
        value: point.irregularity,
        deviation: parseFloat((Math.abs(point.irregularity - stats.avg) / stats.stdDev).toFixed(2)),
        type: point.irregularity > upperLimit ? 'high' : 'low'
      });
    }
  });

  return outliers;
}

/**
 * ピーク間隔の分析
 * @param {Array} peaks - ピーク配列
 * @returns {Object} 間隔分析結果
 */
export function analyzePeakSpacing(peaks) {
  if (!peaks || peaks.length < 2) {
    return {
      success: false,
      message: 'ピークが不足しています（最低2つ必要）',
      intervals: []
    };
  }

  const intervals = [];

  for (let i = 1; i < peaks.length; i++) {
    const interval = peaks[i].distance - peaks[i - 1].distance;
    intervals.push({
      fromIndex: peaks[i - 1].index,
      toIndex: peaks[i].index,
      fromDistance: peaks[i - 1].distance,
      toDistance: peaks[i].distance,
      interval: parseFloat(interval.toFixed(3))
    });
  }

  const intervalValues = intervals.map(iv => iv.interval);
  const stats = calculateBasicStats(intervalValues);

  return {
    success: true,
    intervals,
    statistics: {
      count: intervals.length,
      avgInterval: parseFloat(stats.avg.toFixed(3)),
      minInterval: parseFloat(stats.min.toFixed(3)),
      maxInterval: parseFloat(stats.max.toFixed(3)),
      stdDev: parseFloat(stats.stdDev.toFixed(3))
    }
  };
}

/**
 * ローリングウィンドウによる極値検出
 * @param {Array} data - 軌道データ配列
 * @param {number} windowSize - ウィンドウサイズ
 * @returns {Object} 極値検出結果
 */
export function detectExtremaInWindows(data, windowSize = PEAK_DETECTION_PARAMS.windowSize) {
  if (!data || data.length < windowSize) {
    return {
      success: false,
      error: 'データがウィンドウサイズより小さい',
      extrema: []
    };
  }

  const extrema = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = halfWindow; i < data.length - halfWindow; i++) {
    const window = data.slice(i - halfWindow, i + halfWindow + 1);
    const windowValues = window.map(d => d.irregularity);

    const max = Math.max(...windowValues);
    const min = Math.min(...windowValues);
    const current = data[i].irregularity;

    if (current === max) {
      extrema.push({
        index: i,
        distance: data[i].distance,
        value: current,
        type: 'local_maximum'
      });
    } else if (current === min) {
      extrema.push({
        index: i,
        distance: data[i].distance,
        value: current,
        type: 'local_minimum'
      });
    }
  }

  return {
    success: true,
    extrema,
    windowSize,
    count: extrema.length
  };
}

/**
 * 包括的なピーク分析
 * @param {Array} data - 軌道データ配列
 * @param {Object} options - オプション
 * @returns {Object} 包括的な分析結果
 */
export function comprehensivePeakAnalysis(data, options = {}) {
  try {
    const peakResult = detectPeaks(data, options);

    if (!peakResult.success) {
      return peakResult;
    }

    const outliers = detectOutliers(data, options.outlierSigma || 3.0);

    const maximaSpacing = peakResult.maxima.length >= 2 ?
      analyzePeakSpacing(peakResult.maxima) : null;

    const minimaSpacing = peakResult.minima.length >= 2 ?
      analyzePeakSpacing(peakResult.minima) : null;

    return {
      success: true,
      peaks: peakResult,
      outliers: {
        count: outliers.length,
        data: outliers
      },
      spacing: {
        maxima: maximaSpacing,
        minima: minimaSpacing
      },
      summary: {
        totalPeaks: peakResult.totalPeaks,
        maximaCount: peakResult.maximaCount,
        minimaCount: peakResult.minimaCount,
        outliersCount: outliers.length,
        dataPoints: data.length
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
