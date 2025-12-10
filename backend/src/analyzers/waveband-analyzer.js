/**
 * 波長帯域分析器
 * PDFドキュメント P18-20の仕様に基づく実装
 * FFTによる周波数解析と波長帯域別フィルタリング
 */

const FFT = require('fft.js');

class WavebandAnalyzer {
  constructor(options = {}) {
    this.samplingInterval = options.samplingInterval || 0.5; // サンプリング間隔(m)
    this.fftSize = options.fftSize || 2048; // FFTサイズ（2の累乗）
    this.wavebands = options.wavebands || [
      { name: '短波長', min: 3, max: 10 },
      { name: '中波長', min: 10, max: 30 },
      { name: '長波長', min: 30, max: 70 },
      { name: '超長波長', min: 70, max: 200 }
    ];
  }

  /**
   * 波長帯域別分析を実行
   * @param {Array} data - 軌道狂いデータ
   * @returns {Object} 波長帯域別分析結果
   */
  analyzeWavebands(data) {
    const results = {
      original: data,
      spectrum: null,
      wavebands: [],
      dominantWavelength: null,
      statistics: {}
    };

    // FFT変換
    const spectrum = this.performFFT(data);
    results.spectrum = spectrum;

    // 各波長帯域で分析
    for (const band of this.wavebands) {
      const bandResult = this.analyzeBand(data, spectrum, band);
      results.wavebands.push(bandResult);
    }

    // 支配的な波長を特定
    results.dominantWavelength = this.findDominantWavelength(spectrum);

    // 統計情報
    results.statistics = this.calculateStatistics(results);

    return results;
  }

  /**
   * FFT変換を実行
   * @param {Array} data - 時系列データ
   * @returns {Object} 周波数スペクトル
   */
  performFFT(data) {
    // データ長を2の累乗に調整
    const paddedData = this.padToPowerOfTwo(data);
    const n = paddedData.length;

    // 複素数配列に変換（実部のみ）
    const complexData = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      complexData[i * 2] = paddedData[i];     // 実部
      complexData[i * 2 + 1] = 0;             // 虚部
    }

    // FFT実行
    const fft = new FFT(n);
    const spectrum = fft.createComplexArray();
    fft.transform(spectrum, complexData);

