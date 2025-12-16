/**
 * 復元逆フィルター演算 (Restoration Filter)
 * VB6仕様書「250904_05_仕様書_復元波形の計算.pdf」に基づく実装
 *
 * 復元波形計算: x(n) = Σ I(k)·y(n-k)
 * インパルス応答: I(n) = (2/N) Σ |Hi(k)| cos(θi(k) + 2πkn/N)
 * 振幅特性: Hi(k) = 1 / (1 - cos(10πk/(NΔd)))
 */

const FFTEngine = require('./fft-engine');

class RestorationFilter {
  /**
   * 復元波形計算のデフォルトパラメータ
   */
  static DEFAULT_PARAMS = {
    // 通り (Alignment)
    alignment: {
      lambdaLower: 6.0,    // 復元波長下限 (m)
      lambdaUpper: 100.0,  // 復元波長上限 (m)
      dataInterval: 0.25   // データ間隔 (m)
    },
    // 高低 (Level)
    level: {
      lambdaLower: 3.5,    // 復元波長下限 (m) - 新幹線
      lambdaUpper: 40.0,   // 復元波長上限 (m)
      dataInterval: 0.25   // データ間隔 (m)
    },
    // 水準 (Cross Level)
    crossLevel: {
      lambdaLower: 3.5,
      lambdaUpper: 40.0,
      dataInterval: 0.25
    },
    // 平面性 (Twist)
    twist: {
      lambdaLower: 3.5,
      lambdaUpper: 40.0,
      dataInterval: 0.25
    }
  };

  /**
   * 復元波形計算のメイン関数
   * @param {number[]|Array<{distance: number, value: number}>} measurementData - 検測データ
   * @param {object} params - パラメータ { lambdaLower, lambdaUpper, dataInterval, dataType }
   * @returns {object} { restoredWaveform, impulseResponse, filterInfo, statistics }
   */
  static calculateRestorationWaveform(measurementData, params) {
    const {
      lambdaLower = 6.0,
      lambdaUpper = 100.0,
      dataInterval = 0.25,
      dataType = 'alignment'
    } = params;

    // measurementDataをnumber[]に変換
    let dataArray;
    if (measurementData && measurementData.length > 0) {
      if (typeof measurementData[0] === 'object' && 'value' in measurementData[0]) {
        // { distance, value }形式の場合
        dataArray = measurementData.map(item => item.value || 0);
        console.log(`測定データを{ distance, value }形式から数値配列に変換しました。データ数: ${dataArray.length}`);
        console.log(`最初の5つの値: ${dataArray.slice(0, 5).join(', ')}`);
        console.log(`データの範囲: 最小=${Math.min(...dataArray)}, 最大=${Math.max(...dataArray)}`);
      } else {
        // 既に数値配列の場合
        dataArray = measurementData;
        console.log(`測定データは既に数値配列です。データ数: ${dataArray.length}`);
      }
    } else {
      console.error('測定データが空です');
      return {
        success: false,
        error: '測定データが空です',
        restoredWaveform: [],
        statistics: { mean: 0, sigma: 0, rms: 0, min: 0, max: 0, count: 0 }
      };
    }

    const n = dataArray.length;
    console.log(`処理するデータ点数: ${n}, データ間隔: ${dataInterval}m`);

    // 1. インパルス応答の計算
    const impulseResponse = this.calculateImpulseResponse(
      n,
      dataInterval,
      lambdaLower,
      lambdaUpper
    );
    console.log(`インパルス応答計算完了。長さ: ${impulseResponse.length}`);
    console.log(`インパルス応答の最初の5つ: ${impulseResponse.slice(0, 5).join(', ')}`);

    // 2. 復元波形の計算 (畳み込み演算)
    const restoredWaveform = this.applyRestorationFilter(
      dataArray,  // 変換済みの数値配列を使用
      impulseResponse
    );
    console.log(`復元波形計算完了。長さ: ${restoredWaveform.length}`);
    console.log(`復元波形の最初の5つ: ${restoredWaveform.slice(0, 5).join(', ')}`);
    console.log(`復元波形の範囲: 最小=${Math.min(...restoredWaveform)}, 最大=${Math.max(...restoredWaveform)}`);

    // 3. 統計情報の計算
    const statistics = this.calculateStatistics(restoredWaveform);
    console.log(`統計情報: 平均=${statistics.mean.toFixed(3)}, σ=${statistics.sigma.toFixed(3)}, RMS=${statistics.rms.toFixed(3)}`);

    // 4. フィルタ情報
    const filterInfo = {
      lambdaLower,
      lambdaUpper,
      dataInterval,
      dataType,
      dataLength: n,
      impulseResponseLength: impulseResponse.length
    };

    return {
      success: true,
      restoredWaveform,
      impulseResponse,
      filterInfo,
      statistics
    };
  }

