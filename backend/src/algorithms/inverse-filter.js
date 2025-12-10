/**
 * KANA3 逆フィルタ計算モジュール
 * KANA3仕様書に基づく正確な実装
 *
 * 理論:
 * - 測定波形は、真の軌道形状と測定系の周波数特性の畳み込み
 * - 逆フィルタを用いて測定系の影響を除去
 * - 復元帯域内で10m弦正矢測定の逆特性を適用
 *
 * KANA3仕様の特徴:
 * 1. 4領域の周波数応答（遮断→遷移→復元→遷移→遮断）
 * 2. 遷移帯域でのコサインテーパリング
 * 3. 線形位相応答
 * 4. 10m弦正矢の測定特性の逆補正
 */

class InverseFilter {
  constructor(options = {}) {
    // フィルタ次数（奇数でなければならない）
    this.filterOrder = options.filterOrder || 201;
    if (this.filterOrder % 2 === 0) {
      this.filterOrder++; // 奇数に調整
    }

    // サンプリング間隔（m）
    this.samplingInterval = options.samplingInterval || 0.25;

    // 復元帯域の周波数範囲（波長m）
    this.lowerWavelength = options.lowerWavelength || 6.0;  // 下限波長
    this.upperWavelength = options.upperWavelength || 100.0; // 上限波長

    // 遮断帯域の減衰率
    this.stopbandAttenuation = options.stopbandAttenuation || 0.01;

    // 遷移帯域の幅（周波数比）
    this.transitionWidth = options.transitionWidth || 0.1;

    // 線路種別（在来線/新幹線）
    this.railType = options.railType || 'conventional'; // 'conventional' or 'shinkansen'
  }

  /**
   * KANA3仕様に基づく逆フィルタのインパルス応答を計算
   * I(n) = (2/N) Σ |Hi(k)| cos(θi(k) + 2πkn/N) + (1/N)|Hi(0)|cos(θi(0))
   * @returns {Float64Array} インパルス応答
   */
  calculateImpulseResponse() {
    const N = this.filterOrder;
    const impulseResponse = new Float64Array(N);

    // 周波数領域での計算
    for (let n = 0; n < N; n++) {
      let sum = 0;

      // k = 1 to (N-1)/2 までの和
      for (let k = 1; k <= (N - 1) / 2; k++) {
        const amplitude = this.calculateAmplitude(k);
        const phase = this.calculatePhase(k);
        sum += amplitude * Math.cos(phase + 2 * Math.PI * k * n / N);
      }

      // DC成分 (k = 0)
      const dcAmplitude = this.calculateAmplitude(0);
      const dcPhase = this.calculatePhase(0);

      impulseResponse[n] = (2 / N) * sum + (1 / N) * dcAmplitude * Math.cos(dcPhase);
    }

    return impulseResponse;
  }

  /**
   * KANA3仕様の振幅特性 Hi(k) を計算
   * 4つの周波数領域: 遮断帯域 → 遷移帯域 → 復元帯域 → 遷移帯域 → 遮断帯域
   * @param {number} k - 周波数インデックス
   * @returns {number} 振幅
   */
  calculateAmplitude(k) {
    const N = this.filterOrder;
    const wavelength = this.getWavelength(k);

    // 下限遮断周波数
    const LSL = this.lowerWavelength * (1 - this.transitionWidth);
    const LRL = this.lowerWavelength;

    // 上限遮断周波数
    const LRU = this.upperWavelength;
    const LSU = this.upperWavelength * (1 + this.transitionWidth);

    // 周波数領域の判定と振幅計算
    if (wavelength < LSL || wavelength > LSU) {
      // 遮断帯域
      return this.stopbandAttenuation;
    } else if (wavelength >= LSL && wavelength < LRL) {
      // 下側遷移帯域（コサインテーパ）
      const normalized = (wavelength - LSL) / (LRL - LSL);
      return this.stopbandAttenuation +
             (1 - this.stopbandAttenuation) * (1 + Math.cos(Math.PI * (1 - normalized))) / 2;
    } else if (wavelength >= LRL && wavelength <= LRU) {
      // 復元帯域 - 10m弦正矢の測定特性の逆特性
      const measurementResponse = this.getMeasurementResponse(wavelength);
      if (Math.abs(measurementResponse) < 0.001) {
        return 1; // ゼロ点付近では1とする
      }
      return 1 / measurementResponse;
    } else {
      // 上側遷移帯域（コサインテーパ）
      const normalized = (wavelength - LRU) / (LSU - LRU);
      return 1 + (this.stopbandAttenuation - 1) * (1 + Math.cos(Math.PI * normalized)) / 2;
    }
  }

