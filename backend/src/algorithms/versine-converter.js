/**
 * 矢中弦変換モジュール
 * 復元波形から矢中弦（versine）を計算
 *
 * 矢中弦（やちゅうげん）:
 * - 軌道の曲がり具合を表す指標
 * - 弦長の両端点の平均値と中央点との差
 * - 測定波形の高周波成分を除去する効果
 *
 * 計算式:
 * V[i] = (y[i-n] + y[i+n]) / 2 - y[i]
 *
 * 弦長:
 * - 10m弦: 測定間隔0.25m → n = 40点
 * - 20m弦: 測定間隔0.25m → n = 80点
 * - 40m弦: 測定間隔0.25m → n = 160点
 */

class VersineConverter {
  constructor(samplingInterval = 0.25) {
    this.samplingInterval = samplingInterval; // サンプリング間隔（m）

    // 弦長定義
    this.CHORD_LENGTHS = {
      '10m': 10.0,
      '20m': 20.0,
      '40m': 40.0
    };
  }

  /**
   * 弦長から必要な点数を計算
   * @param {number} chordLength - 弦長（m）
   * @returns {number} 半弦長の点数
   */
  calculateHalfChordPoints(chordLength) {
    const halfChord = chordLength / 2.0;
    return Math.round(halfChord / this.samplingInterval);
  }

  /**
   * 矢中弦を計算（汎用）
   * @param {Float32Array} signal - 入力信号
   * @param {number} halfPoints - 半弦長の点数
   * @returns {Float32Array} 矢中弦データ
   */
  calculateVersine(signal, halfPoints) {
    const length = signal.length;
    const versine = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const leftIndex = i - halfPoints;
      const rightIndex = i + halfPoints;

      // 境界処理
      if (leftIndex < 0 || rightIndex >= length) {
        versine[i] = 0.0; // 境界外はゼロ
        continue;
      }

      // 矢中弦計算: V = (y[i-n] + y[i+n]) / 2 - y[i]
      versine[i] = (signal[leftIndex] + signal[rightIndex]) / 2.0 - signal[i];
    }

