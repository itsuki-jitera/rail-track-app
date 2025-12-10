/**
 * 偏心矢（Eccentric Versine）計算アルゴリズム
 * Asymmetric Chord Configuration Versine Calculation
 *
 * 仕様書準拠:
 * - 250904_06_偏心矢の検測特性の計算方法.pdf
 * - 250904_07_偏心矢から偏心矢へ変換する計算方法.pdf
 *
 * 基本式（式2）:
 * y[n] = x[n] - (1/(p+q))(p*x[n-q/τ] + q*x[n+p/τ])
 *
 * 検測特性（式6）:
 * A = 1 - (p*cos(ωq) + q*cos(ωp))/(p+q)
 * B = (-p*sin(ωq) + q*sin(ωp))/(p+q)
 * 振幅特性: √(A² + B²)
 * 位相特性: θ = arctan(B/A)
 *
 * 変換係数:
 * α = (A1*A2 + B1*B2)/(A1² + B1²)
 * β = (A1*B2 - A2*B1)/(A1² + B1²)
 */

class EccentricVersine {
  constructor(options = {}) {
    // サンプリング間隔（m）
    this.samplingInterval = options.samplingInterval || 0.25;

    // 計算精度
    this.precision = options.precision || 3;
  }

  /**
   * 偏心矢を計算（仕様書 式2準拠）
   * y[n] = x[n] - (1/(p+q))(p*x[n-q/τ] + q*x[n+p/τ])
   *
   * @param {Float32Array} signal - 入力信号
   * @param {number} p - 前方弦長（m）
   * @param {number} q - 後方弦長（m）
   * @returns {Float32Array} 偏心矢データ
   */
  calculateEccentricVersine(signal, p, q) {
    const length = signal.length;
    const versine = new Float32Array(length);

    // 弦長を点数に変換
    const pPoints = Math.round(p / this.samplingInterval);
    const qPoints = Math.round(q / this.samplingInterval);

    for (let i = 0; i < length; i++) {
      const leftIndex = i - qPoints;   // x[n-q/τ]
      const rightIndex = i + pPoints;  // x[n+p/τ]

      // 境界チェック
      if (leftIndex < 0 || rightIndex >= length) {
        versine[i] = 0.0;
        continue;
      }

      // 式(2): y[n] = x[n] - (1/(p+q))(p*x[n-q/τ] + q*x[n+p/τ])
      const weightedAvg = (p * signal[leftIndex] + q * signal[rightIndex]) / (p + q);
      versine[i] = signal[i] - weightedAvg;
    }

    return versine;
  }

  /**
   * 検測特性のA, B係数を計算（仕様書 式6準拠）
   *
   * A = 1 - (p*cos(ωq) + q*cos(ωp))/(p+q)
   * B = (-p*sin(ωq) + q*sin(ωp))/(p+q)
   *
   * @param {number} p - 前方弦長（m）
   * @param {number} q - 後方弦長（m）
   * @param {number} wavelength - 波長（m）
   * @returns {{A: number, B: number}} A, B係数
   */
  calculateABCoefficients(p, q, wavelength) {
    // 角周波数 ω = 2π/L
    const omega = (2 * Math.PI) / wavelength;

    // 式(6)
    const A = 1 - (p * Math.cos(omega * q) + q * Math.cos(omega * p)) / (p + q);
    const B = (-p * Math.sin(omega * q) + q * Math.sin(omega * p)) / (p + q);

    return { A, B };
  }

  /**
   * 検測特性を計算（振幅・位相）
   *
   * @param {number} p - 前方弦長（m）
   * @param {number} q - 後方弦長（m）
   * @param {number[]} wavelengths - 波長配列（m）
   * @returns {Object} 検測特性
   */
  calculateMeasurementCharacteristics(p, q, wavelengths = null) {
    // デフォルトの波長範囲: 1m ~ 200m
    if (!wavelengths) {
      wavelengths = [];
      for (let L = 1; L <= 200; L += 1) {
        wavelengths.push(L);
      }
    }

    const characteristics = [];

    for (const wavelength of wavelengths) {
      const { A, B } = this.calculateABCoefficients(p, q, wavelength);

      // 振幅特性: √(A² + B²)
      const amplitude = Math.sqrt(A * A + B * B);

      // 位相特性: θ = arctan(B/A)
      const phase = Math.atan2(B, A);

      characteristics.push({
        wavelength,
        A: parseFloat(A.toFixed(6)),
        B: parseFloat(B.toFixed(6)),
        amplitude: parseFloat(amplitude.toFixed(6)),
        phase: parseFloat(phase.toFixed(6)),
        phaseDeg: parseFloat((phase * 180 / Math.PI).toFixed(3))
      });
    }

    return {
      p,
      q,
      isSymmetric: p === q,
      characteristics
    };
  }

