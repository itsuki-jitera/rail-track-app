/**
 * FFTベース高度復元フィルタ
 * FFT-based Advanced Restoration Filter
 *
 * KANA3システムの高精度フィルタリング機能を実装
 */

class FFTFilter {
  constructor(options = {}) {
    this.samplingFrequency = options.samplingFrequency || 4; // Hz (0.25m間隔で1m/s = 4Hz)
    this.windowFunction = options.windowFunction || 'hanning'; // 窓関数
  }

  /**
   * 離散フーリエ変換 (DFT)
   * JavaScript実装のため、高速フーリエ変換の簡易版
   *
   * @param {Array} signal - 入力信号
   * @returns {Array} 周波数領域データ
   */
  fft(signal) {
    const N = signal.length;
    const X = new Array(N);

    // ゼロパディングで2のべき乗にする
    const paddedN = this.nextPowerOf2(N);
    const paddedSignal = new Float32Array(paddedN);
    for (let i = 0; i < N; i++) {
      paddedSignal[i] = signal[i];
    }

    // Cooley-Tukey FFTアルゴリズム
    const result = this.fftRecursive(paddedSignal);

    // 元のサイズに切り詰め
    for (let k = 0; k < N; k++) {
      X[k] = result[k];
    }

    return X;
  }

  /**
   * 再帰的FFT実装 (Cooley-Tukey)
   */
  fftRecursive(x) {
    const N = x.length;

    // ベースケース
    if (N <= 1) {
      return x.map(val => ({ real: val, imag: 0 }));
    }

    // 偶数・奇数インデックスで分割
    const even = new Float32Array(N / 2);
    const odd = new Float32Array(N / 2);
    for (let i = 0; i < N / 2; i++) {
      even[i] = x[2 * i];
      odd[i] = x[2 * i + 1];
    }

    // 再帰的にFFT
    const evenFFT = this.fftRecursive(even);
    const oddFFT = this.fftRecursive(odd);

    // 結果を結合
    const result = new Array(N);
    for (let k = 0; k < N / 2; k++) {
      const angle = -2 * Math.PI * k / N;
      const twiddle = {
        real: Math.cos(angle),
        imag: Math.sin(angle)
      };

      const oddTwiddle = this.complexMultiply(oddFFT[k], twiddle);

      result[k] = this.complexAdd(evenFFT[k], oddTwiddle);
      result[k + N / 2] = this.complexSubtract(evenFFT[k], oddTwiddle);
    }

    return result;
  }

  /**
   * 逆離散フーリエ変換 (IDFT)
   *
   * @param {Array} spectrum - 周波数領域データ
   * @returns {Array} 時間領域信号
   */
  ifft(spectrum) {
    const N = spectrum.length;
    const signal = new Float32Array(N);

    // 複素共役を取る
    const conjugate = spectrum.map(s => ({
      real: s.real,
      imag: -s.imag
    }));

    // FFTを実行
    const result = this.fftRecursive(conjugate);

    // 結果を正規化して実部を取る
    for (let n = 0; n < N; n++) {
      signal[n] = result[n].real / N;
    }

    return signal;
  }

  /**
   * ローパスフィルタ
   *
   * @param {Array} signal - 入力信号
   * @param {number} cutoffFrequency - カットオフ周波数 (Hz)
   * @returns {Array} フィルタリング後の信号
   */
  lowpassFilter(signal, cutoffFrequency) {
    const N = signal.length;

    // 窓関数を適用
    const windowedSignal = this.applyWindow(signal);

    // FFT実行
    const spectrum = this.fft(windowedSignal);

    // 周波数領域でフィルタリング
    const filteredSpectrum = new Array(N);
    const nyquistFreq = this.samplingFrequency / 2;

    for (let k = 0; k < N; k++) {
      const frequency = k * this.samplingFrequency / N;

      if (frequency <= cutoffFrequency || frequency >= this.samplingFrequency - cutoffFrequency) {
        // パスバンド
        filteredSpectrum[k] = spectrum[k];
      } else {
        // ストップバンド
        filteredSpectrum[k] = { real: 0, imag: 0 };
      }
    }

    // 逆FFT
    const filtered = this.ifft(filteredSpectrum);

    return filtered;
  }

