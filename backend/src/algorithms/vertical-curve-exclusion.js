/**
 * 10m弦縦曲線除外アルゴリズム
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 高低狂いから縦曲線の線形を除外して復元波形を計算
 * - 10m弦高低の長波長成分を除去
 */

class VerticalCurveExclusion {
  /**
   * 縦曲線除外を適用
   *
   * @param {Array} levelData - 高低狂いデータ
   * @param {Object} options - オプション
   * @returns {Object} 処理結果
   */
  static excludeVerticalCurve(levelData, options = {}) {
    const {
      chordLength = 10,          // 弦長 (m)
      dataInterval = 0.25,        // データ間隔 (m)
      method = 'moving_average',  // 除外方法
      smoothingFactor = 0.5,      // 平滑化係数
      verbose = true
    } = options;

    if (verbose) {
      console.log('縦曲線除外処理開始');
      console.log(`弦長: ${chordLength}m`);
      console.log(`方法: ${method}`);
    }

    // データの正規化
    const normalizedData = this.normalizeData(levelData);

    // 縦曲線成分の抽出
    let verticalCurve;
    switch (method) {
      case 'moving_average':
        verticalCurve = this.extractByMovingAverage(normalizedData, chordLength, dataInterval);
        break;

      case 'polynomial':
        verticalCurve = this.extractByPolynomial(normalizedData, chordLength);
        break;

      case 'spline':
        verticalCurve = this.extractBySpline(normalizedData, chordLength, dataInterval);
        break;

      default:
        throw new Error(`未対応の方法: ${method}`);
    }

    // 平滑化処理
    if (smoothingFactor > 0) {
      verticalCurve = this.smoothCurve(verticalCurve, smoothingFactor);
    }

    // 縦曲線成分を除外
    const excludedData = normalizedData.map((point, i) => ({
      ...point,
      originalValue: point.value,
      verticalCurveValue: verticalCurve[i],
      excludedValue: point.value - verticalCurve[i],
      difference: verticalCurve[i]
    }));

    // 統計情報
    const statistics = this.calculateStatistics(normalizedData, verticalCurve, excludedData);

    if (verbose) {
      console.log('縦曲線除外処理完了');
      console.log(`除外前RMS: ${statistics.original.rms.toFixed(3)}mm`);
      console.log(`除外後RMS: ${statistics.excluded.rms.toFixed(3)}mm`);
      console.log(`改善率: ${statistics.improvement.toFixed(1)}%`);
    }

    return {
      data: excludedData,
      verticalCurve,
      statistics,
      parameters: {
        chordLength,
        dataInterval,
        method,
        smoothingFactor
      }
    };
  }

  /**
   * 移動平均による縦曲線抽出
   */
  static extractByMovingAverage(data, chordLength, dataInterval) {
    const windowSize = Math.round(chordLength / dataInterval);
    const halfWindow = Math.floor(windowSize / 2);
    const curve = new Array(data.length);

    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;

      // ウィンドウ内の平均
      for (let j = Math.max(0, i - halfWindow);
           j <= Math.min(data.length - 1, i + halfWindow); j++) {
        sum += data[j].value;
        count++;
      }

      curve[i] = sum / count;
    }