  /**
   * 偏心矢変換係数を計算
   *
   * α = (A1*A2 + B1*B2)/(A1² + B1²)
   * β = (A1*B2 - A2*B1)/(A1² + B1²)
   *
   * @param {number} p1 - 変換元前方弦長
   * @param {number} q1 - 変換元後方弦長
   * @param {number} p2 - 変換先前方弦長
   * @param {number} q2 - 変換先後方弦長
   * @param {number} wavelength - 波長
   * @returns {{alpha: number, beta: number}} 変換係数
   */
  calculateConversionCoefficients(p1, q1, p2, q2, wavelength) {
    const { A: A1, B: B1 } = this.calculateABCoefficients(p1, q1, wavelength);
    const { A: A2, B: B2 } = this.calculateABCoefficients(p2, q2, wavelength);

    const denominator = A1 * A1 + B1 * B1;

    // ゼロ除算チェック
    if (denominator === 0) {
      return { alpha: 0, beta: 0 };
    }

    const alpha = (A1 * A2 + B1 * B2) / denominator;
    const beta = (A1 * B2 - A2 * B1) / denominator;

    return { alpha, beta };
  }

  /**
   * 偏心矢から偏心矢への変換
   *
   * @param {Float32Array} versine1 - 変換元偏心矢
   * @param {number} p1 - 変換元前方弦長
   * @param {number} q1 - 変換元後方弦長
   * @param {number} p2 - 変換先前方弦長
   * @param {number} q2 - 変換先後方弦長
   * @param {number} wavelength - 基準波長
   * @returns {Float32Array} 変換後偏心矢
   */
  convertVersine(versine1, p1, q1, p2, q2, wavelength) {
    const length = versine1.length;
    const versine2 = new Float32Array(length);

    const { alpha, beta } = this.calculateConversionCoefficients(p1, q1, p2, q2, wavelength);

    // 簡易的な変換（実部のみ）
    // 完全な変換には周波数領域での処理が必要
    for (let i = 0; i < length; i++) {
      versine2[i] = alpha * versine1[i];
    }

    return versine2;
  }

  /**
   * 正矢から偏心矢への変換（B1 = 0のケース）
   *
   * α = A2/A1
   * β = B2/A1
   *
   * @param {Float32Array} seiya - 正矢データ
   * @param {number} pq - 正矢の弦長（p = q）
   * @param {number} p2 - 偏心矢前方弦長
   * @param {number} q2 - 偏心矢後方弦長
   * @param {number} wavelength - 基準波長
   * @returns {Float32Array} 偏心矢データ
   */
  convertFromSeiya(seiya, pq, p2, q2, wavelength) {
    // 正矢は対称なので p1 = q1 = pq/2
    const p1 = pq / 2;
    const q1 = pq / 2;

    const { A: A1 } = this.calculateABCoefficients(p1, q1, wavelength);
    const { A: A2, B: B2 } = this.calculateABCoefficients(p2, q2, wavelength);

    // B1 = 0 のため簡略化
    const alpha = A2 / A1;
    const beta = B2 / A1;

    const length = seiya.length;
    const eccVersine = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      eccVersine[i] = alpha * seiya[i];
    }