  /**
   * KANA3仕様の位相特性 θi(k) を計算
   * 線形位相応答
   * @param {number} k - 周波数インデックス
   * @returns {number} 位相（ラジアン）
   */
  calculatePhase(k) {
    const N = this.filterOrder;

    if (k <= (N - 1) / 2) {
      return -(N - 1) / N * k * Math.PI;
    } else {
      // 対称性を利用
      return -this.calculatePhase(N - k);
    }
  }

  /**
   * 10m弦正矢測定の応答特性
   * 1 - cos(10π/λ) の形
   * @param {number} wavelength - 波長（m）
   * @returns {number} 応答
   */
  getMeasurementResponse(wavelength) {
    if (wavelength === 0 || !isFinite(wavelength)) return 0;
    return 1 - Math.cos(10 * Math.PI / wavelength);
  }

  /**
   * 周波数インデックスから波長を計算
   * @param {number} k - 周波数インデックス
   * @returns {number} 波長（m）
   */
  getWavelength(k) {
    const N = this.filterOrder;
    if (k === 0) return Infinity;

    const frequency = k / (N * this.samplingInterval);
    return 1 / frequency;
  }

  /**
   * 周波数応答を計算（振幅と位相）
   * @param {number} numPoints - 計算点数
   * @returns {{frequencies: Float32Array, amplitudes: Float32Array, phases: Float32Array}} 周波数応答
   */
  calculateFrequencyResponse(numPoints = 512) {
    const frequencies = new Float32Array(numPoints);
    const amplitudes = new Float32Array(numPoints);
    const phases = new Float32Array(numPoints);

    const fs = 1.0 / this.samplingInterval; // サンプリング周波数
    const df = fs / (2.0 * numPoints);      // 周波数分解能

    for (let i = 0; i < numPoints; i++) {
      const f = i * df;
      frequencies[i] = f;
      amplitudes[i] = this.calculateAmplitudeResponse(f);
      phases[i] = this.calculatePhaseResponse(f);
    }

    return { frequencies, amplitudes, phases };
  }

  /**
   * 復元波形の計算（KANA3仕様）
   * x(n) = Σ I(k) · y(n - k)
   * @param {Array} measuredData - 測定された10m弦正矢データ
   * @returns {Float64Array} 復元波形
   */
  calculateRestorationWaveform(measuredData) {
    const impulseResponse = this.calculateImpulseResponse();
    const N = measuredData.length;
    const M = impulseResponse.length;
    const restoredData = new Float64Array(N);

    // 畳み込み演算
    for (let n = 0; n < N; n++) {
      let sum = 0;

      for (let k = 0; k < M; k++) {
        const dataIndex = n - k + Math.floor(M / 2); // 中心をゼロとする

        if (dataIndex >= 0 && dataIndex < N) {
          sum += impulseResponse[k] * measuredData[dataIndex];
        }
      }

      restoredData[n] = sum;
    }

    return restoredData;
  }

  /**
   * 偏心矢測定特性の計算（KANA3仕様）
   * 複素数解析による正確な計算
   * @param {number} p - 測定点より後方の距離
   * @param {number} q - 測定点より前方の距離
   * @param {number} wavelength - 波長
   * @returns {Object} 振幅と位相
   */
  calculateEccentricResponse(p, q, wavelength) {
    const omega = 2 * Math.PI / wavelength;

    // 複素数解析による振幅計算
    const A = 1 - (p * Math.cos(omega * q) + q * Math.cos(omega * p)) / (p + q);
    const B = (-p * Math.sin(omega * q) + q * Math.sin(omega * p)) / (p + q);

    const amplitude = Math.sqrt(A * A + B * B);
    const phase = Math.atan2(B, A);

    return { amplitude, phase };
  }