  /**
   * ハイパスフィルタ
   *
   * @param {Array} signal - 入力信号
   * @param {number} cutoffFrequency - カットオフ周波数 (Hz)
   * @returns {Array} フィルタリング後の信号
   */
  highpassFilter(signal, cutoffFrequency) {
    const N = signal.length;

    // 窓関数を適用
    const windowedSignal = this.applyWindow(signal);

    // FFT実行
    const spectrum = this.fft(windowedSignal);

    // 周波数領域でフィルタリング
    const filteredSpectrum = new Array(N);

    for (let k = 0; k < N; k++) {
      const frequency = k * this.samplingFrequency / N;

      if (frequency >= cutoffFrequency && frequency <= this.samplingFrequency - cutoffFrequency) {
        // パスバンド
        filteredSpectrum[k] = spectrum[k];
      } else {
        // ストップバンド
        filteredSpectrum[k] = { real: 0, imag: 0 };
      }
    }

    // 逆FFT
    const filtered = this.ifft(filteredSpectrum);

    return filtered;
  }

  /**
   * バンドパスフィルタ
   *
   * @param {Array} signal - 入力信号
   * @param {number} lowFreq - 下限周波数 (Hz)
   * @param {number} highFreq - 上限周波数 (Hz)
   * @returns {Array} フィルタリング後の信号
   */
  bandpassFilter(signal, lowFreq, highFreq) {
    const N = signal.length;

    // 窓関数を適用
    const windowedSignal = this.applyWindow(signal);

    // FFT実行
    const spectrum = this.fft(windowedSignal);

    // 周波数領域でフィルタリング
    const filteredSpectrum = new Array(N);

    for (let k = 0; k < N; k++) {
      const frequency = k * this.samplingFrequency / N;

      if (frequency >= lowFreq && frequency <= highFreq) {
        // パスバンド
        filteredSpectrum[k] = spectrum[k];
      } else {
        // ストップバンド
        filteredSpectrum[k] = { real: 0, imag: 0 };
      }
    }

    // 逆FFT
    const filtered = this.ifft(filteredSpectrum);

    return filtered;
  }

  /**
   * バンドストップフィルタ（ノッチフィルタ）
   *
   * @param {Array} signal - 入力信号
   * @param {number} centerFreq - 中心周波数 (Hz)
   * @param {number} bandwidth - 帯域幅 (Hz)
   * @returns {Array} フィルタリング後の信号
   */
  bandstopFilter(signal, centerFreq, bandwidth) {
    const N = signal.length;
    const lowFreq = centerFreq - bandwidth / 2;
    const highFreq = centerFreq + bandwidth / 2;

    // 窓関数を適用
    const windowedSignal = this.applyWindow(signal);

    // FFT実行
    const spectrum = this.fft(windowedSignal);

    // 周波数領域でフィルタリング
    const filteredSpectrum = new Array(N);

    for (let k = 0; k < N; k++) {
      const frequency = k * this.samplingFrequency / N;

      if (frequency >= lowFreq && frequency <= highFreq) {
        // ストップバンド
        filteredSpectrum[k] = { real: 0, imag: 0 };
      } else {
        // パスバンド
        filteredSpectrum[k] = spectrum[k];
      }
    }

    // 逆FFT
    const filtered = this.ifft(filteredSpectrum);

    return filtered;
  }

  /**
   * 窓関数の適用
   *
   * @param {Array} signal - 入力信号
   * @returns {Array} 窓関数適用後の信号
   */
  applyWindow(signal) {
    const N = signal.length;
    const windowed = new Float32Array(N);

    switch (this.windowFunction) {
      case 'hanning':
        // ハニング窓
        for (let n = 0; n < N; n++) {
          const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / (N - 1));
          windowed[n] = signal[n] * window;
        }
        break;

      case 'hamming':
        // ハミング窓
        for (let n = 0; n < N; n++) {
          const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * n / (N - 1));
          windowed[n] = signal[n] * window;
        }
        break;

