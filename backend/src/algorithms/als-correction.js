/**
 * ALS (Average Line Subtraction) 補正アルゴリズム
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 長波長成分（平均線）を差し引いて短波長狂いを抽出
 * - 移動平均、多項式近似、スプライン補間による基準線算出
 * - 軌道の長期的な変形と短期的な狂いを分離
 */

class ALSCorrection {
  /**
   * ALS補正を適用
   *
   * @param {Array} data - 入力データ配列 [{ position, value }]
   * @param {Object} options - 補正オプション
   * @returns {Object} 補正結果
   */
  static applyCorrection(data, options = {}) {
    const {
      method = 'moving_average',     // 補正方法
      baselineLength = 100,          // 基準線長 (m)
      dataInterval = 0.25,           // データ間隔 (m)
      preserveEndpoints = true,      // 端点を保持
      verbose = true
    } = options;

    if (verbose) {
      console.log('ALS補正開始');
      console.log(`方法: ${method}`);
      console.log(`基準線長: ${baselineLength}m`);
    }

    // 入力データの検証
    if (!data || data.length < 10) {
      throw new Error('データ点数が不足しています（最低10点必要）');
    }

    // 位置と値の配列を抽出
    const positions = data.map(d => d.position || d.x || 0);
    const values = data.map(d => d.value || d.y || d);

    // 基準線の計算
    let baseline;
    switch (method) {
      case 'moving_average':
        baseline = this.calculateMovingAverage(values, baselineLength, dataInterval);
        break;

      case 'polynomial':
        const degree = options.polynomialDegree || 6;
        baseline = this.calculatePolynomialBaseline(positions, values, degree);
        break;

      case 'spline':
        const knotSpacing = options.knotSpacing || baselineLength / 4;
        baseline = this.calculateSplineBaseline(positions, values, knotSpacing);
        break;

      case 'butterworth':
        const cutoffWavelength = options.cutoffWavelength || baselineLength;
        baseline = this.calculateButterworthBaseline(values, cutoffWavelength, dataInterval);
        break;

      default:
        throw new Error(`未対応の補正方法: ${method}`);
    }

    // 端点処理
    if (preserveEndpoints) {
      baseline = this.preserveEndpoints(values, baseline);
    }

    // 補正値の計算（元データから基準線を差し引く）
    const correctedValues = values.map((val, i) => val - baseline[i]);

    // 結果データの作成
    const correctedData = data.map((point, i) => ({
      ...point,
      originalValue: values[i],
      baselineValue: baseline[i],
      correctedValue: correctedValues[i],
      correction: baseline[i]
    }));

    // 統計情報の計算
    const statistics = this.calculateStatistics(values, baseline, correctedValues);

    if (verbose) {
      console.log('ALS補正完了');
      console.log(`補正前RMS: ${statistics.original.rms.toFixed(3)}mm`);
      console.log(`補正後RMS: ${statistics.corrected.rms.toFixed(3)}mm`);
      console.log(`改善率: ${statistics.improvement.toFixed(1)}%`);
    }

    return {
      data: correctedData,
      baseline: baseline,
      statistics: statistics,
      parameters: {
        method,
        baselineLength,
        dataInterval
      }
    };
  }

  /**
   * 移動平均による基準線計算
   */
  static calculateMovingAverage(values, baselineLength, dataInterval) {
    const windowSize = Math.round(baselineLength / dataInterval);
    const halfWindow = Math.floor(windowSize / 2);
    const baseline = new Array(values.length);

    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;

      // ウィンドウ内の平均を計算
      for (let j = Math.max(0, i - halfWindow);
           j <= Math.min(values.length - 1, i + halfWindow); j++) {
        sum += values[j];
        count++;
      }

      baseline[i] = sum / count;
    }

