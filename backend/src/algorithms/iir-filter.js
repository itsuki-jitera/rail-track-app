/**
 * IIR (Infinite Impulse Response) フィルタ実装
 * IIR Filter Implementation
 *
 * KANA3システムの高精度IIRフィルタリング機能
 */

class IIRFilter {
  constructor(options = {}) {
    this.samplingFrequency = options.samplingFrequency || 4; // Hz
    this.filterOrder = options.filterOrder || 4; // フィルタ次数
  }

  /**
   * バターワースフィルタ係数の計算
   *
   * @param {number} cutoffFreq - カットオフ周波数 (Hz)
   * @param {string} filterType - 'lowpass', 'highpass', 'bandpass', 'bandstop'
   * @param {number} highCutoff - バンドパス/ストップ用の上限周波数
   * @returns {Object} フィルタ係数 {a, b}
   */
  butterworthCoefficients(cutoffFreq, filterType = 'lowpass', highCutoff = null) {
    const nyquist = this.samplingFrequency / 2;
    const normalizedFreq = cutoffFreq / nyquist;

    switch (filterType) {
      case 'lowpass':
        return this.butterworthLowpass(normalizedFreq);
      case 'highpass':
        return this.butterworthHighpass(normalizedFreq);
      case 'bandpass':
        const normalizedHigh = highCutoff / nyquist;
        return this.butterworthBandpass(normalizedFreq, normalizedHigh);
      case 'bandstop':
        const normalizedHighStop = highCutoff / nyquist;
        return this.butterworthBandstop(normalizedFreq, normalizedHighStop);
      default:
        throw new Error(`Unknown filter type: ${filterType}`);
    }
  }

  /**
   * バターワースローパスフィルタ係数
   */
  butterworthLowpass(wc) {
    const n = this.filterOrder;
    const a = new Array(n + 1);
    const b = new Array(n + 1);

    // プリワーピング
    const T = 2; // サンプリング周期の正規化
    const wa = (2 / T) * Math.tan((wc * Math.PI) / 2);

    // アナログフィルタのポール計算
    const poles = [];
    for (let k = 0; k < n; k++) {
      const angle = Math.PI * (2 * k + 1) / (2 * n);
      poles.push({
        real: -wa * Math.sin(angle),
        imag: wa * Math.cos(angle)
      });
    }

    // 双一次変換
    const K = wa * T / 2;

    // 2次フィルタの場合の簡略化実装
    if (n === 2) {
      const K2 = K * K;
      const sqrt2K = Math.sqrt(2) * K;

      const norm = 1 + sqrt2K + K2;

      b[0] = K2 / norm;
      b[1] = 2 * K2 / norm;
      b[2] = K2 / norm;

      a[0] = 1;
      a[1] = (2 * K2 - 2) / norm;
      a[2] = (1 - sqrt2K + K2) / norm;
    } else {
      // 高次フィルタの一般的な実装
      this.calculateGeneralCoefficients(poles, K, a, b);
    }

    return { a, b };
  }

  /**
   * バターワースハイパスフィルタ係数
   */
  butterworthHighpass(wc) {
    const n = this.filterOrder;
    const a = new Array(n + 1);
    const b = new Array(n + 1);

    // プリワーピング
    const T = 2;
    const wa = (2 / T) * Math.tan((wc * Math.PI) / 2);

    // 2次フィルタの場合
    if (n === 2) {
      const K = wa * T / 2;
      const K2 = K * K;
      const sqrt2K = Math.sqrt(2) * K;

      const norm = 1 + sqrt2K + K2;

      b[0] = 1 / norm;
      b[1] = -2 / norm;
      b[2] = 1 / norm;

      a[0] = 1;
      a[1] = (2 * K2 - 2) / norm;
      a[2] = (1 - sqrt2K + K2) / norm;
    }

    return { a, b };
  }

  /**
   * バターワースバンドパスフィルタ係数
   */
  butterworthBandpass(wcLow, wcHigh) {
    // 簡略化: ローパスとハイパスの組み合わせ
    const lowpass = this.butterworthLowpass(wcHigh);
    const highpass = this.butterworthHighpass(wcLow);

    // カスケード接続の係数を計算
    return this.cascadeFilters(lowpass, highpass);
  }

  /**
   * バターワースバンドストップフィルタ係数
   */
  butterworthBandstop(wcLow, wcHigh) {
    const n = 2; // 簡略化のため2次フィルタ
    const a = new Array(n + 1);
    const b = new Array(n + 1);

    const wl = wcLow * Math.PI;
    const wh = wcHigh * Math.PI;
    const bw = wh - wl;
    const w0 = Math.sqrt(wl * wh);

    const Q = w0 / bw;
    const K = Math.tan(w0 / 2);
    const K2 = K * K;

    const norm = 1 + K / Q + K2;

    b[0] = (1 + K2) / norm;
    b[1] = 2 * (K2 - 1) / norm;
    b[2] = (1 + K2) / norm;

    a[0] = 1;
    a[1] = 2 * (K2 - 1) / norm;
    a[2] = (1 - K / Q + K2) / norm;

    return { a, b };
  }

