/**
 * 自動パラメータ推定器
 * Automatic Parameter Estimator
 *
 * 信号特性に基づいて最適なフィルタパラメータや偏心矢パラメータを自動推定
 */

const { FFTFilter } = require('./fft-filter');
const { IIRFilter } = require('./iir-filter');
const { EccentricVersine } = require('./eccentric-versine');

class ParameterEstimator {
  constructor(options = {}) {
    this.samplingInterval = options.samplingInterval || 0.25; // m
    this.samplingFrequency = 1 / this.samplingInterval;

    // 評価用のフィルタインスタンス
    this.fftFilter = new FFTFilter({ samplingFrequency: this.samplingFrequency });
    this.iirFilter = new IIRFilter({ samplingFrequency: this.samplingFrequency });
    this.versineCalculator = new EccentricVersine({ samplingInterval: this.samplingInterval });
  }

  /**
   * 信号特性の総合分析と最適パラメータの推定
   *
   * @param {Array} signal - 入力信号
   * @returns {Object} 推定された最適パラメータセット
   */
  async estimateOptimalParameters(signal) {
    console.log('自動パラメータ推定を開始します...');

    // 1. 信号特性の分析
    const signalCharacteristics = this.analyzeSignalCharacteristics(signal);

    // 2. フィルタパラメータの推定
    const filterParams = this.estimateFilterParameters(signal, signalCharacteristics);

    // 3. 偏心矢パラメータの推定
    const versineParams = this.estimateVersineParameters(signal, signalCharacteristics);

    // 4. パラメータの最適化（グリッドサーチ）
    const optimizedParams = await this.optimizeParameters(
      signal,
      filterParams,
      versineParams,
      signalCharacteristics
    );

    // 5. 推定結果の検証
    const validation = this.validateParameters(signal, optimizedParams);

    return {
      signalCharacteristics,
      recommendedParameters: optimizedParams,
      validation,
      confidence: this.calculateConfidence(validation)
    };
  }

  /**
   * 信号特性の分析
   *
   * @param {Array} signal - 入力信号
   * @returns {Object} 信号特性
   */
  analyzeSignalCharacteristics(signal) {
    const characteristics = {
      length: signal.length,
      distance: signal.length * this.samplingInterval
    };

    // 基本統計
    characteristics.statistics = this.calculateStatistics(signal);

    // スペクトル分析
    const spectralAnalysis = this.fftFilter.spectralAnalysis(signal);
    characteristics.spectral = {
      dominantFrequency: spectralAnalysis.dominantFrequency,
      dominantWavelength: spectralAnalysis.dominantWavelength,
      powerDistribution: this.analyzePowerDistribution(spectralAnalysis)
    };

    // ノイズ特性
    characteristics.noise = this.analyzeNoise(signal, spectralAnalysis);

    // 信号の複雑度
    characteristics.complexity = this.calculateComplexity(signal);

    // トレンド分析
    characteristics.trend = this.analyzeTrend(signal);

    // 周期性
    characteristics.periodicity = this.analyzePeriodicity(signal);

    return characteristics;
  }

  /**
   * フィルタパラメータの推定
   *
   * @param {Array} signal - 入力信号
   * @param {Object} characteristics - 信号特性
   * @returns {Object} 推定フィルタパラメータ
   */
  estimateFilterParameters(signal, characteristics) {
    const params = {
      filterType: 'auto',
      cutoffFrequency: null,
      filterOrder: 2,
      windowFunction: 'hanning'
    };

    // ノイズレベルに基づくカットオフ周波数の決定
    const snr = characteristics.spectral.dominantFrequency > 0
      ? characteristics.statistics.max / characteristics.noise.level
      : 10;

    if (snr > 20) {
      // 高SNR: 緩いフィルタ
      params.cutoffFrequency = this.samplingFrequency * 0.45;
      params.filterOrder = 2;
    } else if (snr > 10) {
      // 中SNR: 中程度のフィルタ
      params.cutoffFrequency = this.samplingFrequency * 0.35;
      params.filterOrder = 3;
    } else if (snr > 5) {
      // 低SNR: 強いフィルタ
      params.cutoffFrequency = this.samplingFrequency * 0.25;
      params.filterOrder = 4;
    } else {
      // 非常に低いSNR: 非常に強いフィルタ
      params.cutoffFrequency = this.samplingFrequency * 0.15;
      params.filterOrder = 6;
    }

    // 支配的周波数が存在する場合の調整
    if (characteristics.spectral.dominantFrequency > 0) {
      const dominantCutoff = characteristics.spectral.dominantFrequency * 1.5;
      params.cutoffFrequency = Math.min(params.cutoffFrequency, dominantCutoff);
    }

    // フィルタタイプの選択
    if (characteristics.complexity.isComplex) {
      params.filterType = 'butterworth'; // 滑らかな特性
    } else {
      params.filterType = 'chebyshev'; // 急峻な特性
    }

    // 窓関数の選択
    if (characteristics.noise.isHighFrequency) {
      params.windowFunction = 'blackman'; // 高い減衰特性
    } else if (characteristics.periodicity.isPeriodic) {
      params.windowFunction = 'hamming'; // 良好な周波数分解能
    } else {
      params.windowFunction = 'hanning'; // バランス型
    }

    return params;
  }