  /**
   * 正矢から偏心矢への変換（KANA3仕様）
   * @param {Array} versineData - 10m弦正矢データ
   * @param {number} chordLength - 弦長（通常20m、新幹線40m）
   * @returns {Float64Array} 偏心矢データ
   */
  convertVersineToEccentric(versineData, chordLength = null) {
    // 線路種別に応じた弦長の設定
    if (chordLength === null) {
      chordLength = this.railType === 'shinkansen' ? 40 : 20;
    }

    const N = versineData.length;
    const eccentricData = new Float64Array(N);

    // 弦長の半分
    const halfChord = chordLength / 2;
    const samplesPerMeter = 1 / this.samplingInterval;
    const offset = Math.round(halfChord * samplesPerMeter);

    for (let i = 0; i < N; i++) {
      if (i - offset >= 0 && i + offset < N) {
        // 偏心矢 = 正矢 - (前点 + 後点) / 2
        eccentricData[i] = versineData[i] -
                          (versineData[i - offset] + versineData[i + offset]) / 2;
      } else {
        // 境界処理
        eccentricData[i] = versineData[i];
      }
    }

    return eccentricData;
  }

  /**
   * 縦曲線（勾配変化）の考慮（KANA3仕様）
   * @param {Array} data - 高低データ
   * @param {Array} gradientData - 勾配データ
   * @param {number} verticalCurveRadius - 縦曲線半径（デフォルト3000m）
   * @returns {Float64Array} 縦曲線補正後のデータ
   */
  applyVerticalCurveCorrection(data, gradientData, verticalCurveRadius = 3000) {
    const N = data.length;
    const correctedData = new Float64Array(N);

    for (let i = 1; i < N - 1; i++) {
      // 勾配変化率を計算
      const gradientChange = Math.abs(gradientData[i + 1] - gradientData[i - 1]);

      // 勾配変化が大きい場合は縦曲線半径を調整
      let radius = verticalCurveRadius;
      if (gradientChange > 0.01) {
        // 10‰を超える勾配変化の場合
        radius = 4000;
      }

      // 縦曲線による補正量
      const correction = (this.samplingInterval * this.samplingInterval) / (2 * radius) * 1000;

      correctedData[i] = data[i] - correction;
    }

    // 境界処理
    correctedData[0] = data[0];
    correctedData[N - 1] = data[N - 1];

    return correctedData;
  }

  /**
   * MTT（マルチプルタイタンパー）用データ生成（KANA3仕様）
   * @param {Array} restoredData - 復元波形データ
   * @param {Object} mttConfig - MTT設定（BC距離、CD距離）
   * @returns {Float64Array} MTT用偏心矢データ
   */
  generateMTTData(restoredData, mttConfig) {
    const { bcDistance = 7.5, cdDistance = 7.5 } = mttConfig;
    const N = restoredData.length;
    const mttData = new Float64Array(N);

    const samplesPerMeter = 1 / this.samplingInterval;
    const bcSamples = Math.round(bcDistance * samplesPerMeter);
    const cdSamples = Math.round(cdDistance * samplesPerMeter);

    for (let i = 0; i < N; i++) {
      // B点（後方）
      const bIndex = i - bcSamples - cdSamples;
      // C点（中間）
      const cIndex = i - cdSamples;
      // D点（前方）
      const dIndex = i;

      if (bIndex >= 0 && cIndex >= 0 && dIndex < N) {
        // MTT偏心矢 = D点 - (B点 + C点の重み付き平均)
        const weight = bcDistance / (bcDistance + cdDistance);
        mttData[i] = restoredData[dIndex] -
                     (weight * restoredData[bIndex] + (1 - weight) * restoredData[cIndex]);
      }
    }

    return mttData;
  }