  /**
   * チェビシェフタイプIフィルタ係数
   *
   * @param {number} cutoffFreq - カットオフ周波数
   * @param {number} ripple - リップル (dB)
   * @param {string} filterType - フィルタタイプ
   * @returns {Object} フィルタ係数
   */
  chebyshevCoefficients(cutoffFreq, ripple = 0.5, filterType = 'lowpass') {
    const nyquist = this.samplingFrequency / 2;
    const normalizedFreq = cutoffFreq / nyquist;
    const n = this.filterOrder;

    // リップルパラメータ
    const epsilon = Math.sqrt(Math.pow(10, ripple / 10) - 1);

    // ポール計算
    const poles = [];
    for (let k = 0; k < n; k++) {
      const alpha = (2 * k + 1) * Math.PI / (2 * n);
      const sinh_val = Math.sinh(Math.asinh(1 / epsilon) / n);
      const cosh_val = Math.cosh(Math.asinh(1 / epsilon) / n);

      poles.push({
        real: -sinh_val * Math.sin(alpha) * normalizedFreq,
        imag: cosh_val * Math.cos(alpha) * normalizedFreq
      });
    }

    // 係数計算（簡略化）
    const a = new Array(n + 1);
    const b = new Array(n + 1);

    if (filterType === 'lowpass' && n === 2) {
      // 2次チェビシェフローパス
      const omega = 2 * Math.PI * normalizedFreq;
      const K = Math.tan(omega / 2);
      const K2 = K * K;

      const gain = K2 / (1 + Math.sqrt(2 * epsilon) * K + K2);

      b[0] = gain;
      b[1] = 2 * gain;
      b[2] = gain;

      a[0] = 1;
      a[1] = 2 * (K2 - 1) / (1 + Math.sqrt(2 * epsilon) * K + K2);
      a[2] = (1 - Math.sqrt(2 * epsilon) * K + K2) / (1 + Math.sqrt(2 * epsilon) * K + K2);
    }

    return { a, b };
  }

  /**
   * IIRフィルタの適用
   *
   * @param {Array} signal - 入力信号
   * @param {Object} coefficients - フィルタ係数 {a, b}
   * @returns {Array} フィルタリング後の信号
   */
  applyFilter(signal, coefficients) {
    const { a, b } = coefficients;
    const N = signal.length;
    const order = Math.max(a.length, b.length) - 1;

    // 出力信号の初期化
    const output = new Float32Array(N);

    // 初期条件（ゼロ）
    const x_history = new Float32Array(order + 1);
    const y_history = new Float32Array(order + 1);

    // フィルタリング処理
    for (let n = 0; n < N; n++) {
      // 入力履歴を更新
      for (let i = order; i > 0; i--) {
        x_history[i] = x_history[i - 1];
      }
      x_history[0] = signal[n];

      // 出力を計算
      let y = 0;

      // フィードフォワード部分
      for (let i = 0; i < b.length && i <= n; i++) {
        y += b[i] * x_history[i];
      }

      // フィードバック部分
      for (let i = 1; i < a.length && i <= n; i++) {
        y -= a[i] * y_history[i - 1];
      }

      // a[0]で正規化（通常は1）
      y /= a[0];

      output[n] = y;

      // 出力履歴を更新
      for (let i = order - 1; i > 0; i--) {
        y_history[i] = y_history[i - 1];
      }
      y_history[0] = y;
    }

    return output;
  }

  /**
   * ゼロ位相フィルタリング（前後方向フィルタ）
   *
   * @param {Array} signal - 入力信号
   * @param {Object} coefficients - フィルタ係数
   * @returns {Array} ゼロ位相フィルタリング後の信号
   */
  filtfilt(signal, coefficients) {
    // 順方向フィルタリング
    const forward = this.applyFilter(signal, coefficients);

    // 信号を反転
    const reversed = forward.slice().reverse();

    // 逆方向フィルタリング
    const backward = this.applyFilter(reversed, coefficients);

    // 再度反転して元の順序に戻す
    return backward.reverse();
  }

  /**
   * カスケード接続されたフィルタの係数計算
   */
  cascadeFilters(filter1, filter2) {
    // 簡略化: 2つの2次フィルタのカスケード
    const a = new Array(5); // 4次フィルタ
    const b = new Array(5);

    // 畳み込みによる係数計算
    a[0] = filter1.a[0] * filter2.a[0];
    a[1] = filter1.a[0] * filter2.a[1] + filter1.a[1] * filter2.a[0];
    a[2] = filter1.a[0] * filter2.a[2] + filter1.a[1] * filter2.a[1] + filter1.a[2] * filter2.a[0];
    a[3] = filter1.a[1] * filter2.a[2] + filter1.a[2] * filter2.a[1];
    a[4] = filter1.a[2] * filter2.a[2];

    b[0] = filter1.b[0] * filter2.b[0];
    b[1] = filter1.b[0] * filter2.b[1] + filter1.b[1] * filter2.b[0];
    b[2] = filter1.b[0] * filter2.b[2] + filter1.b[1] * filter2.b[1] + filter1.b[2] * filter2.b[0];
    b[3] = filter1.b[1] * filter2.b[2] + filter1.b[2] * filter2.b[1];
    b[4] = filter1.b[2] * filter2.b[2];

    // 正規化
    for (let i = 1; i < 5; i++) {
      a[i] /= a[0];
      b[i] /= a[0];
    }
    b[0] /= a[0];
    a[0] = 1;

    return { a, b };
  }

