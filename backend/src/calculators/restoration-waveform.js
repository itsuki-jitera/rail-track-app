/**
 * 復元波形計算エンジン
 *
 * 復元波形とは:
 * - 測定データから特定波長範囲（6m-40m）の成分を抽出した波形
 * - MTTによる保守作業で実現可能な理論的な軌道形状を表す
 */

import FFT from 'fft.js';

export class RestorationWaveformCalculator {
  constructor(options = {}) {
    // 復元波長範囲（デフォルト: 在来線）
    this.minWavelength = options.minWavelength || 6.0;   // m
    this.maxWavelength = options.maxWavelength || 40.0;  // m

    // サンプリング間隔（m）
    this.samplingInterval = options.samplingInterval || 0.25;  // 25cm
  }

  /**
   * 復元波形を計算（メイン処理）
   *
   * @param {Array} measurementData - [{ distance, value }] 形式の測定データ
   * @returns {Object} 計算結果
   */
  calculate(measurementData) {
    try {
      // 1. データの前処理（等間隔リサンプリング）
      console.log('Step 1: リサンプリング...');
      const sampledData = this.resample(measurementData, this.samplingInterval);
      console.log(`  → ${sampledData.length}点にリサンプリング完了`);

      // 2. FFTで周波数領域に変換
      console.log('Step 2: FFT実行...');
      const fftResult = this.applyFFT(sampledData);
      console.log(`  → FFTサイズ: ${fftResult.n}`);

      // 3. バンドパスフィルタ適用
      console.log('Step 3: バンドパスフィルタ適用...');
      const filtered = this.applyBandpassFilter(fftResult);
      console.log(`  → 波長範囲: ${this.minWavelength}m - ${this.maxWavelength}m`);
      console.log(`  → 周波数範囲: ${filtered.filterInfo.minFreq.toFixed(3)}Hz - ${filtered.filterInfo.maxFreq.toFixed(3)}Hz`);

      // 4. 逆FFTで復元波形を取得
      console.log('Step 4: 逆FFT実行...');
      const restorationWaveform = this.applyInverseFFT(filtered);
      console.log(`  → 復元波形: ${restorationWaveform.length}点`);

      // 5. ゼロクロス点検出
      console.log('Step 5: ゼロクロス点検出...');
      const zeroCrossPoints = this.detectZeroCrossings(restorationWaveform);
      console.log(`  → ${zeroCrossPoints.length}点のゼロクロスを検出`);

      // 6. 計画線生成
      console.log('Step 6: 計画線生成...');
      const planLine = this.generatePlanLine(restorationWaveform, zeroCrossPoints);
      console.log(`  → 計画線: ${planLine.length}点`);

      // 7. 移動量計算
      console.log('Step 7: 移動量計算...');
      const movementAmounts = this.calculateMovementAmounts(restorationWaveform, planLine);
      console.log(`  → 移動量: ${movementAmounts.length}点`);

      // 元のデータ範囲に合わせて切り詰め
      const minDist = Math.min(...measurementData.map(d => d.distance));
      const maxDist = Math.max(...measurementData.map(d => d.distance));

      const trimmedRestorationWaveform = restorationWaveform.filter(
        d => d.distance >= minDist && d.distance <= maxDist
      );
      const trimmedPlanLine = planLine.filter(
        d => d.distance >= minDist && d.distance <= maxDist
      );
      const trimmedMovementAmounts = movementAmounts.filter(
        d => d.distance >= minDist && d.distance <= maxDist
      );

      console.log('計算完了!');

      return {
        success: true,
        data: {
          restorationWaveform: trimmedRestorationWaveform,
          planLine: trimmedPlanLine,
          movementAmounts: trimmedMovementAmounts,
          zeroCrossPoints: zeroCrossPoints,
          filterInfo: filtered.filterInfo,
          metadata: {
            originalDataPoints: measurementData.length,
            resampledDataPoints: sampledData.length,
            fftSize: fftResult.n,
            zeroCrossCount: zeroCrossPoints.length,
            minWavelength: this.minWavelength,
            maxWavelength: this.maxWavelength,
            samplingInterval: this.samplingInterval
          }
        }
      };
    } catch (error) {
      console.error('復元波形計算エラー:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * データを等間隔にリサンプリング
   *
   * @param {Array} data - [{ distance: number, value: number }] 形式の測定データ
   * @param {number} interval - リサンプリング間隔（m）
   * @returns {Array} リサンプリング後のデータ
   */
  resample(data, interval = this.samplingInterval) {
    if (!data || data.length === 0) {
      throw new Error('データが空です');
    }

    // 距離範囲を取得
    const minDist = Math.min(...data.map(d => d.distance));
    const maxDist = Math.max(...data.map(d => d.distance));

    // リサンプリング点数を計算
    const numPoints = Math.floor((maxDist - minDist) / interval) + 1;

    const resampled = [];
    for (let i = 0; i < numPoints; i++) {
      const targetDist = minDist + i * interval;
      const value = this.interpolate(data, targetDist);

      resampled.push({
        distance: targetDist,
        value: value
      });
    }

    return resampled;
  }

  /**
   * 線形補間
   *
   * @param {Array} data - 元データ
   * @param {number} targetDist - 補間したい距離
   * @returns {number} 補間された値
   */
  interpolate(data, targetDist) {
    // 最も近い2点を探して線形補間
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i].distance <= targetDist && data[i + 1].distance >= targetDist) {
        const dist1 = data[i].distance;
        const dist2 = data[i + 1].distance;
        const val1 = data[i].value;
        const val2 = data[i + 1].value;

        // 線形補間の公式
        const ratio = (targetDist - dist1) / (dist2 - dist1);
        return val1 + ratio * (val2 - val1);
      }
    }

    // 範囲外の場合は最も近い端点の値を返す
    if (targetDist < data[0].distance) {
      return data[0].value;
    }
    return data[data.length - 1].value;
  }