    // 平滑化（オプション）
    return this.smoothBaseline(baseline, 3);
  }

  /**
   * 多項式近似による基準線計算
   */
  static calculatePolynomialBaseline(positions, values, degree) {
    // 最小二乗法による多項式係数の計算
    const coefficients = this.polynomialFit(positions, values, degree);

    // 多項式による値の計算
    const baseline = positions.map(pos => {
      let value = 0;
      for (let i = 0; i <= degree; i++) {
        value += coefficients[i] * Math.pow(pos, i);
      }
      return value;
    });

    return baseline;
  }

  /**
   * スプライン補間による基準線計算
   */
  static calculateSplineBaseline(positions, values, knotSpacing) {
    // ノット点の選択
    const knots = [];
    const knotValues = [];

    for (let i = 0; i < positions.length; i += Math.round(knotSpacing)) {
      knots.push(positions[i]);
      knotValues.push(values[i]);
    }

    // 最後の点を確実に含める
    if (knots[knots.length - 1] !== positions[positions.length - 1]) {
      knots.push(positions[positions.length - 1]);
      knotValues.push(values[values.length - 1]);
    }

    // 3次スプライン補間
    const spline = this.cubicSpline(knots, knotValues);

    // 全点での値を計算
    const baseline = positions.map(pos => this.evaluateSpline(spline, pos));

    return baseline;
  }

  /**
   * バターワースフィルタによる基準線計算
   */
  static calculateButterworthBaseline(values, cutoffWavelength, dataInterval) {
    const n = values.length;

    // FFT用にパディング（2のべき乗）
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(n)));
    const padded = new Array(paddedLength).fill(0);
    values.forEach((v, i) => padded[i] = v);

    // FFT実行
    const fft = this.fft(padded);

    // カットオフ周波数の計算
    const cutoffFreq = dataInterval / cutoffWavelength;
    const order = 4; // バターワースフィルタの次数

    // フィルタリング
    for (let i = 0; i < fft.length / 2; i++) {
      const freq = i / paddedLength * (1 / dataInterval);
      const gain = 1 / Math.sqrt(1 + Math.pow(freq / cutoffFreq, 2 * order));

      fft[i] *= gain;
      fft[paddedLength - i - 1] *= gain;
    }

    // 逆FFT
    const filtered = this.ifft(fft);

    // 実数部を取り出して元の長さに切り詰め
    return filtered.slice(0, n).map(c => c.real || c);
  }

  /**
   * 端点保持処理
   */
  static preserveEndpoints(original, baseline) {
    const n = original.length;
    const preserved = [...baseline];

    // 端点付近を徐々に元の値に近づける
    const transitionLength = Math.min(10, Math.floor(n / 10));

    for (let i = 0; i < transitionLength; i++) {
      const weight = i / transitionLength;

      // 始点側
      preserved[i] = original[i] * (1 - weight) + baseline[i] * weight;

      // 終点側
      preserved[n - 1 - i] = original[n - 1 - i] * (1 - weight) +
                            baseline[n - 1 - i] * weight;
    }

    return preserved;
  }

  /**
   * 基準線の平滑化
   */
  static smoothBaseline(baseline, iterations = 1) {
    let smoothed = [...baseline];

    for (let iter = 0; iter < iterations; iter++) {
      const temp = [...smoothed];

      for (let i = 1; i < smoothed.length - 1; i++) {
        smoothed[i] = (temp[i - 1] + 2 * temp[i] + temp[i + 1]) / 4;
      }
    }

    return smoothed;
  }

  /**
   * 多項式フィッティング（最小二乗法）
   */
  static polynomialFit(x, y, degree) {
    const n = x.length;
    const matrix = [];
    const vector = [];

    // 正規方程式の係数行列を作成
    for (let i = 0; i <= degree; i++) {
      matrix[i] = [];
      vector[i] = 0;

      for (let j = 0; j <= degree; j++) {
        matrix[i][j] = 0;
        for (let k = 0; k < n; k++) {
          matrix[i][j] += Math.pow(x[k], i + j);
        }
      }

      for (let k = 0; k < n; k++) {
        vector[i] += y[k] * Math.pow(x[k], i);
      }
    }

    // ガウス消去法で解く
    return this.gaussElimination(matrix, vector);
  }

  /**
   * ガウス消去法
   */
  static gaussElimination(matrix, vector) {
    const n = vector.length;
    const augmented = matrix.map((row, i) => [...row, vector[i]]);

    // 前進消去
    for (let i = 0; i < n; i++) {
      // ピボット選択
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // 消去
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

    // 後退代入
    const solution = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      solution[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        solution[i] -= augmented[i][j] * solution[j];
      }
      solution[i] /= augmented[i][i];
    }

    return solution;
  }

  /**
   * 3次スプライン補間の係数計算
   */
  static cubicSpline(x, y) {
    const n = x.length;
    const h = [];
    const alpha = [];
    const l = [1];
    const mu = [0];
    const z = [0];

    // ステップサイズの計算
    for (let i = 0; i < n - 1; i++) {
      h[i] = x[i + 1] - x[i];
    }

    // 3次係数の計算
    for (let i = 1; i < n - 1; i++) {
      alpha[i] = (3 / h[i]) * (y[i + 1] - y[i]) -
                 (3 / h[i - 1]) * (y[i] - y[i - 1]);
    }

    for (let i = 1; i < n - 1; i++) {
      l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    const c = new Array(n).fill(0);
    const b = new Array(n - 1);
    const d = new Array(n - 1);

    for (let i = n - 2; i >= 0; i--) {
      c[i] = z[i] - mu[i] * c[i + 1];
      b[i] = (y[i + 1] - y[i]) / h[i] - h[i] * (c[i + 1] + 2 * c[i]) / 3;
      d[i] = (c[i + 1] - c[i]) / (3 * h[i]);
    }

    return { x, y, b, c, d };
  }

  /**
   * スプライン評価
   */
  static evaluateSpline(spline, pos) {
    const { x, y, b, c, d } = spline;

    // 適切な区間を見つける
    let i = 0;
    for (let j = 0; j < x.length - 1; j++) {
      if (pos >= x[j] && pos <= x[j + 1]) {
        i = j;
        break;
      }
    }

    // 境界外の場合
    if (pos < x[0]) i = 0;
    if (pos > x[x.length - 1]) i = x.length - 2;

    // スプライン値の計算
    const dx = pos - x[i];
    return y[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  }

  /**
   * 簡易FFT実装（実際のプロジェクトではライブラリを使用推奨）
   */
  static fft(data) {
    const n = data.length;
    if (n <= 1) return data;

    // 偶数と奇数に分割
    const even = [];
    const odd = [];
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) even.push(data[i]);
      else odd.push(data[i]);
    }

    // 再帰的にFFT
    const evenFFT = this.fft(even);
    const oddFFT = this.fft(odd);

    // 結合
    const result = new Array(n);
    for (let k = 0; k < n / 2; k++) {
      const angle = -2 * Math.PI * k / n;
      const w = {
        real: Math.cos(angle),
        imag: Math.sin(angle)
      };

      const oddTerm = this.complexMultiply(w, oddFFT[k]);

      result[k] = this.complexAdd(evenFFT[k], oddTerm);
      result[k + n / 2] = this.complexSubtract(evenFFT[k], oddTerm);
    }

    return result;
  }

  /**
   * 逆FFT
   */
  static ifft(data) {
    const n = data.length;

    // 共役を取る
    const conjugate = data.map(c => ({
      real: c.real || c,
      imag: -(c.imag || 0)
    }));

    // FFTを実行
    const result = this.fft(conjugate);

    // 共役を取って正規化
    return result.map(c => ({
      real: (c.real || c) / n,
      imag: -(c.imag || 0) / n
    }));
  }

  /**
   * 複素数の演算
   */
  static complexAdd(a, b) {
    return {
      real: (a.real || a) + (b.real || b),
      imag: (a.imag || 0) + (b.imag || 0)
    };
  }

  static complexSubtract(a, b) {
    return {
      real: (a.real || a) - (b.real || b),
      imag: (a.imag || 0) - (b.imag || 0)
    };
  }

  static complexMultiply(a, b) {
    const ar = a.real || a;
    const ai = a.imag || 0;
    const br = b.real || b;
    const bi = b.imag || 0;

    return {
      real: ar * br - ai * bi,
      imag: ar * bi + ai * br
    };
  }

  /**
   * 統計情報の計算
   */
  static calculateStatistics(original, baseline, corrected) {
    const calcStats = (data) => {
      const n = data.length;
      const mean = data.reduce((sum, val) => sum + val, 0) / n;
      const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      const rms = Math.sqrt(data.reduce((sum, val) => sum + val * val, 0) / n);
      const min = Math.min(...data);
      const max = Math.max(...data);

      return { mean, stdDev, rms, min, max, range: max - min };
    };

    const originalStats = calcStats(original);
    const baselineStats = calcStats(baseline);
    const correctedStats = calcStats(corrected);

    // 改善率の計算
    const improvement = (1 - correctedStats.rms / originalStats.rms) * 100;

    // 周波数成分の分析
    const frequencyAnalysis = this.analyzeFrequencyComponents(original, corrected);

    return {
      original: originalStats,
      baseline: baselineStats,
      corrected: correctedStats,
      improvement,
      frequencyAnalysis,
      subtractedPower: originalStats.rms - correctedStats.rms
    };
  }

  /**
   * 周波数成分の分析
   */
  static analyzeFrequencyComponents(original, corrected) {
    // 簡易的なパワースペクトル計算
    const calcPower = (data) => {
      const fft = this.fft(data);
      return fft.map(c => {
        const real = c.real || c;
        const imag = c.imag || 0;
        return Math.sqrt(real * real + imag * imag);
      });
    };

    const originalPower = calcPower(original);
    const correctedPower = calcPower(corrected);

    // 低周波と高周波成分の比率
    const n = original.length;
    const cutoff = Math.floor(n / 10); // 低周波の境界

    let originalLowFreq = 0, originalHighFreq = 0;
    let correctedLowFreq = 0, correctedHighFreq = 0;

    for (let i = 0; i < n / 2; i++) {
      if (i < cutoff) {
        originalLowFreq += originalPower[i];
        correctedLowFreq += correctedPower[i];
      } else {
        originalHighFreq += originalPower[i];
        correctedHighFreq += correctedPower[i];
      }
    }

    return {
      originalLowFreqRatio: originalLowFreq / (originalLowFreq + originalHighFreq),
      correctedLowFreqRatio: correctedLowFreq / (correctedLowFreq + correctedHighFreq),
      lowFreqReduction: (originalLowFreq - correctedLowFreq) / originalLowFreq * 100,
      highFreqPreservation: correctedHighFreq / originalHighFreq * 100
    };
  }

  /**
   * バッチ処理用のALS補正
   */
  static batchCorrection(datasets, options = {}) {
    const results = [];

    for (const dataset of datasets) {
      try {
        const result = this.applyCorrection(dataset.data, {
          ...options,
          verbose: false
        });

        results.push({
          id: dataset.id || `dataset_${results.length}`,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          id: dataset.id || `dataset_${results.length}`,
          success: false,
          error: error.message
        });
      }
    }

    // サマリーの生成
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const summary = {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      averageImprovement: successful.length > 0
        ? successful.reduce((sum, r) => sum + r.result.statistics.improvement, 0) / successful.length
        : 0
    };

    return { results, summary };
  }
}

module.exports = ALSCorrection;