  /**
   * 偏心矢パラメータの推定
   *
   * @param {Array} signal - 入力信号
   * @param {Object} characteristics - 信号特性
   * @returns {Object} 推定偏心矢パラメータ
   */
  estimateVersineParameters(signal, characteristics) {
    const params = {
      p: 10,
      q: 5,
      targetWavelength: null,
      isSymmetric: true
    };

    // 支配的波長に基づくパラメータ選択
    const dominantWavelength = characteristics.spectral.dominantWavelength;

    if (dominantWavelength && dominantWavelength < Infinity) {
      params.targetWavelength = dominantWavelength;

      // 波長に応じた弦長の自動選択
      if (dominantWavelength < 5) {
        // 短波長
        params.p = 2.5;
        params.q = 2.5;
        params.isSymmetric = true;
      } else if (dominantWavelength < 10) {
        // 短〜中波長
        params.p = 5;
        params.q = 5;
        params.isSymmetric = true;
      } else if (dominantWavelength < 30) {
        // 中波長
        params.p = 10;
        params.q = 5;
        params.isSymmetric = false;
      } else if (dominantWavelength < 70) {
        // 長波長
        params.p = 20;
        params.q = 10;
        params.isSymmetric = false;
      } else {
        // 超長波長
        params.p = 30;
        params.q = 15;
        params.isSymmetric = false;
      }
    } else {
      // デフォルト値を使用（中波長向け）
      params.p = 10;
      params.q = 5;
    }

    // 信号長による制約
    const maxChordLength = characteristics.distance * 0.1; // 全長の10%まで
    if (params.p > maxChordLength) {
      params.p = Math.floor(maxChordLength / this.samplingInterval) * this.samplingInterval;
      params.q = params.p / 2;
    }

    return params;
  }

  /**
   * グリッドサーチによるパラメータ最適化
   *
   * @param {Array} signal - 入力信号
   * @param {Object} initialFilterParams - 初期フィルタパラメータ
   * @param {Object} initialVersineParams - 初期偏心矢パラメータ
   * @param {Object} characteristics - 信号特性
   * @returns {Object} 最適化されたパラメータ
   */
  async optimizeParameters(signal, initialFilterParams, initialVersineParams, characteristics) {
    console.log('パラメータの最適化を実行中...');

    let bestParams = {
      filter: { ...initialFilterParams },
      versine: { ...initialVersineParams },
      score: -Infinity
    };

    // 測定データ形式に変換
    const measurementData = signal.map((value, index) => ({
      distance: index * this.samplingInterval,
      value
    }));

    // カットオフ周波数の探索範囲
    const cutoffRange = [
      initialFilterParams.cutoffFrequency * 0.7,
      initialFilterParams.cutoffFrequency,
      initialFilterParams.cutoffFrequency * 1.3
    ];

    // 偏心矢パラメータの探索範囲
    const pRange = [
      Math.max(2.5, initialVersineParams.p * 0.5),
      initialVersineParams.p,
      Math.min(30, initialVersineParams.p * 1.5)
    ];

    const qRange = initialVersineParams.isSymmetric
      ? pRange
      : [
        Math.max(2.5, initialVersineParams.q * 0.5),
        initialVersineParams.q,
        Math.min(15, initialVersineParams.q * 1.5)
      ];

    // グリッドサーチ
    for (const cutoff of cutoffRange) {
      // フィルタリング
      const filtered = this.iirFilter.filtfilt(
        signal,
        this.iirFilter.butterworthCoefficients(cutoff, 'lowpass')
      );

      for (const p of pRange) {
        for (const q of qRange) {
          try {
            // 偏心矢計算
            const versineResult = this.versineCalculator.calculate(
              measurementData.map((d, i) => ({ ...d, value: filtered[i] })),
              p,
              q
            );

            // 評価スコアの計算
            const score = this.evaluateParameterSet(
              signal,
              filtered,
              versineResult,
              characteristics
            );

            if (score > bestParams.score) {
              bestParams = {
                filter: {
                  ...initialFilterParams,
                  cutoffFrequency: cutoff
                },
                versine: {
                  p,
                  q,
                  isSymmetric: Math.abs(p - q) < 0.1
                },
                score,
                quality: this.assessQuality(score)
              };
            }
          } catch (error) {
            // パラメータの組み合わせが無効な場合はスキップ
            continue;
          }
        }
      }
    }

    console.log(`最適化完了。スコア: ${bestParams.score.toFixed(3)}`);

    return bestParams;
  }