  /**
   * フィルタの周波数応答を計算
   *
   * @param {Object} coefficients - フィルタ係数
   * @param {number} nPoints - 評価点数
   * @returns {Object} 周波数応答
   */
  frequencyResponse(coefficients, nPoints = 512) {
    const { a, b } = coefficients;
    const frequencies = new Float32Array(nPoints);
    const magnitude = new Float32Array(nPoints);
    const phase = new Float32Array(nPoints);

    for (let i = 0; i < nPoints; i++) {
      const omega = (i / nPoints) * Math.PI; // 0 to π (正規化周波数)
      frequencies[i] = (i / nPoints) * this.samplingFrequency / 2;

      // 伝達関数 H(z) = B(z) / A(z) を z = e^(jω) で評価
      let numeratorReal = 0, numeratorImag = 0;
      let denominatorReal = 0, denominatorImag = 0;

      for (let k = 0; k < b.length; k++) {
        numeratorReal += b[k] * Math.cos(-k * omega);
        numeratorImag += b[k] * Math.sin(-k * omega);
      }

      for (let k = 0; k < a.length; k++) {
        denominatorReal += a[k] * Math.cos(-k * omega);
        denominatorImag += a[k] * Math.sin(-k * omega);
      }

      // 複素数の除算
      const denomMag = denominatorReal * denominatorReal + denominatorImag * denominatorImag;
      const hReal = (numeratorReal * denominatorReal + numeratorImag * denominatorImag) / denomMag;
      const hImag = (numeratorImag * denominatorReal - numeratorReal * denominatorImag) / denomMag;

      // 振幅と位相
      magnitude[i] = Math.sqrt(hReal * hReal + hImag * hImag);
      phase[i] = Math.atan2(hImag, hReal) * 180 / Math.PI;
    }

    return {
      frequencies: Array.from(frequencies),
      magnitude: Array.from(magnitude),
      phase: Array.from(phase),
      magnitudeDB: Array.from(magnitude).map(m => 20 * Math.log10(m))
    };
  }

  /**
   * 適応的IIRフィルタリング
   * 信号特性に基づいて自動的にフィルタを設計
   *
   * @param {Array} signal - 入力信号
   * @returns {Object} フィルタリング結果
   */
  adaptiveIIRFilter(signal) {
    // 簡易的なノイズ推定
    const variance = this.calculateVariance(signal);
    const stdDev = Math.sqrt(variance);

    // 信号の変動に基づいてフィルタ強度を決定
    let cutoffRatio;
    if (stdDev < 0.5) {
      // 低ノイズ: 緩いフィルタ
      cutoffRatio = 0.4;
    } else if (stdDev < 1.0) {
      // 中ノイズ: 中程度のフィルタ
      cutoffRatio = 0.3;
    } else {
      // 高ノイズ: 強いフィルタ
      cutoffRatio = 0.2;
    }

    const cutoffFreq = this.samplingFrequency * cutoffRatio;

    // バターワースフィルタを設計
    const coefficients = this.butterworthCoefficients(cutoffFreq, 'lowpass');

    // ゼロ位相フィルタリング
    const filtered = this.filtfilt(signal, coefficients);

    return {
      filteredSignal: filtered,
      cutoffFrequency: cutoffFreq,
      filterType: 'Butterworth Lowpass',
      order: this.filterOrder,
      variance,
      stdDev
    };
  }

  /**
   * 分散計算
   */
  calculateVariance(signal) {
    const n = signal.length;
    let mean = 0;
    for (let i = 0; i < n; i++) {
      mean += signal[i];
    }
    mean /= n;

    let variance = 0;
    for (let i = 0; i < n; i++) {
      variance += Math.pow(signal[i] - mean, 2);
    }
    variance /= n;

    return variance;
  }

  /**
   * 一般的な係数計算（高次フィルタ用）
   */
  calculateGeneralCoefficients(poles, K, a, b) {
    // プレースホルダー: 実際の実装は複雑な数学計算が必要
    const n = poles.length;

    // デフォルト値を設定
    for (let i = 0; i <= n; i++) {
      a[i] = 0;
      b[i] = 0;
    }
    a[0] = 1;
    b[0] = Math.pow(K, n);

    // 簡略化した実装
    for (let i = 1; i <= n; i++) {
      b[i] = b[0]; // すべて同じゲイン
      a[i] = Math.pow(-1, i) * (n - i + 1) / n;
    }
  }
}

module.exports = { IIRFilter };