      case 'blackman':
        // ブラックマン窓
        for (let n = 0; n < N; n++) {
          const window = 0.42 - 0.5 * Math.cos(2 * Math.PI * n / (N - 1))
                        + 0.08 * Math.cos(4 * Math.PI * n / (N - 1));
          windowed[n] = signal[n] * window;
        }
        break;

      case 'rectangular':
      default:
        // 矩形窓（窓関数なし）
        for (let n = 0; n < N; n++) {
          windowed[n] = signal[n];
        }
        break;
    }

    return windowed;
  }

  /**
   * スペクトル解析
   *
   * @param {Array} signal - 入力信号
   * @returns {Object} スペクトル情報
   */
  spectralAnalysis(signal) {
    const N = signal.length;
    const spectrum = this.fft(signal);

    // パワースペクトル計算
    const powerSpectrum = new Float32Array(N / 2);
    const frequencies = new Float32Array(N / 2);

    for (let k = 0; k < N / 2; k++) {
      const real = spectrum[k].real;
      const imag = spectrum[k].imag;
      powerSpectrum[k] = Math.sqrt(real * real + imag * imag) * 2 / N;
      frequencies[k] = k * this.samplingFrequency / N;
    }

    // 主要周波数の検出
    let maxPower = 0;
    let dominantFrequency = 0;
    for (let k = 1; k < N / 2; k++) { // DCを除く
      if (powerSpectrum[k] > maxPower) {
        maxPower = powerSpectrum[k];
        dominantFrequency = frequencies[k];
      }
    }

    // 波長に変換（速度1m/sと仮定）
    const dominantWavelength = dominantFrequency > 0 ? 1 / dominantFrequency : Infinity;

    return {
      powerSpectrum: Array.from(powerSpectrum),
      frequencies: Array.from(frequencies),
      dominantFrequency,
      dominantWavelength,
      maxPower
    };
  }

  /**
   * 適応的フィルタリング
   * 信号の特性に基づいて自動的にフィルタパラメータを調整
   *
   * @param {Array} signal - 入力信号
   * @returns {Object} フィルタリング結果と推奨パラメータ
   */
  adaptiveFiltering(signal) {
    // スペクトル解析
    const analysis = this.spectralAnalysis(signal);

    // ノイズレベルの推定（高周波成分の平均）
    const highFreqStart = Math.floor(analysis.frequencies.length * 0.7);
    let noiseLevel = 0;
    for (let i = highFreqStart; i < analysis.powerSpectrum.length; i++) {
      noiseLevel += analysis.powerSpectrum[i];
    }
    noiseLevel /= (analysis.powerSpectrum.length - highFreqStart);

    // 信号レベルの推定（主要周波数付近）
    const signalLevel = analysis.maxPower;

    // SNR計算
    const snr = signalLevel / noiseLevel;

    // 推奨カットオフ周波数の決定
    let recommendedCutoff;
    if (snr > 10) {
      // 高SNR: 緩いフィルタ
      recommendedCutoff = this.samplingFrequency * 0.4;
    } else if (snr > 5) {
      // 中SNR: 中程度のフィルタ
      recommendedCutoff = this.samplingFrequency * 0.3;
    } else {
      // 低SNR: 強いフィルタ
      recommendedCutoff = this.samplingFrequency * 0.2;
    }

    // フィルタリング実行
    const filtered = this.lowpassFilter(signal, recommendedCutoff);

    return {
      filteredSignal: filtered,
      analysis,
      snr,
      recommendedCutoff,
      noiseLevel,
      signalLevel
    };
  }

  /**
   * 複素数の乗算
   */
  complexMultiply(a, b) {
    return {
      real: a.real * b.real - a.imag * b.imag,
      imag: a.real * b.imag + a.imag * b.real
    };
  }

  /**
   * 複素数の加算
   */
  complexAdd(a, b) {
    return {
      real: a.real + b.real,
      imag: a.imag + b.imag
    };
  }

  /**
   * 複素数の減算
   */
  complexSubtract(a, b) {
    return {
      real: a.real - b.real,
      imag: a.imag - b.imag
    };
  }

  /**
   * 次の2のべき乗を取得
   */
  nextPowerOf2(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
}

module.exports = { FFTFilter };