/**
 * 複数波長同時処理プロセッサ
 * Multi-wavelength Simultaneous Processor
 *
 * KANA3システムの複数波長帯域解析機能
 */

const { FFTFilter } = require('./fft-filter');
const { IIRFilter } = require('./iir-filter');
const { EccentricVersine } = require('./eccentric-versine');

class MultiWavelengthProcessor {
  constructor(options = {}) {
    this.samplingInterval = options.samplingInterval || 0.25; // m
    this.samplingFrequency = 1 / this.samplingInterval; // Hz

    // 波長帯域の定義（鉄道軌道の典型的な波長）
    this.wavelengthBands = options.wavelengthBands || [
      { name: '短波長', min: 0.5, max: 5, priority: 'high' },     // 0.5-5m: レール頭頂面の凹凸
      { name: '中波長', min: 5, max: 30, priority: 'high' },      // 5-30m: 軌道狂い
      { name: '長波長', min: 30, max: 70, priority: 'medium' },   // 30-70m: 軌道変位
      { name: '超長波長', min: 70, max: 200, priority: 'low' }    // 70-200m: 線形変位
    ];

    // フィルタの初期化
    this.fftFilter = new FFTFilter({
      samplingFrequency: this.samplingFrequency,
      windowFunction: 'hanning'
    });

    this.iirFilter = new IIRFilter({
      samplingFrequency: this.samplingFrequency,
      filterOrder: 4
    });

    this.versineCalculator = new EccentricVersine({
      samplingInterval: this.samplingInterval
    });
  }

  /**
   * 複数波長帯域の同時解析
   *
   * @param {Array} signal - 入力信号
   * @param {Object} analysisOptions - 解析オプション
   * @returns {Object} 各波長帯域の解析結果
   */
  analyzeMultipleBands(signal, analysisOptions = {}) {
    const results = {
      originalSignal: signal,
      bands: [],
      composite: null,
      statistics: {},
      recommendations: []
    };

    // 各波長帯域の処理
    this.wavelengthBands.forEach(band => {
      const bandResult = this.processBand(signal, band, analysisOptions);
      results.bands.push(bandResult);
    });

    // 複合信号の生成（重み付き合成）
    results.composite = this.generateComposite(results.bands);

    // 全体統計の計算
    results.statistics = this.calculateOverallStatistics(results);

    // 推奨事項の生成
    results.recommendations = this.generateRecommendations(results);

    return results;
  }

  /**
   * 単一波長帯域の処理
   *
   * @param {Array} signal - 入力信号
   * @param {Object} band - 波長帯域定義
   * @param {Object} options - 処理オプション
   * @returns {Object} 帯域処理結果
   */
  processBand(signal, band, options = {}) {
    // 周波数への変換 (f = v/λ, v=1m/sと仮定)
    const lowFreq = 1 / band.max;
    const highFreq = 1 / band.min;

    // バンドパスフィルタリング
    const filtered = this.fftFilter.bandpassFilter(signal, lowFreq, highFreq);

    // スペクトル解析
    const spectralAnalysis = this.fftFilter.spectralAnalysis(filtered);

    // 統計計算
    const statistics = this.calculateStatistics(filtered);

    // 特徴抽出
    const features = this.extractFeatures(filtered, band);

    // 偏心矢計算（オプション）
    let versineAnalysis = null;
    if (options.includeVersine) {
      versineAnalysis = this.performVersineAnalysis(filtered, band);
    }

    return {
      band,
      filtered,
      spectralAnalysis,
      statistics,
      features,
      versineAnalysis,
      quality: this.assessQuality(statistics, band)
    };
  }

