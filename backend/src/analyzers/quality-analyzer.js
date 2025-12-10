/**
 * 品質分析器（σ値・良化率計算）
 * PDFドキュメント P27の仕様に基づく実装
 * 整備前後の軌道品質を評価
 */

class QualityAnalyzer {
  constructor(options = {}) {
    this.chordLength = options.chordLength || 10; // 弦長（m）
    this.evaluationRanges = options.evaluationRanges || [
      { name: '10m弦', length: 10 },
      { name: '20m弦', length: 20 },
      { name: '40m弦', length: 40 }
    ];
  }

  /**
   * σ値を計算（標準偏差）
   * @param {Array} data - 軌道狂いデータ
   * @returns {number} σ値
   */
  calculateSigma(data) {
    if (!data || data.length === 0) {
      return 0;
    }

    // 平均値計算
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;

    // 分散計算
    const variance = data.reduce((sum, val) => {
      const diff = val - mean;
      return sum + diff * diff;
    }, 0) / data.length;

    // 標準偏差
    return Math.sqrt(variance);
  }

  /**
   * 良化率を計算
   * @param {number} sigmaBefore - 整備前σ値
   * @param {number} sigmaAfter - 整備後σ値
   * @returns {number} 良化率（%）
   */
  calculateImprovementRate(sigmaBefore, sigmaAfter) {
    if (sigmaBefore === 0) {
      return 0;
    }

    const improvementRate = ((sigmaBefore - sigmaAfter) / sigmaBefore) * 100;
    return Math.round(improvementRate * 10) / 10; // 小数点1桁
  }

  /**
   * 整備前後の品質分析を実施
   * @param {Object} beforeData - 整備前データ
   * @param {Object} afterData - 整備後データ（予測値）
   * @returns {Object} 分析結果
   */
  analyzeQuality(beforeData, afterData) {
    const results = {
      overall: {},
      bySection: [],
      byWaveband: [],
      statistics: {}
    };

    // 全体のσ値計算
    results.overall = this.calculateOverallQuality(beforeData, afterData);

    // 区間別分析
    results.bySection = this.analyzeBySections(beforeData, afterData);

    // 波長帯域別分析
    results.byWaveband = this.analyzeByWaveband(beforeData, afterData);

    // 統計情報
    results.statistics = this.calculateStatistics(beforeData, afterData);

    return results;
  }

  /**
   * 全体品質を計算
   */
  calculateOverallQuality(beforeData, afterData) {
    const sigmaBefore = {
      lateral: this.calculateSigma(beforeData.lateral),
      vertical: this.calculateSigma(beforeData.vertical)
    };

    const sigmaAfter = {
      lateral: this.calculateSigma(afterData.lateral),
      vertical: this.calculateSigma(afterData.vertical)
    };

    return {
      before: sigmaBefore,
      after: sigmaAfter,
      improvementRate: {
        lateral: this.calculateImprovementRate(sigmaBefore.lateral, sigmaAfter.lateral),
        vertical: this.calculateImprovementRate(sigmaBefore.vertical, sigmaAfter.vertical)
      },
      evaluation: this.evaluateImprovement(sigmaBefore, sigmaAfter)
    };
  }

  /**
   * 区間別に分析
   * @param {Object} beforeData - 整備前データ
   * @param {Object} afterData - 整備後データ
   * @returns {Array} 区間別分析結果
   */
  analyzeBySections(beforeData, afterData, sectionLength = 200) {
    const results = [];
    const dataLength = beforeData.lateral.length;

    for (let start = 0; start < dataLength; start += sectionLength) {
      const end = Math.min(start + sectionLength, dataLength);

      const sectionBefore = {
        lateral: beforeData.lateral.slice(start, end),
        vertical: beforeData.vertical.slice(start, end)
      };

      const sectionAfter = {
        lateral: afterData.lateral.slice(start, end),
        vertical: afterData.vertical.slice(start, end)
      };

      results.push({
        section: `${start}m - ${end}m`,
        startPosition: start,
        endPosition: end,
        quality: this.calculateOverallQuality(sectionBefore, sectionAfter)
      });
    }

    return results;
  }

  /**
   * 波長帯域別に分析
   */
  analyzeByWaveband(beforeData, afterData) {
    const wavebands = [
      { name: '短波長 (3-10m)', min: 3, max: 10 },
      { name: '中波長 (10-30m)', min: 10, max: 30 },
      { name: '長波長 (30-70m)', min: 30, max: 70 }
    ];

    return wavebands.map(band => {
      // 各波長帯域でフィルタリング（簡略化）
      const filteredBefore = this.filterByWaveband(beforeData, band);
      const filteredAfter = this.filterByWaveband(afterData, band);

      return {
        waveband: band.name,
        range: `${band.min}m - ${band.max}m`,
        quality: this.calculateOverallQuality(filteredBefore, filteredAfter)
      };
    });
  }

  /**
   * 波長帯域でフィルタリング（簡略化版）
   */
  filterByWaveband(data, band) {
    // 実際にはFFTフィルタリングが必要
    // ここでは簡略化
    return data;
  }

  /**
   * 詳細統計を計算
   */
  calculateStatistics(beforeData, afterData) {
    return {
      lateral: {
        before: this.calculateDetailedStats(beforeData.lateral),
        after: this.calculateDetailedStats(afterData.lateral)
      },
      vertical: {
        before: this.calculateDetailedStats(beforeData.vertical),
        after: this.calculateDetailedStats(afterData.vertical)
      }
    };
  }