  /**
   * パラメータセットの評価
   *
   * @param {Array} original - 元信号
   * @param {Array} filtered - フィルタリング後信号
   * @param {Object} versineResult - 偏心矢計算結果
   * @param {Object} characteristics - 信号特性
   * @returns {number} 評価スコア
   */
  evaluateParameterSet(original, filtered, versineResult, characteristics) {
    let score = 0;

    // 1. ノイズ除去の効果
    const originalNoise = this.calculateNoiseLevel(original);
    const filteredNoise = this.calculateNoiseLevel(filtered);
    const noiseReduction = (originalNoise - filteredNoise) / originalNoise;
    score += noiseReduction * 30;

    // 2. 信号の保存性（過度のフィルタリングを避ける）
    const correlation = this.calculateCorrelation(original, filtered);
    score += correlation * 25;

    // 3. 偏心矢の統計的特性
    if (versineResult && versineResult.statistics) {
      const stats = versineResult.statistics;

      // 標準偏差が適切な範囲内か
      const optimalStdDev = characteristics.spectral.dominantWavelength
        ? characteristics.spectral.dominantWavelength * 0.1
        : 5;
      const stdDevScore = 1 - Math.abs(stats.stdDev - optimalStdDev) / optimalStdDev;
      score += Math.max(0, stdDevScore) * 20;

      // 変動係数
      const cv = stats.stdDev / Math.abs(stats.mean || 1);
      const cvScore = cv < 1 ? (1 - cv) : 0;
      score += cvScore * 15;
    }

    // 4. スペクトル特性の保持
    const spectralPreservation = this.evaluateSpectralPreservation(original, filtered);
    score += spectralPreservation * 10;

    return score;
  }

  /**
   * パラメータの検証
   *
   * @param {Array} signal - 入力信号
   * @param {Object} params - 推定パラメータ
   * @returns {Object} 検証結果
   */
  validateParameters(signal, params) {
    const validation = {
      isValid: true,
      warnings: [],
      errors: [],
      metrics: {}
    };

    // フィルタパラメータの検証
    if (params.filter) {
      if (params.filter.cutoffFrequency > this.samplingFrequency / 2) {
        validation.errors.push('カットオフ周波数がナイキスト周波数を超えています');
        validation.isValid = false;
      }

      if (params.filter.filterOrder > 8) {
        validation.warnings.push('フィルタ次数が高すぎる可能性があります');
      }
    }

    // 偏心矢パラメータの検証
    if (params.versine) {
      const maxAllowedChord = signal.length * this.samplingInterval * 0.2;

      if (params.versine.p > maxAllowedChord) {
        validation.warnings.push(`前方弦長が推奨値を超えています (${params.versine.p}m)`);
      }

      if (params.versine.q > maxAllowedChord) {
        validation.warnings.push(`後方弦長が推奨値を超えています (${params.versine.q}m)`);
      }

      // p/q比の検証
      const ratio = params.versine.p / params.versine.q;
      if (ratio > 3 || ratio < 0.33) {
        validation.warnings.push('弦長比が極端です。精度が低下する可能性があります');
      }
    }

    // メトリクスの計算
    validation.metrics = {
      parameterCount: Object.keys(params.filter || {}).length + Object.keys(params.versine || {}).length,
      optimizationQuality: params.quality || 'unknown',
      score: params.score || 0
    };

    return validation;
  }