    return curve;
  }

  /**
   * 多項式フィッティングによる縦曲線抽出
   */
  static extractByPolynomial(data, chordLength) {
    // 適応的な次数決定
    const degree = Math.min(6, Math.floor(data.length / (chordLength * 4)));

    // データ点の位置と値
    const positions = data.map((d, i) => d.position || i * 0.25);
    const values = data.map(d => d.value);

    // 多項式係数の計算
    const coefficients = this.polynomialFit(positions, values, degree);

    // 多項式による値の計算
    const curve = positions.map(pos => {
      let value = 0;
      for (let i = 0; i <= degree; i++) {
        value += coefficients[i] * Math.pow(pos, i);
      }
      return value;
    });

    return curve;
  }

  /**
   * スプライン補間による縦曲線抽出
   */
  static extractBySpline(data, chordLength, dataInterval) {
    const knotInterval = chordLength;  // ノット間隔
    const positions = data.map((d, i) => d.position || i * dataInterval);
    const values = data.map(d => d.value);

    // ノット点の選択
    const knots = [];
    const knotValues = [];

    for (let i = 0; i < positions.length; i += Math.round(knotInterval / dataInterval)) {
      knots.push(positions[i]);

      // ノット点での値は周辺の平均
      const startIdx = Math.max(0, i - 5);
      const endIdx = Math.min(positions.length - 1, i + 5);
      const localAvg = values.slice(startIdx, endIdx + 1)
        .reduce((sum, v) => sum + v, 0) / (endIdx - startIdx + 1);

      knotValues.push(localAvg);
    }

    // 最後の点を確保
    if (knots[knots.length - 1] !== positions[positions.length - 1]) {
      knots.push(positions[positions.length - 1]);
      const lastValues = values.slice(-10);
      knotValues.push(lastValues.reduce((sum, v) => sum + v, 0) / lastValues.length);
    }

    // スプライン補間
    const spline = this.cubicSpline(knots, knotValues);
    const curve = positions.map(pos => this.evaluateSpline(spline, pos));

    return curve;
  }

  /**
   * 10m弦高低の計算
   * 実際の測定と同様の処理
   */
  static calculate10mChordLevel(data, dataInterval = 0.25) {
    const chordLength = 10;  // 10m弦
    const chordPoints = Math.round(chordLength / dataInterval);
    const halfChord = Math.floor(chordPoints / 2);

    const chordLevel = new Array(data.length);

    for (let i = 0; i < data.length; i++) {
      if (i < halfChord || i >= data.length - halfChord) {
        // 端部は処理不可
        chordLevel[i] = {
          position: data[i].position,
          value: 0,
          valid: false
        };
      } else {
        // 10m弦の両端の値
        const leftValue = data[i - halfChord].value;
        const rightValue = data[i + halfChord].value;

        // 中央の値
        const centerValue = data[i].value;

        // 10m弦高低 = 中央値 - (左端 + 右端) / 2
        const chord = centerValue - (leftValue + rightValue) / 2;

        chordLevel[i] = {
          position: data[i].position,
          value: chord,
          valid: true,
          originalValue: centerValue
        };
      }
    }

    return chordLevel;
  }

  /**
   * 縦曲線の勾配計算
   */
  static calculateGradient(verticalCurve, dataInterval = 0.25) {
    const gradients = new Array(verticalCurve.length);

    for (let i = 0; i < verticalCurve.length; i++) {
      if (i === 0) {
        // 前進差分
        gradients[i] = (verticalCurve[i + 1] - verticalCurve[i]) / dataInterval;
      } else if (i === verticalCurve.length - 1) {
        // 後退差分
        gradients[i] = (verticalCurve[i] - verticalCurve[i - 1]) / dataInterval;
      } else {
        // 中心差分
        gradients[i] = (verticalCurve[i + 1] - verticalCurve[i - 1]) / (2 * dataInterval);
      }

      // 勾配を1/1000単位（‰）に変換
      gradients[i] = gradients[i] * 1000;
    }

    return gradients;
  }

  /**
   * 縦曲線の曲率計算
   */
  static calculateCurvature(verticalCurve, dataInterval = 0.25) {
    const curvatures = new Array(verticalCurve.length);

    for (let i = 0; i < verticalCurve.length; i++) {
      if (i === 0 || i === verticalCurve.length - 1) {
        curvatures[i] = 0;
      } else {
        // 2階差分による曲率近似
        const secondDerivative = (verticalCurve[i + 1] - 2 * verticalCurve[i] + verticalCurve[i - 1])
                                / (dataInterval * dataInterval);

        // 曲率半径 (m)
        const radius = Math.abs(1 / secondDerivative);

        curvatures[i] = {
          curvature: secondDerivative,
          radius: radius > 100000 ? Infinity : radius,  // 非常に大きい半径は無限大とする
          type: secondDerivative > 0 ? 'sag' : 'crest'  // 凹/凸
        };
      }
    }

    return curvatures;
  }

  /**
   * データの正規化
   */
  static normalizeData(data) {
    if (!data || data.length === 0) {
      return [];
    }

    if (typeof data[0] === 'number') {
      return data.map((value, index) => ({
        position: index * 0.25,
        value
      }));
    }

    return data.map((item, index) => ({
      position: item.position !== undefined ? item.position : index * 0.25,
      value: item.value || item
    }));
  }

  /**
   * 曲線の平滑化
   */
  static smoothCurve(curve, factor) {
    const smoothed = [...curve];
    const iterations = Math.ceil(factor * 5);

    for (let iter = 0; iter < iterations; iter++) {
      const temp = [...smoothed];

      for (let i = 1; i < smoothed.length - 1; i++) {
        smoothed[i] = temp[i - 1] * 0.25 + temp[i] * 0.5 + temp[i + 1] * 0.25;
      }
    }

    return smoothed;
  }

  /**
   * 多項式フィッティング
   */
  static polynomialFit(x, y, degree) {
    const n = x.length;
    const matrix = [];
    const vector = [];

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

    return this.gaussElimination(matrix, vector);
  }

  /**
   * ガウス消去法
   */
  static gaussElimination(matrix, vector) {
    const n = vector.length;
    const augmented = matrix.map((row, i) => [...row, vector[i]]);

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

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
   * キュービックスプライン
   */
  static cubicSpline(x, y) {
    const n = x.length;
    const h = [];
    const alpha = [];
    const l = [1];
    const mu = [0];
    const z = [0];

    for (let i = 0; i < n - 1; i++) {
      h[i] = x[i + 1] - x[i];
    }

    for (let i = 1; i < n - 1; i++) {
      alpha[i] = (3 / h[i]) * (y[i + 1] - y[i]) - (3 / h[i - 1]) * (y[i] - y[i - 1]);
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

    let i = 0;
    for (let j = 0; j < x.length - 1; j++) {
      if (pos >= x[j] && pos <= x[j + 1]) {
        i = j;
        break;
      }
    }

    if (pos < x[0]) i = 0;
    if (pos > x[x.length - 1]) i = x.length - 2;

    const dx = pos - x[i];
    return y[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  }

  /**
   * 統計情報の計算
   */
  static calculateStatistics(originalData, verticalCurve, excludedData) {
    const calcStats = (values) => {
      const n = values.length;
      const mean = values.reduce((sum, val) => sum + val, 0) / n;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      const rms = Math.sqrt(values.reduce((sum, val) => sum + val * val, 0) / n);
      const min = Math.min(...values);
      const max = Math.max(...values);

      return { mean, stdDev, rms, min, max, range: max - min };
    };

    const originalValues = originalData.map(d => d.value);
    const excludedValues = excludedData.map(d => d.excludedValue);

    const originalStats = calcStats(originalValues);
    const verticalCurveStats = calcStats(verticalCurve);
    const excludedStats = calcStats(excludedValues);

    const improvement = (1 - excludedStats.rms / originalStats.rms) * 100;

    return {
      original: originalStats,
      verticalCurve: verticalCurveStats,
      excluded: excludedStats,
      improvement,
      reductionRatio: excludedStats.rms / originalStats.rms
    };
  }
}

module.exports = VerticalCurveExclusion;