  /**
   * 詳細統計値を計算
   */
  calculateDetailedStats(data) {
    if (!data || data.length === 0) {
      return null;
    }

    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;

    return {
      mean: data.reduce((a, b) => a + b, 0) / n,
      sigma: this.calculateSigma(data),
      min: sorted[0],
      max: sorted[n - 1],
      median: n % 2 === 0 ?
        (sorted[n / 2 - 1] + sorted[n / 2]) / 2 :
        sorted[Math.floor(n / 2)],
      percentile25: sorted[Math.floor(n * 0.25)],
      percentile75: sorted[Math.floor(n * 0.75)],
      percentile95: sorted[Math.floor(n * 0.95)],
      range: sorted[n - 1] - sorted[0],
      variance: this.calculateVariance(data),
      skewness: this.calculateSkewness(data),
      kurtosis: this.calculateKurtosis(data)
    };
  }

  /**
   * 分散を計算
   */
  calculateVariance(data) {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    return data.reduce((sum, val) => {
      const diff = val - mean;
      return sum + diff * diff;
    }, 0) / data.length;
  }

  /**
   * 歪度を計算
   */
  calculateSkewness(data) {
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const sigma = this.calculateSigma(data);

    if (sigma === 0) return 0;

    const sum = data.reduce((acc, val) => {
      const diff = val - mean;
      return acc + Math.pow(diff / sigma, 3);
    }, 0);

    return sum / n;
  }

  /**
   * 尖度を計算
   */
  calculateKurtosis(data) {
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const sigma = this.calculateSigma(data);

    if (sigma === 0) return 0;

    const sum = data.reduce((acc, val) => {
      const diff = val - mean;
      return acc + Math.pow(diff / sigma, 4);
    }, 0);

    return sum / n - 3; // 超過尖度
  }

  /**
   * 改善度を評価
   */
  evaluateImprovement(sigmaBefore, sigmaAfter) {
    const lateralImprovement = this.calculateImprovementRate(
      sigmaBefore.lateral,
      sigmaAfter.lateral
    );
    const verticalImprovement = this.calculateImprovementRate(
      sigmaBefore.vertical,
      sigmaAfter.vertical
    );

    let grade = '';
    let description = '';

    const avgImprovement = (lateralImprovement + verticalImprovement) / 2;

    if (avgImprovement >= 50) {
      grade = 'A';
      description = '非常に良好な改善';
    } else if (avgImprovement >= 40) {
      grade = 'B';
      description = '良好な改善';
    } else if (avgImprovement >= 30) {
      grade = 'C';
      description = '標準的な改善';
    } else if (avgImprovement >= 20) {
      grade = 'D';
      description = '限定的な改善';
    } else {
      grade = 'E';
      description = '改善効果が小さい';
    }

    return {
      grade,
      description,
      averageImprovement: avgImprovement
    };
  }

  /**
   * 基準補正波形を生成
   * @param {Array} originalWaveform - 元の波形
   * @param {number} targetSigma - 目標σ値
   * @returns {Array} 基準補正波形
   */
  generateReferenceWaveform(originalWaveform, targetSigma) {
    const currentSigma = this.calculateSigma(originalWaveform);

    if (currentSigma === 0) {
      return originalWaveform;
    }

    const scaleFactor = targetSigma / currentSigma;

    return originalWaveform.map(value => value * scaleFactor);
  }

  /**
   * レポート用サマリーを生成
   */
  generateReport(analysisResults) {
    const report = {
      summary: {
        date: new Date().toISOString(),
        overallImprovement: analysisResults.overall.improvementRate,
        evaluation: analysisResults.overall.evaluation
      },
      details: {
        beforeQuality: analysisResults.overall.before,
        afterQuality: analysisResults.overall.after,
        sections: analysisResults.bySection.map(s => ({
          range: s.section,
          improvement: s.quality.improvementRate
        })),
        wavebands: analysisResults.byWaveband
      },
      recommendations: this.generateRecommendations(analysisResults)
    };

    return report;
  }

  /**
   * 推奨事項を生成
   */
  generateRecommendations(analysisResults) {
    const recommendations = [];
    const overall = analysisResults.overall;

    // 横方向の改善について
    if (overall.improvementRate.lateral < 30) {
      recommendations.push({
        type: 'lateral',
        priority: 'high',
        message: '通り狂いの改善が不十分です。移動量制限の見直しを検討してください。'
      });
    }

    // 縦方向の改善について
    if (overall.improvementRate.vertical < 30) {
      recommendations.push({
        type: 'vertical',
        priority: 'high',
        message: '高低狂いの改善が不十分です。こう上量の調整を検討してください。'
      });
    }

    // 区間別の問題点
    const problematicSections = analysisResults.bySection.filter(s =>
      s.quality.improvementRate.lateral < 20 ||
      s.quality.improvementRate.vertical < 20
    );

    if (problematicSections.length > 0) {
      recommendations.push({
        type: 'section',
        priority: 'medium',
        message: `${problematicSections.length}区間で改善が不十分です。個別の対策が必要です。`,
        sections: problematicSections.map(s => s.section)
      });
    }

    return recommendations;
  }

  /**
   * CSV形式でエクスポート
   */
  exportToCSV(analysisResults) {
    const lines = [];

    // ヘッダー
    lines.push('品質分析レポート');
    lines.push(`作成日時: ${new Date().toLocaleString()}`);
    lines.push('');

    // 全体評価
    lines.push('全体評価');
    lines.push('項目,整備前σ値,整備後σ値,良化率(%)');
    lines.push(`通り狂い,${analysisResults.overall.before.lateral.toFixed(2)},${analysisResults.overall.after.lateral.toFixed(2)},${analysisResults.overall.improvementRate.lateral}`);
    lines.push(`高低狂い,${analysisResults.overall.before.vertical.toFixed(2)},${analysisResults.overall.after.vertical.toFixed(2)},${analysisResults.overall.improvementRate.vertical}`);

    return lines.join('\n');
  }
}

module.exports = QualityAnalyzer;