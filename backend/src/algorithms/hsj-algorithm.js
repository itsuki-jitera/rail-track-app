/**
 * HSJアルゴリズム - 波長帯制限フィルタ
 * Wavelength Band Limiting Filter for Railway Track Analysis
 *
 * 目的:
 * - 特定波長帯域の軌道狂い成分のみを抽出
 * - H: 波長下限（High-pass）
 * - S: 波長上限（Low-pass）
 * - J: 帯域制限（Junction/Band-pass）
 *
 * アルゴリズム概要:
 * 1. FFT（高速フーリエ変換）による周波数領域への変換
 * 2. 指定波長帯域のフィルタリング
 * 3. IFFT（逆高速フーリエ変換）による時間領域への復元
 *
 * 波長帯域の例:
 * - 短波長成分（1m～10m）: 局所的な軌道狂い
 * - 中波長成分（10m～40m）: 通常の軌道狂い
 * - 長波長成分（40m～200m）: 緩やかな軌道変位
 */

const { FFT } = require('./fft');

class HSJAlgorithm {
  constructor(options = {}) {
    // サンプリング間隔（m）
    this.samplingInterval = options.samplingInterval || 0.25;

    // デフォルト波長帯域
    this.defaultBands = {
      shortWave: { min: 1.0, max: 10.0 },      // 短波長
      midWave: { min: 10.0, max: 40.0 },       // 中波長
      longWave: { min: 40.0, max: 200.0 }      // 長波長
    };

    // 計算精度
    this.precision = options.precision || 3;

    // FFTインスタンス
    this.fft = new FFT();
  }

  /**
   * 波長から周波数への変換
   * frequency = velocity / wavelength
   * velocity = samplingInterval / samplingTime = samplingInterval * samplingRate
   * ここでは速度を1とする（正規化周波数）
   *
   * @param {number} wavelength - 波長（m）
   * @returns {number} 正規化周波数
   */
  wavelengthToFrequency(wavelength) {
    if (wavelength === 0) return 0;
    return this.samplingInterval / wavelength;
  }

  /**
   * 周波数から波長への変換
   *
   * @param {number} frequency - 正規化周波数
   * @returns {number} 波長（m）
   */
  frequencyToWavelength(frequency) {
    if (frequency === 0) return Infinity;
    return this.samplingInterval / frequency;
  }