  /**
   * インパルス応答 I(n) の計算
   * VB6仕様書の式:
   * I(n) = (2/N) Σ(k=1 to (N-1)/2) |Hi(k)| cos(θi(k) + 2πkn/N) + (1/N)|Hi(0)|cos(θi(0))
   *
   * @param {number} N - データ点数
   * @param {number} deltaD - データ間隔 (m)
   * @param {number} lambdaLower - 復元波長下限 (m)
   * @param {number} lambdaUpper - 復元波長上限 (m)
   * @returns {number[]} インパルス応答
   */
  static calculateImpulseResponse(N, deltaD, lambdaLower, lambdaUpper) {
    // FFT長
    const fftLength = FFTEngine.nextPowerOfTwo(N);

    // 復元帯域の周波数ビン範囲計算
    // 波長 λ に対応する周波数ビンは k = fftLength * deltaD / λ
    const kRU = Math.max(1, Math.ceil(fftLength * deltaD / lambdaUpper));  // 上限波長 → 下限周波数
    const kRL = Math.min(Math.floor(fftLength / 2), Math.floor(fftLength * deltaD / lambdaLower));  // 下限波長 → 上限周波数

    // デバッグ情報
    // console.log(`復元帯域: kRU=${kRU}, kRL=${kRL} (波長 ${lambdaLower}m-${lambdaUpper}m)`);

    // 振幅特性 Hi(k) の計算（周波数領域）
    const realFreq = new Float64Array(fftLength);
    const imagFreq = new Float64Array(fftLength);

    for (let k = 0; k < fftLength; k++) {
      if (k >= kRU && k <= kRL) {
        // 復元帯域内: Hi(k) = 1.0 (単純なバンドパスフィルタ)
        // より高度なフィルタ特性は後で実装可能
        realFreq[k] = 1.0;
        imagFreq[k] = 0.0;
      } else {
        realFreq[k] = 0.0;
        imagFreq[k] = 0.0;
      }
    }

    // 対称性を保つため、負の周波数成分も設定
    for (let k = 1; k < fftLength / 2; k++) {
      realFreq[fftLength - k] = realFreq[k];
      imagFreq[fftLength - k] = -imagFreq[k];
    }

    // IFFT でインパルス応答を計算
    const ifftResult = FFTEngine.transform(realFreq, imagFreq, true);

    // 実数部のみを取得（虚数部は理論的には0に近いはず）
    return Array.from(ifftResult.real).slice(0, N);
  }

  /**
   * 復元フィルタの適用 (畳み込み演算)
   * 復元波形: x(n) = Σ(k=0 to N-1) I(k) · y(n-k)
   *
   * @param {number[]} measurementData - 検測データ y(n)
   * @param {number[]} impulseResponse - インパルス応答 I(n)
   * @returns {number[]} 復元波形 x(n)
   */
  static applyRestorationFilter(measurementData, impulseResponse) {
    const dataLength = measurementData.length;
    const filterLength = impulseResponse.length;
    const restoredWaveform = new Array(dataLength);

    for (let n = 0; n < dataLength; n++) {
      let sum = 0.0;

      for (let k = 0; k < filterLength; k++) {
        const dataIndex = n - k;
        if (dataIndex >= 0 && dataIndex < dataLength) {
          sum += impulseResponse[k] * measurementData[dataIndex];
        }
      }

      restoredWaveform[n] = sum;
    }

    return restoredWaveform;
  }

