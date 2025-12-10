/**
 * Bs05アルゴリズム - 曲線部バス補正
 * Bass Curve Correction Algorithm for Railway Track Alignment
 *
 * 目的:
 * - 曲線区間における軌道狂いの補正
 * - カント（軌道の傾斜）とスラック（軌間拡大）を考慮した補正
 * - 曲線半径に応じた理論バス値との差分を計算
 *
 * アルゴリズム概要:
 * 1. 曲線区間の特定（BTC, BCC, ECC, ETC）
 * 2. 曲線半径からの理論バス値計算
 * 3. 測定バス値と理論値との差分計算
 * 4. 補正後の軌道データ生成
 *
 * パラメータ:
 * - BTC: Begin of Transition Curve (緩和曲線始点)
 * - BCC: Begin of Circular Curve (円曲線始点)
 * - ECC: End of Circular Curve (円曲線終点)
 * - ETC: End of Transition Curve (緩和曲線終点)
 */

class Bs05Algorithm {
  constructor(options = {}) {
    // 軌間（mm）
    this.gaugeStandard = options.gaugeStandard || 1067.0;

    // 計算精度
    this.precision = options.precision || 3;

    // デフォルトの曲線パラメータ
    this.defaultCurveParams = {
      radius: 400.0,        // 曲線半径（m）
      cant: 80.0,           // カント（mm）
      slack: 10.0,          // スラック（mm）
      transitionLength: 40.0 // 緩和曲線長（m）
    };
  }

  /**
   * 曲線半径から理論バス値を計算
   * バス = (L^2) / (24 * R) + C
   * ここで:
   * - L: 弦長（m）
   * - R: 曲線半径（m）
   * - C: カント補正値（mm）
   *
   * @param {number} radius - 曲線半径（m）
   * @param {number} chordLength - 弦長（m）
   * @param {number} cant - カント（mm）
   * @returns {number} 理論バス値（mm）
   */
  calculateTheoreticalBass(radius, chordLength, cant = 0) {
    if (radius === 0 || radius === Infinity) {
      return 0;
    }

    // 基本バス値の計算
    const bassValue = (chordLength * chordLength) / (24.0 * radius) * 1000.0;

    // カント補正
    const cantCorrection = cant * 0.01; // カントの1%を補正値として使用

    return bassValue + cantCorrection;
  }

  /**
   * 緩和曲線区間でのバス値を計算
   * 緩和曲線では、バス値は距離に応じて線形的に変化
   *
   * @param {number} distance - 緩和曲線内の距離（m）
   * @param {number} transitionLength - 緩和曲線長（m）
   * @param {number} maxBass - 円曲線部の最大バス値（mm）
   * @returns {number} 緩和曲線でのバス値（mm）
   */
  calculateTransitionBass(distance, transitionLength, maxBass) {
    if (transitionLength === 0) return 0;

    // 線形補間
    const ratio = distance / transitionLength;
    return maxBass * ratio;
  }

  /**
   * 曲線情報から距離ごとの理論バス値を計算
   *
   * @param {CurveInfo} curveInfo - 曲線情報
   * @param {number[]} distances - 距離配列（m）
   * @returns {number[]} 各距離での理論バス値配列（mm）
   */
  calculateBassProfile(curveInfo, distances) {
    const {
      btc,              // 緩和曲線始点（m）
      bcc,              // 円曲線始点（m）
      ecc,              // 円曲線終点（m）
      etc,              // 緩和曲線終点（m）
      radius,           // 曲線半径（m）
      cant,             // カント（mm）
      chordLength       // 弦長（m、デフォルト10m）
    } = curveInfo;

    const chord = chordLength || 10.0;
    const bassProfile = [];

    // 円曲線部の最大バス値
    const maxBass = this.calculateTheoreticalBass(radius, chord, cant);

    // 緩和曲線長
    const transitionLength = bcc - btc;

    for (const distance of distances) {
      let bassValue = 0;

      if (distance < btc || distance > etc) {
        // 直線区間
        bassValue = 0;
      } else if (distance >= btc && distance < bcc) {
        // 始端緩和曲線
        const transitionDistance = distance - btc;
        bassValue = this.calculateTransitionBass(transitionDistance, transitionLength, maxBass);
      } else if (distance >= bcc && distance <= ecc) {
        // 円曲線
        bassValue = maxBass;
      } else if (distance > ecc && distance <= etc) {
        // 終端緩和曲線
        const transitionDistance = etc - distance;
        bassValue = this.calculateTransitionBass(transitionDistance, transitionLength, maxBass);
      }

      bassProfile.push(parseFloat(bassValue.toFixed(this.precision)));
    }

    return bassProfile;
  }