  /**
   * バンドパスフィルタの周波数応答を生成
   *
   * @param {number} dataLength - データ長
   * @param {number} minWavelength - 最小波長（m）
   * @param {number} maxWavelength - 最大波長（m）
   * @returns {Float32Array} フィルタ係数
   */
  createBandpassFilter(dataLength, minWavelength, maxWavelength) {
    const filter = new Float32Array(dataLength);

    // 周波数への変換
    const minFreq = this.wavelengthToFrequency(maxWavelength); // 最大波長 → 最小周波数
    const maxFreq = this.wavelengthToFrequency(minWavelength); // 最小波長 → 最大周波数

    const nyquist = 0.5; // ナイキスト周波数（正規化）

    for (let i = 0; i < dataLength; i++) {
      // 正規化周波数の計算
      const freq = (i / dataLength) * nyquist;

      // バンドパスフィルタ
      if (freq >= minFreq && freq <= maxFreq) {
        // ハニング窓による平滑化
        const position = (freq - minFreq) / (maxFreq - minFreq);
        filter[i] = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * position));
      } else {
        filter[i] = 0.0;
      }
    }

    return filter;
  }

  /**
   * HSJフィルタリングを適用
   *
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {number} minWavelength - 最小波長（m）
   * @param {number} maxWavelength - 最大波長（m）
   * @returns {HSJResult} フィルタリング結果
   */
  applyFilter(measurementData, minWavelength, maxWavelength) {
    try {
      // データ長の取得
      const dataLength = measurementData.length;

      // 2のべき乗に調整
      const paddedLength = Math.pow(2, Math.ceil(Math.log2(dataLength)));

      // データの抽出とパディング
      const inputData = new Float32Array(paddedLength);
      for (let i = 0; i < dataLength; i++) {
        inputData[i] = measurementData[i].value;
      }
      // 残りはゼロパディング

      // FFT実行
      const fftResult = this.fft.transform(inputData);

      // バンドパスフィルタの生成
      const filterCoeffs = this.createBandpassFilter(paddedLength, minWavelength, maxWavelength);

      // 周波数領域でフィルタリング
      const filteredReal = new Float32Array(paddedLength);
      const filteredImag = new Float32Array(paddedLength);

      for (let i = 0; i < paddedLength; i++) {
        filteredReal[i] = fftResult.real[i] * filterCoeffs[i];
        filteredImag[i] = fftResult.imag[i] * filterCoeffs[i];
      }

      // IFFT実行
      const ifftResult = this.fft.inverse(filteredReal, filteredImag);

      // 結果の抽出（元のデータ長に切り詰め）
      const filteredData = [];
      for (let i = 0; i < dataLength; i++) {
        filteredData.push({
          distance: measurementData[i].distance,
          value: parseFloat(ifftResult[i].toFixed(this.precision)),
          originalValue: measurementData[i].value
        });
      }

      // 統計情報の計算
      const statistics = this.calculateStatistics(filteredData);

      return {
        success: true,
        filteredData,
        statistics,
        filterParams: {
          minWavelength,
          maxWavelength,
          minFrequency: this.wavelengthToFrequency(maxWavelength),
          maxFrequency: this.wavelengthToFrequency(minWavelength)
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
   * 複数波長帯域でのフィルタリング（短波長・中波長・長波長）
   *
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @returns {Object} 波長帯別のフィルタリング結果
   */
  applyMultiBandFilter(measurementData) {
    const results = {};

    // 短波長成分
    results.shortWave = this.applyFilter(
      measurementData,
      this.defaultBands.shortWave.min,
      this.defaultBands.shortWave.max
    );

    // 中波長成分
    results.midWave = this.applyFilter(
      measurementData,
      this.defaultBands.midWave.min,
      this.defaultBands.midWave.max
    );

    // 長波長成分
    results.longWave = this.applyFilter(
      measurementData,
      this.defaultBands.longWave.min,
      this.defaultBands.longWave.max
    );

    return {
      success: true,
      results,
      bandDefinitions: this.defaultBands
    };
  }

  /**
   * ハイパスフィルタ（指定波長以下を除去）
   *
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {number} cutoffWavelength - カットオフ波長（m）
   * @returns {HSJResult} フィルタリング結果
   */
  applyHighpassFilter(measurementData, cutoffWavelength) {
    // cutoffWavelength以下を除去 → cutoffWavelengthから最大波長まで通過
    const maxWavelength = measurementData.length * this.samplingInterval; // データ全長
    return this.applyFilter(measurementData, cutoffWavelength, maxWavelength);
  }

  /**
   * ローパスフィルタ（指定波長以上を除去）
   *
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {number} cutoffWavelength - カットオフ波長（m）
   * @returns {HSJResult} フィルタリング結果
   */
  applyLowpassFilter(measurementData, cutoffWavelength) {
    // cutoffWavelength以上を除去 → 最小波長からcutoffWavelengthまで通過
    return this.applyFilter(measurementData, this.samplingInterval * 2, cutoffWavelength);
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
      sum += value;
      sumSquare += value * value;
      if (value > max) max = value;
      if (value < min) min = value;
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
      max: parseFloat(max.toFixed(this.precision)),
      min: parseFloat(min.toFixed(this.precision)),
      peakToPeak: parseFloat((max - min).toFixed(this.precision))
    };
  }

  /**
   * 波長帯域設定を更新
   *
   * @param {string} bandName - 帯域名（'shortWave', 'midWave', 'longWave'）
   * @param {number} min - 最小波長（m）
   * @param {number} max - 最大波長（m）
   */
  setBand(bandName, min, max) {
    if (this.defaultBands[bandName]) {
      this.defaultBands[bandName] = { min, max };
    }
  }

  /**
   * アルゴリズム情報を取得
   *
   * @returns {Object} アルゴリズム情報
   */
  getAlgorithmInfo() {
    return {
      name: 'HSJ',
      version: '1.0.0',
      description: '波長帯制限フィルタ（FFTベース）',
      author: 'Rail Track Restoration System',
      parameters: {
        samplingInterval: this.samplingInterval,
        precision: this.precision,
        bands: this.defaultBands
      }
    };
  }
}

module.exports = { HSJAlgorithm };
