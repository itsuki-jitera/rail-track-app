/**
 * FFT処理基盤 (FFT Engine)
 * VB6のCmdLib.bas KFLFFTサブルーチン相当
 *
 * 高速フーリエ変換 (FFT) および逆変換 (IFFT) を実行
 * Cooley-Tukey アルゴリズムを使用
 */

class FFTEngine {
  /**
   * FFT/IFFT実行
   * @param {number[]} realData - 実数部データ
   * @param {number[]} imagData - 虚数部データ (nullの場合は0で初期化)
   * @param {boolean} isInverse - true: IFFT, false: FFT
   * @returns {{real: number[], imag: number[]}}
   */
  static transform(realData, imagData = null, isInverse = false) {
    const n = realData.length;

    // データ長が2のべき乗でない場合はパディング
    const paddedLength = this.nextPowerOfTwo(n);
    const real = new Float64Array(paddedLength);
    const imag = new Float64Array(paddedLength);

    // データコピー
    for (let i = 0; i < n; i++) {
      real[i] = realData[i];
      imag[i] = imagData ? imagData[i] : 0;
    }

    // ビット反転
    this.bitReversal(real, imag);

    // バタフライ演算
    this.butterflyOperation(real, imag, isInverse);

    // IFFT の場合はスケーリング
    if (isInverse) {
      for (let i = 0; i < paddedLength; i++) {
        real[i] /= paddedLength;
        imag[i] /= paddedLength;
      }
    }

    return {
      real: Array.from(real).slice(0, n),
      imag: Array.from(imag).slice(0, n)
    };
  }

  /**
   * 2のべき乗に切り上げ
   */
  static nextPowerOfTwo(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  /**
   * ビット反転処理
   */
  static bitReversal(real, imag) {
    const n = real.length;
    const bits = Math.log2(n);

    for (let i = 0; i < n; i++) {
      const reversed = this.reverseBits(i, bits);
      if (reversed > i) {
        // Swap real
        [real[i], real[reversed]] = [real[reversed], real[i]];
        // Swap imag
        [imag[i], imag[reversed]] = [imag[reversed], imag[i]];
      }
    }
  }

  /**
   * ビット反転
   */
  static reverseBits(num, bits) {
    let result = 0;
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (num & 1);
      num >>= 1;
    }
    return result;
  }

  /**
   * バタフライ演算 (Cooley-Tukey アルゴリズム)
   */
  static butterflyOperation(real, imag, isInverse) {
    const n = real.length;
    const direction = isInverse ? 1 : -1;

    // ステージ数: log2(n)
    for (let stage = 1; stage < n; stage *= 2) {
      const halfStage = stage;
      const fullStage = stage * 2;
      const wAngle = direction * Math.PI / halfStage;
      const wReal = Math.cos(wAngle);
      const wImag = Math.sin(wAngle);

      for (let i = 0; i < n; i += fullStage) {
        let wnReal = 1.0;
        let wnImag = 0.0;

        for (let j = 0; j < halfStage; j++) {
          const idx1 = i + j;
          const idx2 = i + j + halfStage;

          if (idx2 < n) {
            // 複素数乗算: (real[idx2] + i*imag[idx2]) * (wnReal + i*wnImag)
            const tempReal = real[idx2] * wnReal - imag[idx2] * wnImag;
            const tempImag = real[idx2] * wnImag + imag[idx2] * wnReal;

            // バタフライ演算
            real[idx2] = real[idx1] - tempReal;
            imag[idx2] = imag[idx1] - tempImag;
            real[idx1] = real[idx1] + tempReal;
            imag[idx1] = imag[idx1] + tempImag;
          }

          // wn更新: wn *= w
          const wnRealNew = wnReal * wReal - wnImag * wImag;
          const wnImagNew = wnReal * wImag + wnImag * wReal;
          wnReal = wnRealNew;
          wnImag = wnImagNew;
        }
      }
    }
  }

  /**
   * パワースペクトル計算
   * @param {number[]} real - 実数部
   * @param {number[]} imag - 虚数部
   * @returns {number[]} パワースペクトル
   */
  static powerSpectrum(real, imag) {
    const n = real.length;
    const power = new Array(n);

    for (let i = 0; i < n; i++) {
      power[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }

    return power;
  }

  /**
   * 位相スペクトル計算
   * @param {number[]} real - 実数部
   * @param {number[]} imag - 虚数部
   * @returns {number[]} 位相スペクトル (ラジアン)
   */
  static phaseSpectrum(real, imag) {
    const n = real.length;
    const phase = new Array(n);

    for (let i = 0; i < n; i++) {
      phase[i] = Math.atan2(imag[i], real[i]);
    }

    return phase;
  }

  /**
   * 窓関数適用
   * @param {number[]} data - 入力データ
   * @param {string} windowType - 窓関数タイプ ('hanning', 'hamming', 'blackman', 'none')
   * @returns {number[]} 窓関数適用後のデータ
   */
  static applyWindow(data, windowType = 'hanning') {
    const n = data.length;
    const windowed = new Array(n);

    switch (windowType.toLowerCase()) {
      case 'hanning':
        for (let i = 0; i < n; i++) {
          const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
          windowed[i] = data[i] * window;
        }
        break;

      case 'hamming':
        for (let i = 0; i < n; i++) {
          const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1));
          windowed[i] = data[i] * window;
        }
        break;

      case 'blackman':
        for (let i = 0; i < n; i++) {
          const window = 0.42
            - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))
            + 0.08 * Math.cos(4 * Math.PI * i / (n - 1));
          windowed[i] = data[i] * window;
        }
        break;

      case 'none':
      default:
        return [...data];
    }

    return windowed;
  }

  /**
   * 周波数ビンから波長を計算
   * @param {number} binIndex - 周波数ビンのインデックス
   * @param {number} dataLength - データ点数
   * @param {number} samplingInterval - サンプリング間隔 (m)
   * @returns {number} 波長 (m)
   */
  static binToWavelength(binIndex, dataLength, samplingInterval) {
    if (binIndex === 0) return Infinity; // DC成分
    const frequency = binIndex / (dataLength * samplingInterval);
    return 1.0 / frequency;
  }

  /**
   * 波長から周波数ビンを計算
   * @param {number} wavelength - 波長 (m)
   * @param {number} dataLength - データ点数
   * @param {number} samplingInterval - サンプリング間隔 (m)
   * @returns {number} 周波数ビンのインデックス
   */
  static wavelengthToBin(wavelength, dataLength, samplingInterval) {
    if (wavelength === Infinity) return 0;
    const frequency = 1.0 / wavelength;
    return Math.round(frequency * dataLength * samplingInterval);
  }
}

module.exports = FFTEngine;