  /**
   * Bs05補正を適用
   * 測定データから理論バス値を差し引いて補正データを生成
   *
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {CurveInfo[]} curveInfoList - 曲線情報配列
   * @returns {Bs05Result} 補正結果
   */
  applyCorrection(measurementData, curveInfoList) {
    const correctedData = [];
    const bassProfile = new Array(measurementData.length).fill(0);

    // 距離配列を抽出
    const distances = measurementData.map(d => d.distance);

    // 各曲線について理論バス値を計算
    for (const curveInfo of curveInfoList) {
      const curveBassProfile = this.calculateBassProfile(curveInfo, distances);

      // 重ね合わせ（複数の曲線が重なる場合は加算）
      for (let i = 0; i < bassProfile.length; i++) {
        bassProfile[i] += curveBassProfile[i];
      }
    }

    // 補正データの生成（測定値 - 理論バス値）
    for (let i = 0; i < measurementData.length; i++) {
      const correctedValue = measurementData[i].value - bassProfile[i];

      correctedData.push({
        distance: measurementData[i].distance,
        value: parseFloat(correctedValue.toFixed(this.precision)),
        originalValue: measurementData[i].value,
        bassCorrection: bassProfile[i]
      });
    }

    // 統計情報の計算
    const statistics = this.calculateStatistics(correctedData);

    return {
      success: true,
      correctedData,
      bassProfile: bassProfile.map((value, i) => ({
        distance: distances[i],
        value: parseFloat(value.toFixed(this.precision))
      })),
      statistics,
      curveCount: curveInfoList.length
    };
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
   * 単一曲線のBs05補正（簡易版）
   *
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {Object} curveParams - 曲線パラメータ
   * @returns {Bs05Result} 補正結果
   */
  applySingleCurveCorrection(measurementData, curveParams = {}) {
    // パラメータのマージ
    const params = { ...this.defaultCurveParams, ...curveParams };

    // データ範囲の取得
    const startDistance = measurementData[0].distance;
    const endDistance = measurementData[measurementData.length - 1].distance;
    const totalLength = endDistance - startDistance;

    // 曲線を中央に配置
    const curveLength = params.transitionLength * 2 + 100.0; // 緩和曲線×2 + 円曲線100m
    const curveStart = startDistance + (totalLength - curveLength) / 2;

    const curveInfo = {
      btc: curveStart,
      bcc: curveStart + params.transitionLength,
      ecc: curveStart + params.transitionLength + 100.0,
      etc: curveStart + curveLength,
      radius: params.radius,
      cant: params.cant,
      chordLength: 10.0
    };

    return this.applyCorrection(measurementData, [curveInfo]);
  }

  /**
   * バス補正の逆演算（補正データから元データを復元）
   *
   * @param {MeasurementData[]} correctedData - 補正済みデータ
   * @param {MeasurementData[]} bassProfile - バスプロファイル
   * @returns {MeasurementData[]} 復元データ
   */
  reverseCorrection(correctedData, bassProfile) {
    const restoredData = [];

    for (let i = 0; i < correctedData.length; i++) {
      const restoredValue = correctedData[i].value + bassProfile[i].value;

      restoredData.push({
        distance: correctedData[i].distance,
        value: parseFloat(restoredValue.toFixed(this.precision))
      });
    }

    return restoredData;
  }

  /**
   * アルゴリズム情報を取得
   *
   * @returns {Object} アルゴリズム情報
   */
  getAlgorithmInfo() {
    return {
      name: 'Bs05',
      version: '1.0.0',
      description: '曲線部バス補正アルゴリズム',
      author: 'Rail Track Restoration System',
      parameters: {
        gaugeStandard: this.gaugeStandard,
        precision: this.precision
      }
    };
  }
}

module.exports = { Bs05Algorithm };
