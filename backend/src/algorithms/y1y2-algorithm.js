/**
 * Y1Y2アルゴリズム - 矢中弦計算の2つの方法
 * Dual Versine Calculation Methods for Railway Track Analysis
 *
 * 目的:
 * - 異なる計算方法による矢中弦の算出と比較
 * - Y1法: 始端中終端法（標準矢中弦）
 * - Y2法: 始端終端中法（修正矢中弦）
 *
 * アルゴリズム詳細:
 *
 * Y1法（標準矢中弦）:
 * V1[i] = (y[i-n] + y[i+n]) / 2 - y[i]
 * - 両端の平均値と中央値の差
 * - 一般的な矢中弦の定義
 *
 * Y2法（修正矢中弦）:
 * V2[i] = y[i] - (y[i-n] + y[i+n]) / 2
 * または
 * V2[i] = 2 * y[i] - y[i-n] - y[i+n]
 * - 符号が反転した計算
 * - より局所的な変化を強調
 *
 * 使用シーン:
 * - Y1: 一般的な軌道狂い解析
 * - Y2: 急激な変化点の検出
 * - 両方の比較による異常箇所の特定
 */

class Y1Y2Algorithm {
  constructor(options = {}) {
    // サンプリング間隔（m）
    this.samplingInterval = options.samplingInterval || 0.25;

    // 弦長定義
    this.chordLengths = {
      '5m': 5.0,
      '10m': 10.0,
      '20m': 20.0,
      '40m': 40.0
    };

    // 計算精度
    this.precision = options.precision || 3;
  }

  /**
   * 弦長から半弦点数を計算
   *
   * @param {number} chordLength - 弦長（m）
   * @returns {number} 半弦点数
   */
  calculateHalfChordPoints(chordLength) {
    return Math.round((chordLength / 2.0) / this.samplingInterval);
  }

  /**
   * Y1法（標準矢中弦）計算
   * V1[i] = (y[i-n] + y[i+n]) / 2 - y[i]
   *
   * @param {Float32Array} signal - 入力信号
   * @param {number} halfPoints - 半弦点数
   * @returns {Float32Array} Y1矢中弦
   */
  calculateY1Versine(signal, halfPoints) {
    const length = signal.length;
    const versine = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const leftIndex = i - halfPoints;
      const rightIndex = i + halfPoints;

      // 境界チェック
      if (leftIndex < 0 || rightIndex >= length) {
        versine[i] = 0.0;
        continue;
      }

      // Y1法: 両端の平均 - 中央
      versine[i] = (signal[leftIndex] + signal[rightIndex]) / 2.0 - signal[i];
    }