    // パワースペクトルに変換
    return this.calculatePowerSpectrum(spectrum, n);
  }

  /**
   * パワースペクトルを計算
   */
  calculatePowerSpectrum(spectrum, n) {
    const powerSpectrum = [];
    const nyquist = n / 2;

    for (let i = 0; i < nyquist; i++) {
      const real = spectrum[i * 2];
      const imag = spectrum[i * 2 + 1];
      const power = Math.sqrt(real * real + imag * imag) / n;

      // 周波数と波長を計算
      const frequency = i / (n * this.samplingInterval); // 1/m
      const wavelength = frequency > 0 ? 1 / frequency : Infinity;

      powerSpectrum.push({
        frequency: frequency,
        wavelength: wavelength,
        power: power,
        phase: Math.atan2(imag, real)
      });
    }

    return powerSpectrum;
  }

  /**
   * 特定波長帯域を分析
   */
  analyzeBand(data, spectrum, band) {
    // 帯域フィルタリング
    const filteredData = this.bandpassFilter(data, band);

    // 帯域内のパワーを計算
    const bandPower = this.calculateBandPower(spectrum, band);

    // 統計値計算
    const stats = this.calculateBandStatistics(filteredData);

    return {
      band: band,
      filteredData: filteredData,
      power: bandPower,
      statistics: stats,
      contribution: this.calculateContribution(bandPower, spectrum)
    };
  }

  /**
   * バンドパスフィルタ（簡易版）
   */
  bandpassFilter(data, band) {
    // FFT変換
    const paddedData = this.padToPowerOfTwo(data);
    const n = paddedData.length;
    const fft = new FFT(n);

    // 複素数配列に変換
    const complexData = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      complexData[i * 2] = paddedData[i];
      complexData[i * 2 + 1] = 0;
    }

    // FFT実行
    const spectrum = fft.createComplexArray();
    fft.transform(spectrum, complexData);

    // フィルタリング
    for (let i = 0; i < n / 2; i++) {
      const wavelength = (n * this.samplingInterval) / (i || 1);

      if (wavelength < band.min || wavelength > band.max) {
        // 帯域外の成分をゼロに
        spectrum[i * 2] = 0;
        spectrum[i * 2 + 1] = 0;
        // 対称部分も処理
        spectrum[(n - i) * 2] = 0;
        spectrum[(n - i) * 2 + 1] = 0;
      }
    }

    // 逆FFT
    const filtered = fft.createComplexArray();
    fft.inverseTransform(filtered, spectrum);

    // 実部を抽出して元の長さに戻す
    const result = [];
    for (let i = 0; i < data.length; i++) {
      result.push(filtered[i * 2]);
    }

    return result;
  }

  /**
   * 帯域内パワーを計算
   */
  calculateBandPower(spectrum, band) {
    let totalPower = 0;
    let count = 0;

    for (const point of spectrum) {
      if (point.wavelength >= band.min && point.wavelength <= band.max) {
        totalPower += point.power * point.power;
        count++;
      }
    }

    return count > 0 ? Math.sqrt(totalPower / count) : 0;
  }

  /**
   * 帯域統計を計算
   */
  calculateBandStatistics(filteredData) {
    const stats = {
      mean: 0,
      std: 0,
      max: -Infinity,
      min: Infinity,
      rms: 0
    };

    // 平均値
    stats.mean = filteredData.reduce((a, b) => a + b, 0) / filteredData.length;

    // 標準偏差とRMS
    let sumSquares = 0;
    let sumVariance = 0;

    for (const value of filteredData) {
      sumSquares += value * value;
      sumVariance += (value - stats.mean) * (value - stats.mean);
      stats.max = Math.max(stats.max, value);
      stats.min = Math.min(stats.min, value);
    }

    stats.std = Math.sqrt(sumVariance / filteredData.length);
    stats.rms = Math.sqrt(sumSquares / filteredData.length);

    return stats;
  }

  /**
   * 寄与率を計算
   */
  calculateContribution(bandPower, spectrum) {
    const totalPower = spectrum.reduce((sum, point) =>
      sum + point.power * point.power, 0
    );

    return totalPower > 0 ? (bandPower * bandPower / totalPower) * 100 : 0;
  }

  /**
   * 支配的な波長を特定
   */
  findDominantWavelength(spectrum) {
    let maxPower = 0;
    let dominantPoint = null;

    for (const point of spectrum) {
      // 有効な波長範囲内で検索
      if (point.wavelength >= 1 && point.wavelength <= 200) {
        if (point.power > maxPower) {
          maxPower = point.power;
          dominantPoint = point;
        }
      }
    }

    return dominantPoint;
  }

  /**
   * 全体統計を計算
   */
  calculateStatistics(results) {
    const stats = {
      totalEnergy: 0,
      bandContributions: {},
      effectiveWavelength: 0
    };

    // 各帯域の寄与率
    for (const band of results.wavebands) {
      stats.bandContributions[band.band.name] = band.contribution;
      stats.totalEnergy += band.power * band.power;
    }

    // 実効波長（パワー重み付き平均）
    let weightedSum = 0;
    let totalWeight = 0;

    for (const point of results.spectrum) {
      if (point.wavelength >= 1 && point.wavelength <= 200) {
        const weight = point.power * point.power;
        weightedSum += point.wavelength * weight;
        totalWeight += weight;
      }
    }

    stats.effectiveWavelength = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return stats;
  }

  /**
   * データを2の累乗長にパディング
   */
  padToPowerOfTwo(data) {
    const n = data.length;
    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(n)));

    if (n === nextPowerOfTwo) {
      return data.slice();
    }

    const padded = new Array(nextPowerOfTwo).fill(0);
    for (let i = 0; i < n; i++) {
      padded[i] = data[i];
    }

    return padded;
  }

  /**
   * スペクトログラムを生成
   * @param {Array} data - 時系列データ
   * @param {number} windowSize - 窓サイズ
   * @param {number} overlap - オーバーラップ率(0-1)
   * @returns {Array} スペクトログラムデータ
   */
  generateSpectrogram(data, windowSize = 256, overlap = 0.5) {
    const spectrogram = [];
    const hopSize = Math.floor(windowSize * (1 - overlap));

    for (let i = 0; i <= data.length - windowSize; i += hopSize) {
      const window = data.slice(i, i + windowSize);
      const spectrum = this.performFFT(window);

      spectrogram.push({
        position: i + windowSize / 2,
        spectrum: spectrum,
        time: i * this.samplingInterval
      });
    }

    return spectrogram;
  }

  /**
   * 適応的フィルタリング
   * @param {Array} data - 軌道狂いデータ
   * @param {Object} targetProfile - 目標プロファイル
   * @returns {Array} フィルタリング済みデータ
   */
  adaptiveFilter(data, targetProfile) {
    const spectrum = this.performFFT(data);
    const filtered = [];

    // 各波長成分を目標プロファイルに合わせて調整
    for (const band of this.wavebands) {
      const targetPower = targetProfile[band.name] || 0;
      const currentPower = this.calculateBandPower(spectrum, band);

      if (currentPower > 0) {
        const scaleFactor = targetPower / currentPower;
        const bandFiltered = this.bandpassFilter(data, band);

        // スケーリングして加算
        for (let i = 0; i < data.length; i++) {
          filtered[i] = (filtered[i] || 0) + bandFiltered[i] * scaleFactor;
        }
      }
    }

    return filtered;
  }

  /**
   * 波長帯域別の改善効果を予測
   * @param {Array} beforeData - 整備前データ
   * @param {Array} afterData - 整備後予測データ
   * @returns {Object} 改善効果の分析結果
   */
  predictImprovementByBand(beforeData, afterData) {
    const beforeAnalysis = this.analyzeWavebands(beforeData);
    const afterAnalysis = this.analyzeWavebands(afterData);

    const improvements = [];

    for (let i = 0; i < this.wavebands.length; i++) {
      const band = this.wavebands[i];
      const beforeBand = beforeAnalysis.wavebands[i];
      const afterBand = afterAnalysis.wavebands[i];

      const improvement = {
        band: band.name,
        wavelengthRange: `${band.min}m - ${band.max}m`,
        beforePower: beforeBand.power,
        afterPower: afterBand.power,
        reduction: ((beforeBand.power - afterBand.power) / beforeBand.power) * 100,
        beforeContribution: beforeBand.contribution,
        afterContribution: afterBand.contribution
      };

      improvements.push(improvement);
    }

    return {
      improvements: improvements,
      overallReduction: this.calculateOverallReduction(beforeAnalysis, afterAnalysis),
      recommendation: this.generateRecommendation(improvements)
    };
  }

  /**
   * 全体的な改善率を計算
   */
  calculateOverallReduction(before, after) {
    const beforeTotal = before.statistics.totalEnergy;
    const afterTotal = after.statistics.totalEnergy;

    return beforeTotal > 0 ? ((beforeTotal - afterTotal) / beforeTotal) * 100 : 0;
  }

  /**
   * 推奨事項を生成
   */
  generateRecommendation(improvements) {
    const recommendations = [];

    for (const improvement of improvements) {
      if (improvement.reduction < 30) {
        recommendations.push({
          band: improvement.band,
          message: `${improvement.band}域の改善が不十分です（${improvement.reduction.toFixed(1)}%）`,
          action: '追加の整備パラメータ調整を検討してください'
        });
      }
    }

    return recommendations;
  }

  /**
   * CSVエクスポート用データ生成
   */
  exportToCSV(analysisResults) {
    const lines = [];

    // ヘッダー
    lines.push('波長帯域分析結果');
    lines.push(`解析日時: ${new Date().toISOString()}`);
    lines.push('');

    // 波長帯域別結果
    lines.push('波長帯域,範囲,パワー,寄与率(%),RMS,最大値,最小値');

    for (const band of analysisResults.wavebands) {
      lines.push([
        band.band.name,
        `${band.band.min}-${band.band.max}m`,
        band.power.toFixed(3),
        band.contribution.toFixed(1),
        band.statistics.rms.toFixed(3),
        band.statistics.max.toFixed(3),
        band.statistics.min.toFixed(3)
      ].join(','));
    }

    // 支配的波長
    if (analysisResults.dominantWavelength) {
      lines.push('');
      lines.push(`支配的波長: ${analysisResults.dominantWavelength.wavelength.toFixed(1)}m`);
      lines.push(`パワー: ${analysisResults.dominantWavelength.power.toFixed(3)}`);
    }

    return lines.join('\n');
  }
}

module.exports = WavebandAnalyzer;