    return versine;
  }

  /**
   * 10m弦矢中弦を計算
   * @param {Float32Array} signal - 入力信号
   * @returns {Float32Array} 10m弦矢中弦
   */
  calculate10mVersine(signal) {
    const halfPoints = this.calculateHalfChordPoints(10.0);
    return this.calculateVersine(signal, halfPoints);
  }

  /**
   * 20m弦矢中弦を計算
   * @param {Float32Array} signal - 入力信号
   * @returns {Float32Array} 20m弦矢中弦
   */
  calculate20mVersine(signal) {
    const halfPoints = this.calculateHalfChordPoints(20.0);
    return this.calculateVersine(signal, halfPoints);
  }

  /**
   * 40m弦矢中弦を計算
   * @param {Float32Array} signal - 入力信号
   * @returns {Float32Array} 40m弦矢中弦
   */
  calculate40mVersine(signal) {
    const halfPoints = this.calculateHalfChordPoints(40.0);
    return this.calculateVersine(signal, halfPoints);
  }

  /**
   * 測定データから矢中弦を計算
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {string} chordType - 弦長タイプ ('10m', '20m', '40m')
   * @returns {MeasurementData[]} 矢中弦データ配列
   */
  convertMeasurementData(measurementData, chordType = '10m') {
    // 測定値のみを抽出
    const values = new Float32Array(measurementData.length);
    for (let i = 0; i < measurementData.length; i++) {
      values[i] = measurementData[i].value;
    }

    // 弦長に応じて矢中弦を計算
    let versineValues;

    switch (chordType) {
      case '10m':
        versineValues = this.calculate10mVersine(values);
        break;
      case '20m':
        versineValues = this.calculate20mVersine(values);
        break;
      case '40m':
        versineValues = this.calculate40mVersine(values);
        break;
      default:
        throw new Error(`Unsupported chord type: ${chordType}`);
    }

    // 結果を MeasurementData 形式に変換
    const result = [];
    for (let i = 0; i < measurementData.length; i++) {
      result.push({
        distance: measurementData[i].distance,
        value: parseFloat(versineValues[i].toFixed(3))
      });
    }

    return result;
  }

  /**
   * 複数の弦長で矢中弦を一括計算
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {string[]} chordTypes - 弦長タイプ配列 (['10m', '20m', '40m'])
   * @returns {Object.<string, MeasurementData[]>} 弦長別矢中弦データ
   */
  convertMultiple(measurementData, chordTypes = ['10m', '20m', '40m']) {
    const result = {};

    for (const chordType of chordTypes) {
      result[chordType] = this.convertMeasurementData(measurementData, chordType);
    }

    return result;
  }

  /**
   * 逆変換: 矢中弦から元波形を復元（積分処理）
   * 注意: 完全な逆変換ではなく、近似復元
   * @param {Float32Array} versine - 矢中弦データ
   * @param {number} halfPoints - 半弦長の点数
   * @returns {Float32Array} 復元された波形
   */
  inverseVersine(versine, halfPoints) {
    const length = versine.length;
    const restored = new Float32Array(length);

    // 累積加算による近似復元
    let sum = 0.0;

    for (let i = 0; i < length; i++) {
      if (i >= halfPoints && i < length - halfPoints) {
        // V[i] = (y[i-n] + y[i+n]) / 2 - y[i] から y[i] を推定
        // 簡易的な累積処理
        sum += versine[i];
        restored[i] = sum / (i + 1);
      } else {
        restored[i] = 0.0;
      }
    }

    return restored;
  }

  /**
   * σ値（標準偏差）を計算
   * @param {Float32Array} data - データ配列
   * @returns {number} σ値
   */
  calculateSigma(data) {
    let sum = 0.0;
    let sumSquare = 0.0;
    let count = 0;

    for (let i = 0; i < data.length; i++) {
      if (data[i] !== 0.0) {
        sum += data[i];
        sumSquare += data[i] * data[i];
        count++;
      }
    }

    if (count === 0) return 0.0;

    const mean = sum / count;
    const variance = sumSquare / count - mean * mean;

    return Math.sqrt(Math.max(0, variance));
  }

  /**
   * RMS値（二乗平均平方根）を計算
   * @param {Float32Array} data - データ配列
   * @returns {number} RMS値
   */
  calculateRMS(data) {
    let sumSquare = 0.0;
    let count = 0;

    for (let i = 0; i < data.length; i++) {
      if (data[i] !== 0.0) {
        sumSquare += data[i] * data[i];
        count++;
      }
    }

    if (count === 0) return 0.0;

    return Math.sqrt(sumSquare / count);
  }

  /**
   * ピーク値を取得
   * @param {Float32Array} data - データ配列
   * @returns {{max: number, min: number, peakToPeak: number}} ピーク値情報
   */
  getPeakValues(data) {
    let max = -Infinity;
    let min = Infinity;

    for (let i = 0; i < data.length; i++) {
      if (data[i] !== 0.0) {
        if (data[i] > max) max = data[i];
        if (data[i] < min) min = data[i];
      }
    }

    return {
      max: max === -Infinity ? 0 : max,
      min: min === Infinity ? 0 : min,
      peakToPeak: max === -Infinity ? 0 : max - min
    };
  }

  /**
   * 統計情報を計算
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @returns {Object} 統計情報
   */
  calculateStatistics(measurementData) {
    const values = new Float32Array(measurementData.length);
    for (let i = 0; i < measurementData.length; i++) {
      values[i] = measurementData[i].value;
    }

    const sigma = this.calculateSigma(values);
    const rms = this.calculateRMS(values);
    const peaks = this.getPeakValues(values);

    return {
      sigma,
      rms,
      max: peaks.max,
      min: peaks.min,
      peakToPeak: peaks.peakToPeak
    };
  }

  /**
   * サンプリング間隔を取得
   * @returns {number} サンプリング間隔（m）
   */
  getSamplingInterval() {
    return this.samplingInterval;
  }

  /**
   * サンプリング間隔を設定
   * @param {number} interval - サンプリング間隔（m）
   */
  setSamplingInterval(interval) {
    this.samplingInterval = interval;
  }
}

module.exports = { VersineConverter };