    return versine;
  }

  /**
   * Y2法（修正矢中弦）計算
   * V2[i] = y[i] - (y[i-n] + y[i+n]) / 2
   * または V2[i] = 2*y[i] - y[i-n] - y[i+n]
   *
   * @param {Float32Array} signal - 入力信号
   * @param {number} halfPoints - 半弦点数
   * @param {string} mode - 計算モード ('subtract' または 'double')
   * @returns {Float32Array} Y2矢中弦
   */
  calculateY2Versine(signal, halfPoints, mode = 'subtract') {
    const length = signal.length;
    const versine = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const leftIndex = i - halfPoints;
      const rightIndex = i + halfPoints;

      // 境界チェック
      if (leftIndex < 0 || rightIndex >= length) {
        versine[i] = 0.0;
        continue;
      }

      if (mode === 'double') {
        // Y2法（2倍方式）: 2*中央 - 左端 - 右端
        versine[i] = 2.0 * signal[i] - signal[leftIndex] - signal[rightIndex];
      } else {
        // Y2法（減算方式）: 中央 - 両端の平均
        versine[i] = signal[i] - (signal[leftIndex] + signal[rightIndex]) / 2.0;
      }
    }

    return versine;
  }

  /**
   * Y1とY2の両方を計算
   *
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {string} chordType - 弦長タイプ ('5m', '10m', '20m', '40m')
   * @param {string} y2Mode - Y2計算モード ('subtract' または 'double')
   * @returns {Y1Y2Result} 計算結果
   */
  calculate(measurementData, chordType = '10m', y2Mode = 'subtract') {
    try {
      // 弦長の取得
      const chordLength = this.chordLengths[chordType];
      if (!chordLength) {
        throw new Error(`Unsupported chord type: ${chordType}`);
      }

      const halfPoints = this.calculateHalfChordPoints(chordLength);

      // 測定値を抽出
      const values = new Float32Array(measurementData.length);
      for (let i = 0; i < measurementData.length; i++) {
        values[i] = measurementData[i].value;
      }

      // Y1計算
      const y1Values = this.calculateY1Versine(values, halfPoints);

      // Y2計算
      const y2Values = this.calculateY2Versine(values, halfPoints, y2Mode);

      // 結果を MeasurementData 形式に変換
      const y1Data = [];
      const y2Data = [];
      const differenceData = [];

      for (let i = 0; i < measurementData.length; i++) {
        y1Data.push({
          distance: measurementData[i].distance,
          value: parseFloat(y1Values[i].toFixed(this.precision))
        });

        y2Data.push({
          distance: measurementData[i].distance,
          value: parseFloat(y2Values[i].toFixed(this.precision))
        });

        // Y1とY2の差分
        const diff = y1Values[i] - y2Values[i];
        differenceData.push({
          distance: measurementData[i].distance,
          value: parseFloat(diff.toFixed(this.precision))
        });
      }

      // 統計情報の計算
      const y1Stats = this.calculateStatistics(y1Data);
      const y2Stats = this.calculateStatistics(y2Data);
      const diffStats = this.calculateStatistics(differenceData);

      return {
        success: true,
        y1: {
          data: y1Data,
          statistics: y1Stats,
          method: 'Y1 (Standard Versine)'
        },
        y2: {
          data: y2Data,
          statistics: y2Stats,
          method: `Y2 (Modified Versine - ${y2Mode})`
        },
        difference: {
          data: differenceData,
          statistics: diffStats,
          method: 'Y1 - Y2 Difference'
        },
        parameters: {
          chordType,
          chordLength,
          halfPoints,
          y2Mode
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 複数弦長でY1Y2を一括計算
   *
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {string[]} chordTypes - 弦長タイプ配列
   * @param {string} y2Mode - Y2計算モード
   * @returns {Object} 弦長別の計算結果
   */
  calculateMultiple(measurementData, chordTypes = ['10m', '20m', '40m'], y2Mode = 'subtract') {
    const results = {};

    for (const chordType of chordTypes) {
      results[chordType] = this.calculate(measurementData, chordType, y2Mode);
    }

    return {
      success: true,
      results,
      chordTypes
    };
  }

  /**
   * Y1とY2の相関分析
   * 相関が低い箇所は異常の可能性あり
   *
   * @param {Y1Y2Result} result - Y1Y2計算結果
   * @returns {Object} 相関分析結果
   */
  analyzeCorrelation(result) {
    if (!result.success) {
      return { success: false, error: 'Invalid input result' };
    }

    const y1Data = result.y1.data.map(d => d.value);
    const y2Data = result.y2.data.map(d => d.value);

    // 相関係数の計算
    let sumXY = 0;
    let sumX = 0;
    let sumY = 0;
    let sumX2 = 0;
    let sumY2 = 0;
    let count = 0;

    for (let i = 0; i < y1Data.length; i++) {
      if (y1Data[i] !== 0 || y2Data[i] !== 0) {
        sumXY += y1Data[i] * y2Data[i];
        sumX += y1Data[i];
        sumY += y2Data[i];
        sumX2 += y1Data[i] * y1Data[i];
        sumY2 += y2Data[i] * y2Data[i];
        count++;
      }
    }

    if (count === 0) {
      return {
        success: true,
        correlation: 0,
        interpretation: 'No data'
      };
    }

    const numerator = count * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (count * sumX2 - sumX * sumX) * (count * sumY2 - sumY * sumY)
    );

    const correlation = denominator !== 0 ? numerator / denominator : 0;

    let interpretation;
    if (Math.abs(correlation) > 0.9) {
      interpretation = 'Strong correlation - Normal track condition';
    } else if (Math.abs(correlation) > 0.7) {
      interpretation = 'Moderate correlation - Acceptable';
    } else if (Math.abs(correlation) > 0.5) {
      interpretation = 'Weak correlation - Possible irregularities';
    } else {
      interpretation = 'Very weak correlation - Investigate anomalies';
    }

    return {
      success: true,
      correlation: parseFloat(correlation.toFixed(4)),
      interpretation
    };
  }

  /**
   * 統計情報を計算
   *
   * @param {MeasurementData[]} data - データ配列
   * @returns {Object} 統計情報
   */
  calculateStatistics(data) {
    const values = data.map(d => d.value);

    let sum = 0;
    let sumSquare = 0;
    let max = -Infinity;
    let min = Infinity;

    for (const value of values) {
      if (value !== 0) {
        sum += value;
        sumSquare += value * value;
        if (value > max) max = value;
        if (value < min) min = value;
      }
    }

    const count = values.length;
    const mean = sum / count;
    const variance = (sumSquare / count) - (mean * mean);
    const sigma = Math.sqrt(Math.max(0, variance));
    const rms = Math.sqrt(sumSquare / count);

    return {
      count,
      mean: parseFloat(mean.toFixed(this.precision)),
      sigma: parseFloat(sigma.toFixed(this.precision)),
      rms: parseFloat(rms.toFixed(this.precision)),
      max: max === -Infinity ? 0 : parseFloat(max.toFixed(this.precision)),
      min: min === Infinity ? 0 : parseFloat(min.toFixed(this.precision)),
      peakToPeak: max === -Infinity ? 0 : parseFloat((max - min).toFixed(this.precision))
    };
  }

  /**
   * アルゴリズム情報を取得
   *
   * @returns {Object} アルゴリズム情報
   */
  getAlgorithmInfo() {
    return {
      name: 'Y1Y2',
      version: '1.0.0',
      description: 'Dual Versine Calculation Methods',
      author: 'Rail Track Restoration System',
      methods: {
        Y1: 'V1 = (y[i-n] + y[i+n]) / 2 - y[i]',
        Y2: 'V2 = y[i] - (y[i-n] + y[i+n]) / 2'
      },
      parameters: {
        samplingInterval: this.samplingInterval,
        precision: this.precision,
        supportedChords: Object.keys(this.chordLengths)
      }
    };
  }
}

module.exports = { Y1Y2Algorithm };