  /**
   * FFTベースの高速畳み込み演算
   * 大量データの場合はこちらを使用 (O(N log N))
   *
   * @param {number[]} signal - 入力信号
   * @param {number[]} impulseResponse - インパルス応答
   * @returns {number[]} 畳み込み結果
   */
  static fastConvolution(signal, impulseResponse) {
    const n = signal.length;
    const m = impulseResponse.length;
    const fftLength = FFTEngine.nextPowerOfTwo(n + m - 1);

    // ゼロパディング
    const paddedSignal = [...signal, ...new Array(fftLength - n).fill(0)];
    const paddedImpulse = [...impulseResponse, ...new Array(fftLength - m).fill(0)];

    // FFT
    const fftSignal = FFTEngine.transform(paddedSignal, null, false);
    const fftImpulse = FFTEngine.transform(paddedImpulse, null, false);

    // 周波数領域での乗算
    const realProduct = new Array(fftLength);
    const imagProduct = new Array(fftLength);

    for (let i = 0; i < fftLength; i++) {
      realProduct[i] = fftSignal.real[i] * fftImpulse.real[i]
                     - fftSignal.imag[i] * fftImpulse.imag[i];
      imagProduct[i] = fftSignal.real[i] * fftImpulse.imag[i]
                     + fftSignal.imag[i] * fftImpulse.real[i];
    }

    // IFFT
    const result = FFTEngine.transform(realProduct, imagProduct, true);

    return result.real.slice(0, n);
  }

  /**
   * バンドパスフィルタ適用 (周波数領域)
   * @param {number[]} data - 入力データ
   * @param {number} dataInterval - データ間隔 (m)
   * @param {number} lambdaLower - 波長下限 (m)
   * @param {number} lambdaUpper - 波長上限 (m)
   * @returns {number[]} フィルタ適用後のデータ
   */
  static applyBandpassFilter(data, dataInterval, lambdaLower, lambdaUpper) {
    const n = data.length;
    const fftLength = FFTEngine.nextPowerOfTwo(n);

    // FFT
    const fft = FFTEngine.transform(data, null, false);

    // バンドパスフィルタ適用
    const kLower = FFTEngine.wavelengthToBin(lambdaUpper, fftLength, dataInterval);
    const kUpper = FFTEngine.wavelengthToBin(lambdaLower, fftLength, dataInterval);

    for (let k = 0; k < fftLength; k++) {
      if (k < kLower || k > kUpper) {
        fft.real[k] = 0;
        fft.imag[k] = 0;
      }
    }

    // IFFT
    const filtered = FFTEngine.transform(fft.real, fft.imag, true);

    return filtered.real.slice(0, n);
  }

  /**
   * 統計情報の計算
   * @param {number[]} data - データ
   * @returns {object} { mean, sigma, rms, min, max, count }
   */
  static calculateStatistics(data) {
    const n = data.length;
    if (n === 0) {
      return { mean: 0, sigma: 0, rms: 0, min: 0, max: 0, count: 0 };
    }

    // 平均値
    const mean = data.reduce((sum, val) => sum + val, 0) / n;

    // 標準偏差 (σ値)
    const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n;
    const sigma = Math.sqrt(variance);

    // RMS (二乗平均平方根)
    const rms = Math.sqrt(data.reduce((sum, val) => sum + val ** 2, 0) / n);

    // 最小値・最大値
    const min = Math.min(...data);
    const max = Math.max(...data);

    return {
      mean,
      sigma,
      rms,
      min,
      max,
      count: n
    };
  }

  /**
   * データタイプ別のデフォルトパラメータ取得
   * @param {string} dataType - 'alignment', 'level', 'crossLevel', 'twist'
   * @returns {object} パラメータ
   */
  static getDefaultParams(dataType) {
    return this.DEFAULT_PARAMS[dataType] || this.DEFAULT_PARAMS.alignment;
  }
}

module.exports = RestorationFilter;