    return eccVersine;
  }

  /**
   * 偏心矢から正矢への変換（B2 = 0のケース）
   *
   * α = (A1*A2)/(A1² + B1²)
   * β = (-A2*B1)/(A1² + B1²)
   *
   * @param {Float32Array} eccVersine - 偏心矢データ
   * @param {number} p1 - 偏心矢前方弦長
   * @param {number} q1 - 偏心矢後方弦長
   * @param {number} pq - 正矢の弦長（p = q）
   * @param {number} wavelength - 基準波長
   * @returns {Float32Array} 正矢データ
   */
  convertToSeiya(eccVersine, p1, q1, pq, wavelength) {
    // 正矢は対称なので p2 = q2 = pq/2
    const p2 = pq / 2;
    const q2 = pq / 2;

    const { A: A1, B: B1 } = this.calculateABCoefficients(p1, q1, wavelength);
    const { A: A2 } = this.calculateABCoefficients(p2, q2, wavelength);

    const denominator = A1 * A1 + B1 * B1;

    if (denominator === 0) {
      return new Float32Array(eccVersine.length);
    }

    // B2 = 0 のため簡略化
    const alpha = (A1 * A2) / denominator;

    const length = eccVersine.length;
    const seiya = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      seiya[i] = alpha * eccVersine[i];
    }

    return seiya;
  }

  /**
   * 測定データから偏心矢を計算
   *
   * @param {Array<{distance: number, value: number}>} measurementData - 測定データ
   * @param {number} p - 前方弦長（m）
   * @param {number} q - 後方弦長（m）
   * @returns {Object} 計算結果
   */
  calculate(measurementData, p, q) {
    try {
      // 測定値を抽出
      const values = new Float32Array(measurementData.length);
      for (let i = 0; i < measurementData.length; i++) {
        values[i] = measurementData[i].value;
      }

      // 偏心矢計算
      const versineValues = this.calculateEccentricVersine(values, p, q);

      // 結果をMeasurementData形式に変換
      const versineData = [];
      for (let i = 0; i < measurementData.length; i++) {
        versineData.push({
          distance: measurementData[i].distance,
          value: parseFloat(versineValues[i].toFixed(this.precision))
        });
      }

      // 統計情報計算
      const statistics = this.calculateStatistics(versineData);

      // 検測特性計算（代表波長）
      const characteristics = this.calculateMeasurementCharacteristics(p, q, [10, 20, 30, 40, 50, 100]);

      return {
        success: true,
        data: versineData,
        statistics,
        parameters: {
          p,
          q,
          isSymmetric: p === q,
          pPoints: Math.round(p / this.samplingInterval),
          qPoints: Math.round(q / this.samplingInterval)
        },
        characteristics: characteristics.characteristics
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 統計情報を計算
   *
   * @param {Array<{distance: number, value: number}>} data - データ配列
   * @returns {Object} 統計情報
   */
  calculateStatistics(data) {
    const values = data.map(d => d.value);

    let sum = 0;
    let sumSquare = 0;
    let max = -Infinity;
    let min = Infinity;
    let count = 0;

    for (const value of values) {
      if (value !== 0) {
        sum += value;
        sumSquare += value * value;
        if (value > max) max = value;
        if (value < min) min = value;
        count++;
      }
    }

    const mean = count > 0 ? sum / count : 0;
    const variance = count > 0 ? (sumSquare / count) - (mean * mean) : 0;
    const sigma = Math.sqrt(Math.max(0, variance));
    const rms = count > 0 ? Math.sqrt(sumSquare / count) : 0;

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
      name: 'EccentricVersine',
      version: '1.0.0',
      description: 'Asymmetric Chord Configuration Versine Calculation',
      specification: [
        '250904_06_偏心矢の検測特性の計算方法.pdf',
        '250904_07_偏心矢から偏心矢へ変換する計算方法.pdf'
      ],
      formulas: {
        versine: 'y[n] = x[n] - (1/(p+q))(p*x[n-q/τ] + q*x[n+p/τ])',
        coefficientA: 'A = 1 - (p*cos(ωq) + q*cos(ωp))/(p+q)',
        coefficientB: 'B = (-p*sin(ωq) + q*sin(ωp))/(p+q)',
        amplitude: '√(A² + B²)',
        phase: 'θ = arctan(B/A)',
        conversionAlpha: 'α = (A1*A2 + B1*B2)/(A1² + B1²)',
        conversionBeta: 'β = (A1*B2 - A2*B1)/(A1² + B1²)'
      },
      parameters: {
        samplingInterval: this.samplingInterval,
        precision: this.precision
      }
    };
  }
}

module.exports = { EccentricVersine };