  /**
   * 推定信頼度の計算
   *
   * @param {Object} validation - 検証結果
   * @returns {number} 信頼度（0-100）
   */
  calculateConfidence(validation) {
    let confidence = 100;

    // エラーがある場合は大幅減点
    confidence -= validation.errors.length * 30;

    // 警告による減点
    confidence -= validation.warnings.length * 10;

    // スコアに基づく調整
    if (validation.metrics.score) {
      const scoreBonus = Math.min(20, validation.metrics.score / 5);
      confidence += scoreBonus;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * ノイズレベルの計算
   */
  calculateNoiseLevel(signal) {
    // 高周波成分をノイズとして推定
    const highpass = this.fftFilter.highpassFilter(signal, this.samplingFrequency * 0.4);
    return this.calculateRMS(highpass);
  }

  /**
   * RMS計算
   */
  calculateRMS(signal) {
    let sum = 0;
    for (let i = 0; i < signal.length; i++) {
      sum += signal[i] * signal[i];
    }
    return Math.sqrt(sum / signal.length);
  }

  /**
   * 相関計算
   */
  calculateCorrelation(signal1, signal2) {
    const n = Math.min(signal1.length, signal2.length);
    let sum1 = 0, sum2 = 0, sum12 = 0, sum1Sq = 0, sum2Sq = 0;

    for (let i = 0; i < n; i++) {
      sum1 += signal1[i];
      sum2 += signal2[i];
      sum12 += signal1[i] * signal2[i];
      sum1Sq += signal1[i] * signal1[i];
      sum2Sq += signal2[i] * signal2[i];
    }

    const numerator = n * sum12 - sum1 * sum2;
    const denominator = Math.sqrt((n * sum1Sq - sum1 * sum1) * (n * sum2Sq - sum2 * sum2));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * スペクトル保存性の評価
   */
  evaluateSpectralPreservation(original, filtered) {
    const originalSpectrum = this.fftFilter.spectralAnalysis(original);
    const filteredSpectrum = this.fftFilter.spectralAnalysis(filtered);

    // 主要周波数の保持率
    if (originalSpectrum.dominantFrequency > 0) {
      const freqRatio = filteredSpectrum.dominantFrequency / originalSpectrum.dominantFrequency;
      return Math.abs(1 - Math.abs(1 - freqRatio));
    }

    return 0.5;
  }

  /**
   * 統計計算
   */
  calculateStatistics(signal) {
    const n = signal.length;
    let min = Infinity, max = -Infinity, sum = 0, sumSq = 0;

    for (let i = 0; i < n; i++) {
      min = Math.min(min, signal[i]);
      max = Math.max(max, signal[i]);
      sum += signal[i];
      sumSq += signal[i] * signal[i];
    }

    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    const stdDev = Math.sqrt(variance);

    return { min, max, mean, stdDev, variance };
  }

  /**
   * パワー分布の分析
   */
  analyzePowerDistribution(spectralAnalysis) {
    const spectrum = spectralAnalysis.powerSpectrum;
    const totalPower = spectrum.reduce((sum, val) => sum + val, 0);

    // 低周波、中周波、高周波のパワー比率
    const lowFreqEnd = Math.floor(spectrum.length * 0.2);
    const midFreqEnd = Math.floor(spectrum.length * 0.6);

    let lowPower = 0, midPower = 0, highPower = 0;

    for (let i = 0; i < spectrum.length; i++) {
      if (i < lowFreqEnd) {
        lowPower += spectrum[i];
      } else if (i < midFreqEnd) {
        midPower += spectrum[i];
      } else {
        highPower += spectrum[i];
      }
    }

    return {
      lowFrequency: lowPower / totalPower,
      midFrequency: midPower / totalPower,
      highFrequency: highPower / totalPower,
      isLowFrequencyDominant: lowPower > midPower && lowPower > highPower,
      isHighFrequencyDominant: highPower > lowPower && highPower > midPower
    };
  }

  /**
   * ノイズ特性の分析
   */
  analyzeNoise(signal, spectralAnalysis) {
    const highFreqPower = spectralAnalysis.powerSpectrum
      .slice(Math.floor(spectralAnalysis.powerSpectrum.length * 0.7))
      .reduce((sum, val) => sum + val, 0);

    const totalPower = spectralAnalysis.powerSpectrum.reduce((sum, val) => sum + val, 0);

    return {
      level: highFreqPower,
      ratio: highFreqPower / totalPower,
      isHighFrequency: highFreqPower / totalPower > 0.3
    };
  }

  /**
   * 複雑度の計算
   */
  calculateComplexity(signal) {
    // ゼロクロッシング率による複雑度評価
    let zeroCrossings = 0;
    for (let i = 1; i < signal.length; i++) {
      if (signal[i - 1] * signal[i] < 0) {
        zeroCrossings++;
      }
    }

    const zeroCrossingRate = zeroCrossings / signal.length;

    return {
      zeroCrossingRate,
      isComplex: zeroCrossingRate > 0.1
    };
  }

  /**
   * トレンド分析
   */
  analyzeTrend(signal) {
    // 線形回帰によるトレンド検出
    const n = signal.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += signal[i];
      sumXY += i * signal[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      slope,
      intercept,
      hasTrend: Math.abs(slope) > 0.001
    };
  }

  /**
   * 周期性の分析
   */
  analyzePeriodicity(signal) {
    // 自己相関による周期性検出
    const maxLag = Math.min(signal.length / 2, 100);
    let maxCorr = 0, periodLag = 0;

    for (let lag = 10; lag < maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < signal.length - lag; i++) {
        sum += signal[i] * signal[i + lag];
      }
      const corr = sum / (signal.length - lag);

      if (corr > maxCorr) {
        maxCorr = corr;
        periodLag = lag;
      }
    }

    const period = periodLag * this.samplingInterval;

    return {
      isPeriodic: maxCorr > this.calculateStatistics(signal).variance * 0.5,
      period,
      wavelength: period
    };
  }

  /**
   * 品質評価
   */
  assessQuality(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'poor';
    return 'very_poor';
  }
}

module.exports = { ParameterEstimator };