  /**
   * 偏心矢解析の実行
   *
   * @param {Array} signal - フィルタリング済み信号
   * @param {Object} band - 波長帯域
   * @returns {Object} 偏心矢解析結果
   */
  performVersineAnalysis(signal, band) {
    // 波長帯域に適したp, qパラメータを自動選択
    const optimalParams = this.selectOptimalVersineParams(band);

    // 測定データ形式に変換
    const measurementData = signal.map((value, index) => ({
      distance: index * this.samplingInterval,
      value
    }));

    // 偏心矢計算
    const versineResult = this.versineCalculator.calculate(
      measurementData,
      optimalParams.p,
      optimalParams.q
    );

    // 検測特性計算
    const wavelengths = [];
    for (let w = band.min; w <= band.max; w += (band.max - band.min) / 10) {
      wavelengths.push(w);
    }

    const characteristics = this.versineCalculator.calculateMeasurementCharacteristics(
      optimalParams.p,
      optimalParams.q,
      wavelengths
    );

    return {
      parameters: optimalParams,
      versineData: versineResult.data,
      statistics: versineResult.statistics,
      characteristics
    };
  }

  /**
   * 最適な偏心矢パラメータの選択
   *
   * @param {Object} band - 波長帯域
   * @returns {Object} 最適なp, qパラメータ
   */
  selectOptimalVersineParams(band) {
    // 波長帯域に基づいてパラメータを自動選択
    const centerWavelength = (band.min + band.max) / 2;

    let p, q;
    if (centerWavelength < 10) {
      // 短波長: 小さい弦長
      p = 2.5;
      q = 2.5;
    } else if (centerWavelength < 30) {
      // 中波長: 標準的な弦長
      p = 5;
      q = 5;
    } else if (centerWavelength < 70) {
      // 長波長: 大きい弦長
      p = 10;
      q = 5;
    } else {
      // 超長波長: 非対称大弦長
      p = 20;
      q = 10;
    }

    return { p, q, targetWavelength: centerWavelength };
  }

  /**
   * 複合信号の生成
   *
   * @param {Array} bandResults - 各帯域の処理結果
   * @returns {Array} 重み付き合成信号
   */
  generateComposite(bandResults) {
    if (bandResults.length === 0) return [];

    const signalLength = bandResults[0].filtered.length;
    const composite = new Float32Array(signalLength);

    // 優先度に基づく重み付け
    const weights = {
      high: 1.0,
      medium: 0.7,
      low: 0.4
    };

    let totalWeight = 0;

    // 各帯域の重み付き加算
    bandResults.forEach(result => {
      const weight = weights[result.band.priority] || 0.5;
      totalWeight += weight;

      for (let i = 0; i < signalLength; i++) {
        composite[i] += result.filtered[i] * weight;
      }
    });

    // 正規化
    if (totalWeight > 0) {
      for (let i = 0; i < signalLength; i++) {
        composite[i] /= totalWeight;
      }
    }

    return Array.from(composite);
  }

  /**
   * 統計計算
   *
   * @param {Array} signal - 信号データ
   * @returns {Object} 統計情報
   */
  calculateStatistics(signal) {
    const n = signal.length;
    if (n === 0) return {};

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < n; i++) {
      const value = signal[i];
      min = Math.min(min, value);
      max = Math.max(max, value);
      sum += value;
      sumSquares += value * value;
    }

    const mean = sum / n;
    const variance = sumSquares / n - mean * mean;
    const stdDev = Math.sqrt(variance);

    // RMS (Root Mean Square)
    const rms = Math.sqrt(sumSquares / n);

    // ピーク係数
    const crestFactor = max / rms;