  /**
   * 次の2のべき乗数を取得（FFT用）
   *
   * @param {number} n - 元の数
   * @returns {number} n以上の最小の2のべき乗数
   */
  nextPowerOf2(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  /**
   * FFT（高速フーリエ変換）を適用
   *
   * @param {Array} data - リサンプリング済みデータ
   * @returns {Object} FFT結果 { output, n, samplingInterval }
   */
  applyFFT(data) {
    // FFTのサイズを2のべき乗に調整
    const n = this.nextPowerOf2(data.length);
    const fft = new FFT(n);

    // 実数データを複素数形式に変換 [実部, 虚部, 実部, 虚部, ...]
    const input = new Array(n * 2).fill(0);
    data.forEach((d, i) => {
      if (i < data.length) {
        input[i * 2] = d.value;     // 実部
        input[i * 2 + 1] = 0;       // 虚部
      }
    });

    // FFT実行
    const output = fft.createComplexArray();
    fft.transform(output, input);

    return {
      output: output,
      n: n,
      samplingInterval: this.samplingInterval,
      fftInstance: fft
    };
  }

  /**
   * バンドパスフィルタを適用
   *
   * 復元波長範囲（6m-40m）の周波数成分のみを残し、それ以外をカット
   *
   * @param {Object} fftResult - FFT結果
   * @returns {Object} フィルタリング後のFFT結果
   */
  applyBandpassFilter(fftResult) {
    const { output, n, samplingInterval, fftInstance } = fftResult;

    // サンプリング周波数（Hz）
    const samplingFreq = 1.0 / samplingInterval;  // 1サンプル = 0.25m → 4サンプル/m

    // 波長 → 周波数変換
    // 波長が長い = 周波数が低い、波長が短い = 周波数が高い
    const minFreq = 1.0 / this.maxWavelength;  // 40m波長 = 0.025 Hz
    const maxFreq = 1.0 / this.minWavelength;  // 6m波長 = 0.167 Hz

    // フィルタリング: バンドパス範囲外の周波数成分をゼロに
    const filteredOutput = [...output];  // コピーを作成

    for (let i = 0; i < n; i++) {
      // 各周波数ビンの周波数を計算
      const freq = (i * samplingFreq) / n;

      // バンドパス範囲外の場合、実部・虚部をゼロに
      if (freq < minFreq || freq > maxFreq) {
        filteredOutput[i * 2] = 0;      // 実部
        filteredOutput[i * 2 + 1] = 0;  // 虚部
      }
    }

    return {
      output: filteredOutput,
      n: n,
      samplingInterval: samplingInterval,
      fftInstance: fftInstance,
      filterInfo: {
        minFreq: minFreq,
        maxFreq: maxFreq,
        minWavelength: this.minWavelength,
        maxWavelength: this.maxWavelength
      }
    };
  }

  /**
   * 逆FFT（逆高速フーリエ変換）を適用
   *
   * @param {Object} fftResult - FFT結果
   * @returns {Array} 逆FFTで復元された波形データ
   */
  applyInverseFFT(fftResult) {
    const { output, n, fftInstance } = fftResult;

    // 逆FFT実行
    const result = fftInstance.createComplexArray();
    fftInstance.inverseTransform(result, output);

    // 実部のみ取り出して波形データに変換
    const waveform = [];
    for (let i = 0; i < n; i++) {
      waveform.push({
        distance: i * this.samplingInterval,
        value: result[i * 2] / n  // 正規化（FFTのスケーリング補正）
      });
    }

    return waveform;
  }

  /**
   * ゼロクロス点を検出
   *
   * 復元波形が0を横切る点を検出する
   * これらの点を結ぶことで計画線を生成する
   *
   * @param {Array} waveform - 復元波形データ
   * @returns {Array} ゼロクロス点の配列
   */
  detectZeroCrossings(waveform) {
    const crossings = [];

    for (let i = 0; i < waveform.length - 1; i++) {
      const curr = waveform[i].value;
      const next = waveform[i + 1].value;

      // 符号が変わった点 = ゼロクロス点
      if ((curr >= 0 && next < 0) || (curr < 0 && next >= 0)) {
        // 線形補間でゼロクロス点の正確な距離を計算
        const ratio = Math.abs(curr) / (Math.abs(curr) + Math.abs(next));
        const crossDist = waveform[i].distance + ratio * this.samplingInterval;

        crossings.push({
          distance: crossDist,
          index: i,
          type: curr >= 0 ? 'descending' : 'ascending'  // 下降 or 上昇
        });
      }
    }

    return crossings;
  }

  /**
   * 計画線を生成
   *
   * ゼロクロス点を結んで計画線を作成
   * ゼロクロス点間は線形補間（勾配一定）
   *
   * @param {Array} waveform - 復元波形データ（距離の基準として使用）
   * @param {Array} zeroCrossPoints - ゼロクロス点
   * @returns {Array} 計画線データ
   */
  generatePlanLine(waveform, zeroCrossPoints) {
    if (zeroCrossPoints.length === 0) {
      // ゼロクロス点がない場合は全てゼロの線を返す
      return waveform.map(p => ({ distance: p.distance, value: 0 }));
    }

    const planLine = [];

    // 最初のゼロクロス点より前は、最初のクロス点の値（0）を維持
    for (const point of waveform) {
      if (point.distance < zeroCrossPoints[0].distance) {
        planLine.push({ distance: point.distance, value: 0 });
      } else {
        break;
      }
    }

    // ゼロクロス点間を線形補間
    for (let i = 0; i < zeroCrossPoints.length - 1; i++) {
      const p1 = zeroCrossPoints[i];
      const p2 = zeroCrossPoints[i + 1];

      for (const point of waveform) {
        if (point.distance >= p1.distance && point.distance < p2.distance) {
          // ゼロ点間は常にゼロ（ゼロ点を結ぶため）
          planLine.push({ distance: point.distance, value: 0 });
        }
      }
    }

    // 最後のゼロクロス点より後も0を維持
    const lastCrossing = zeroCrossPoints[zeroCrossPoints.length - 1];
    for (const point of waveform) {
      if (point.distance >= lastCrossing.distance) {
        planLine.push({ distance: point.distance, value: 0 });
      }
    }

    return planLine;
  }

  /**
   * 移動量を計算
   *
   * 移動量 = 復元波形 - 計画線
   *
   * @param {Array} restorationWaveform - 復元波形
   * @param {Array} planLine - 計画線
   * @returns {Array} 移動量データ
   */
  calculateMovementAmounts(restorationWaveform, planLine) {
    const movements = [];

    const minLength = Math.min(restorationWaveform.length, planLine.length);

    for (let i = 0; i < minLength; i++) {
      movements.push({
        distance: restorationWaveform[i].distance,
        amount: restorationWaveform[i].value - planLine[i].value
      });
    }

    return movements;
  }
}

export default RestorationWaveformCalculator;