  /**
   * 交差法による整正量計算（KANA3仕様）
   * 「ある点で変位があれば、その点の正矢はその量だけ変化し、
   *  周囲の点は反対方向に半分変化する」という法則
   * @param {Array} planLine - 計画線データ
   * @param {number} interval - 測定間隔（m）
   * @returns {Float64Array} 予測される整正後の波形
   */
  calculateCrossAdjustment(planLine, interval = 1.0) {
    const N = planLine.length;
    const adjustedWaveform = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      const displacement = planLine[i];

      // 現在点の変化
      adjustedWaveform[i] += displacement;

      // 前後の点への影響（反対方向に半分）
      if (i > 0) {
        adjustedWaveform[i - 1] -= displacement / 2;
      }
      if (i < N - 1) {
        adjustedWaveform[i + 1] -= displacement / 2;
      }
    }

    return adjustedWaveform;
  }

  /**
   * フィルタ特性の検証（KANA3仕様）
   * デバッグおよび品質保証用
   * @returns {Object} 検証結果
   */
  validateFilter() {
    const impulseResponse = this.calculateImpulseResponse();
    const N = impulseResponse.length;

    // インパルス応答の対称性チェック
    let symmetryError = 0;
    for (let i = 0; i < Math.floor(N / 2); i++) {
      symmetryError += Math.abs(impulseResponse[i] - impulseResponse[N - 1 - i]);
    }

    // 周波数応答の検証
    const testWavelengths = [5, 6, 10, 20, 40, 50, 100, 200]; // 波長（m）
    const frequencyResponse = {};

    for (const wavelength of testWavelengths) {
      const k = Math.round(this.filterOrder * this.samplingInterval / wavelength);
      frequencyResponse[`${wavelength}m`] = {
        amplitude: this.calculateAmplitude(k),
        phase: this.calculatePhase(k),
        measurementResponse: this.getMeasurementResponse(wavelength)
      };
    }

    return {
      filterOrder: this.filterOrder,
      symmetryError: symmetryError / N,
      frequencyResponse,
      restorationBand: {
        lower: this.lowerWavelength,
        upper: this.upperWavelength
      },
      transitionWidth: this.transitionWidth,
      stopbandAttenuation: this.stopbandAttenuation,
      railType: this.railType
    };
  }

  /**
   * 測定データに逆フィルタを適用して復元波形を計算
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @returns {MeasurementData[]} 復元波形データ配列
   */
  applyToMeasurementData(measurementData) {
    // 測定値のみを抽出
    const values = new Float64Array(measurementData.length);
    for (let i = 0; i < measurementData.length; i++) {
      values[i] = measurementData[i].value;
    }

    // 復元波形を計算
    const restoredValues = this.calculateRestorationWaveform(values);

    // 結果を MeasurementData 形式に変換
    const result = [];
    for (let i = 0; i < measurementData.length; i++) {
      result.push({
        distance: measurementData[i].distance,
        value: parseFloat(restoredValues[i].toFixed(3))
      });
    }

    return result;
  }

  /**
   * フィルタパラメータを取得
   * @returns {Object} パラメータ
   */
  getParameters() {
    return {
      lowerWavelength: this.lowerWavelength,
      upperWavelength: this.upperWavelength,
      samplingInterval: this.samplingInterval,
      filterOrder: this.filterOrder,
      stopbandAttenuation: this.stopbandAttenuation,
      transitionWidth: this.transitionWidth,
      railType: this.railType
    };
  }

  /**
   * フィルタパラメータを設定
   * @param {Object} params - パラメータ
   */
  setParameters(params) {
    if (params.lowerWavelength !== undefined) this.lowerWavelength = params.lowerWavelength;
    if (params.upperWavelength !== undefined) this.upperWavelength = params.upperWavelength;
    if (params.samplingInterval !== undefined) this.samplingInterval = params.samplingInterval;
    if (params.filterOrder !== undefined) {
      this.filterOrder = params.filterOrder;
      // 奇数に調整
      if (this.filterOrder % 2 === 0) {
        this.filterOrder++;
      }
    }
    if (params.stopbandAttenuation !== undefined) this.stopbandAttenuation = params.stopbandAttenuation;
    if (params.transitionWidth !== undefined) this.transitionWidth = params.transitionWidth;
    if (params.railType !== undefined) this.railType = params.railType;
  }
}

module.exports = { InverseFilter };