    return {
      min,
      max,
      mean,
      stdDev,
      variance,
      rms,
      crestFactor,
      range: max - min
    };
  }

  /**
   * 特徴抽出
   *
   * @param {Array} signal - フィルタリング済み信号
   * @param {Object} band - 波長帯域
   * @returns {Object} 抽出された特徴
   */
  extractFeatures(signal, band) {
    const features = {};

    // ピーク検出
    features.peaks = this.detectPeaks(signal);

    // ゼロクロッシング率
    features.zeroCrossingRate = this.calculateZeroCrossingRate(signal);

    // エネルギー
    features.energy = this.calculateEnergy(signal);

    // 周期性の検出
    features.periodicity = this.detectPeriodicity(signal);

    // 異常値の検出
    features.anomalies = this.detectAnomalies(signal);

    return features;
  }

  /**
   * ピーク検出
   *
   * @param {Array} signal - 信号
   * @returns {Array} ピーク位置と値
   */
  detectPeaks(signal) {
    const peaks = [];
    const threshold = this.calculateStatistics(signal).stdDev * 2;

    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] &&
          signal[i] > signal[i + 1] &&
          Math.abs(signal[i]) > threshold) {
        peaks.push({
          position: i * this.samplingInterval,
          value: signal[i],
          index: i
        });
      }
    }

    return peaks;
  }

  /**
   * ゼロクロッシング率の計算
   *
   * @param {Array} signal - 信号
   * @returns {number} ゼロクロッシング率
   */
  calculateZeroCrossingRate(signal) {
    let crossings = 0;
    for (let i = 1; i < signal.length; i++) {
      if ((signal[i - 1] >= 0 && signal[i] < 0) ||
          (signal[i - 1] < 0 && signal[i] >= 0)) {
        crossings++;
      }
    }
    return crossings / signal.length;
  }

  /**
   * エネルギー計算
   *
   * @param {Array} signal - 信号
   * @returns {number} エネルギー
   */
  calculateEnergy(signal) {
    let energy = 0;
    for (let i = 0; i < signal.length; i++) {
      energy += signal[i] * signal[i];
    }
    return energy;
  }

  /**
   * 周期性の検出（自己相関による）
   *
   * @param {Array} signal - 信号
   * @returns {Object} 周期性情報
   */
  detectPeriodicity(signal) {
    const maxLag = Math.min(signal.length / 2, 200);
    const autocorrelation = [];

    for (let lag = 0; lag < maxLag; lag++) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < signal.length - lag; i++) {
        sum += signal[i] * signal[i + lag];
        count++;
      }
      autocorrelation.push(sum / count);
    }

    // 最初のピーク（ラグ0を除く）を見つける
    let maxCorr = 0;
    let periodLag = 0;
    for (let i = 10; i < autocorrelation.length; i++) {
      if (autocorrelation[i] > maxCorr) {
        maxCorr = autocorrelation[i];
        periodLag = i;
      }
    }

    const period = periodLag * this.samplingInterval;
    const wavelength = period; // 距離領域での周期が波長

    return {
      isPeriodic: maxCorr > autocorrelation[0] * 0.5,
      period,
      wavelength,
      correlation: maxCorr / autocorrelation[0]
    };
  }

  /**
   * 異常値の検出
   *
   * @param {Array} signal - 信号
   * @returns {Array} 異常値の位置
   */
  detectAnomalies(signal) {
    const stats = this.calculateStatistics(signal);
    const threshold = stats.mean + 3 * stats.stdDev;
    const anomalies = [];

    for (let i = 0; i < signal.length; i++) {
      if (Math.abs(signal[i] - stats.mean) > threshold) {
        anomalies.push({
          position: i * this.samplingInterval,
          value: signal[i],
          index: i,
          deviation: (signal[i] - stats.mean) / stats.stdDev
        });
      }
    }

    return anomalies;
  }

  /**
   * 品質評価
   *
   * @param {Object} statistics - 統計情報
   * @param {Object} band - 波長帯域
   * @returns {Object} 品質評価結果
   */
  assessQuality(statistics, band) {
    const quality = {
      level: 'unknown',
      score: 0,
      issues: []
    };

    // 基準値（波長帯域に応じて調整）
    let maxAllowedStdDev;
    switch (band.name) {
      case '短波長':
        maxAllowedStdDev = 2.0; // mm
        break;
      case '中波長':
        maxAllowedStdDev = 5.0; // mm
        break;
      case '長波長':
        maxAllowedStdDev = 10.0; // mm
        break;
      default:
        maxAllowedStdDev = 15.0; // mm
    }

    // スコア計算
    const stdDevScore = Math.max(0, 100 - (statistics.stdDev / maxAllowedStdDev) * 100);
    const rangeScore = Math.max(0, 100 - (statistics.range / (maxAllowedStdDev * 4)) * 100);

    quality.score = (stdDevScore + rangeScore) / 2;

    // 品質レベル判定
    if (quality.score >= 90) {
      quality.level = '優良';
    } else if (quality.score >= 70) {
      quality.level = '良好';
    } else if (quality.score >= 50) {
      quality.level = '要注意';
    } else {
      quality.level = '要改善';
      quality.issues.push(`標準偏差が基準値を超えています: ${statistics.stdDev.toFixed(2)}mm`);
    }

    if (statistics.max > maxAllowedStdDev * 3) {
      quality.issues.push(`最大値が異常に大きいです: ${statistics.max.toFixed(2)}mm`);
    }

    return quality;
  }

  /**
   * 全体統計の計算
   *
   * @param {Object} results - 解析結果
   * @returns {Object} 全体統計
   */
  calculateOverallStatistics(results) {
    const overallStats = {
      bandCount: results.bands.length,
      qualityScores: {},
      dominantBand: null,
      overallQuality: null
    };

    let maxEnergy = 0;
    let totalScore = 0;

    results.bands.forEach(band => {
      overallStats.qualityScores[band.band.name] = band.quality.score;
      totalScore += band.quality.score;

      if (band.features.energy > maxEnergy) {
        maxEnergy = band.features.energy;
        overallStats.dominantBand = band.band.name;
      }
    });

    overallStats.averageQualityScore = totalScore / results.bands.length;

    if (overallStats.averageQualityScore >= 90) {
      overallStats.overallQuality = '優良';
    } else if (overallStats.averageQualityScore >= 70) {
      overallStats.overallQuality = '良好';
    } else if (overallStats.averageQualityScore >= 50) {
      overallStats.overallQuality = '要注意';
    } else {
      overallStats.overallQuality = '要改善';
    }

    return overallStats;
  }

  /**
   * 推奨事項の生成
   *
   * @param {Object} results - 解析結果
   * @returns {Array} 推奨事項リスト
   */
  generateRecommendations(results) {
    const recommendations = [];

    results.bands.forEach(band => {
      // 品質に基づく推奨
      if (band.quality.level === '要改善') {
        recommendations.push({
          priority: 'high',
          band: band.band.name,
          message: `${band.band.name}帯域の軌道状態が悪化しています。早急な保守が必要です。`,
          action: 'maintenance_urgent'
        });
      } else if (band.quality.level === '要注意') {
        recommendations.push({
          priority: 'medium',
          band: band.band.name,
          message: `${band.band.name}帯域に注意が必要です。定期的な監視を推奨します。`,
          action: 'monitor'
        });
      }

      // 異常値に基づく推奨
      if (band.features.anomalies.length > 5) {
        recommendations.push({
          priority: 'high',
          band: band.band.name,
          message: `${band.band.name}帯域で${band.features.anomalies.length}箇所の異常値を検出しました。`,
          action: 'inspection',
          locations: band.features.anomalies.map(a => a.position)
        });
      }

      // 周期性に基づく推奨
      if (band.features.periodicity.isPeriodic) {
        recommendations.push({
          priority: 'low',
          band: band.band.name,
          message: `${band.band.name}帯域で周期的な変動（波長${band.features.periodicity.wavelength.toFixed(1)}m）を検出しました。`,
          action: 'analyze',
          info: band.features.periodicity
        });
      }
    });

    // 優先度でソート
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }
}

module.exports = { MultiWavelengthProcessor };