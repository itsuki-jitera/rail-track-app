/**
 * 品質検証システム
 * 軌道データの品質評価、異常値検出、作業前後比較分析
 */

class QualityVerifier {
  constructor() {
    // 品質基準の定義
    this.qualityStandards = {
      excellent: {
        level: { sigma: 2, max: 5, rms: 3 },
        alignment: { sigma: 1.5, max: 3, rms: 2 },
        cant: { sigma: 3, max: 10, rms: 5 },
        gauge: { sigma: 1, max: 3, rms: 1.5 }
      },
      good: {
        level: { sigma: 5, max: 10, rms: 7 },
        alignment: { sigma: 3, max: 7, rms: 5 },
        cant: { sigma: 7, max: 20, rms: 10 },
        gauge: { sigma: 2, max: 5, rms: 3 }
      },
      acceptable: {
        level: { sigma: 10, max: 20, rms: 15 },
        alignment: { sigma: 7, max: 15, rms: 10 },
        cant: { sigma: 15, max: 40, rms: 20 },
        gauge: { sigma: 4, max: 10, rms: 6 }
      },
      poor: {
        level: { sigma: 20, max: 40, rms: 30 },
        alignment: { sigma: 15, max: 30, rms: 20 },
        cant: { sigma: 30, max: 80, rms: 40 },
        gauge: { sigma: 8, max: 20, rms: 12 }
      }
    };

    // 異常値検出パラメータ
    this.anomalyThresholds = {
      zScore: 3.5,           // Z-scoreによる異常値閾値
      iqrMultiplier: 1.5,    // IQR法の係数
      gradientLimit: 50,     // 勾配の異常値閾値 (mm/m)
      jumpThreshold: 20,     // ジャンプ検出閾値 (mm)
      consecutiveLimit: 5    // 連続異常値の上限
    };

    // 評価項目の重み
    this.weights = {
      sigma: 0.3,
      max: 0.2,
      rms: 0.3,
      anomalies: 0.1,
      consistency: 0.1
    };
  }

  /**
   * 総合品質検証
   */
  verifyQuality(data, options = {}) {
    const {
      dataType = 'level',
      trackType = 'conventional',
      section = 'UNKNOWN',
      detailedReport = true
    } = options;

    // 基本統計量の計算
    const statistics = this.calculateStatistics(data);

    // 異常値検出
    const anomalies = this.detectAnomalies(data);

    // 品質スコアリング
    const qualityScore = this.calculateQualityScore(statistics, anomalies, dataType);

    // 品質レベル判定
    const qualityLevel = this.determineQualityLevel(statistics, dataType);

    // 改善提案の生成
    const recommendations = this.generateRecommendations(
      statistics,
      anomalies,
      qualityLevel,
      dataType
    );

    // 詳細レポート生成
    let report = null;
    if (detailedReport) {
      report = this.generateDetailedReport({
        section,
        dataType,
        trackType,
        statistics,
        anomalies,
        qualityScore,
        qualityLevel,
        recommendations,
        data
      });
    }

    return {
      passed: qualityLevel !== 'poor' && anomalies.critical.length === 0,
      score: qualityScore,
      level: qualityLevel,
      statistics: statistics,
      anomalies: {
        count: anomalies.total,
        critical: anomalies.critical.length,
        warning: anomalies.warning.length,
        details: anomalies
      },
      recommendations: recommendations,
      report: report,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 異常値検出
   */
  detectAnomalies(data) {
    const anomalies = {
      outliers: [],      // 統計的外れ値
      jumps: [],         // 急激な変化
      gradients: [],     // 異常な勾配
      patterns: [],      // 異常パターン
      consecutive: [],   // 連続異常値
      critical: [],      // 重大な異常
      warning: [],       // 警告レベル
      total: 0
    };

    // Z-score法による外れ値検出
    const zScoreOutliers = this.detectZScoreOutliers(data);
    anomalies.outliers.push(...zScoreOutliers);

    // IQR法による外れ値検出
    const iqrOutliers = this.detectIQROutliers(data);
    anomalies.outliers.push(...iqrOutliers.filter(
      o => !anomalies.outliers.some(e => e.index === o.index)
    ));

    // ジャンプ検出
    const jumps = this.detectJumps(data);
    anomalies.jumps.push(...jumps);

    // 異常勾配検出
    const gradients = this.detectAbnormalGradients(data);
    anomalies.gradients.push(...gradients);

    // 異常パターン検出
    const patterns = this.detectAnomalousPatterns(data);
    anomalies.patterns.push(...patterns);

    // 連続異常値検出
    const consecutive = this.detectConsecutiveAnomalies(data, anomalies);
    anomalies.consecutive.push(...consecutive);

    // 重要度分類
    this.classifyAnomalies(anomalies);

    // 総数カウント
    anomalies.total = anomalies.outliers.length +
                     anomalies.jumps.length +
                     anomalies.gradients.length +
                     anomalies.patterns.length;

    return anomalies;
  }

  /**
   * Z-score法による外れ値検出
   */
  detectZScoreOutliers(data) {
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    );

    const outliers = [];
    data.forEach((point, index) => {
      const zScore = Math.abs((point.value - mean) / stdDev);
      if (zScore > this.anomalyThresholds.zScore) {
        outliers.push({
          index: index,
          value: point.value,
          zScore: zScore,
          type: 'z-score',
          severity: zScore > 5 ? 'critical' : 'warning'
        });
      }
    });

    return outliers;
  }

  /**
   * IQR法による外れ値検出
   */
  detectIQROutliers(data) {
    const values = data.map(d => d.value).sort((a, b) => a - b);
    const n = values.length;

    const q1 = values[Math.floor(n * 0.25)];
    const q3 = values[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    const lowerBound = q1 - this.anomalyThresholds.iqrMultiplier * iqr;
    const upperBound = q3 + this.anomalyThresholds.iqrMultiplier * iqr;

    const outliers = [];
    data.forEach((point, index) => {
      if (point.value < lowerBound || point.value > upperBound) {
        outliers.push({
          index: index,
          value: point.value,
          bounds: { lower: lowerBound, upper: upperBound },
          type: 'iqr',
          severity: Math.abs(point.value) > upperBound * 1.5 ? 'critical' : 'warning'
        });
      }
    });

    return outliers;
  }

  /**
   * ジャンプ（急激な変化）検出
   */
  detectJumps(data) {
    const jumps = [];

    for (let i = 1; i < data.length; i++) {
      const change = Math.abs(data[i].value - data[i-1].value);
      if (change > this.anomalyThresholds.jumpThreshold) {
        jumps.push({
          index: i,
          from: data[i-1].value,
          to: data[i].value,
          change: change,
          type: 'jump',
          severity: change > this.anomalyThresholds.jumpThreshold * 2 ? 'critical' : 'warning'
        });
      }
    }

    return jumps;
  }

  /**
   * 異常勾配検出
   */
  detectAbnormalGradients(data) {
    const gradients = [];
    const interval = this.estimateInterval(data);

    for (let i = 1; i < data.length - 1; i++) {
      const gradient = (data[i+1].value - data[i-1].value) / (2 * interval);
      if (Math.abs(gradient) > this.anomalyThresholds.gradientLimit) {
        gradients.push({
          index: i,
          gradient: gradient,
          type: 'gradient',
          severity: Math.abs(gradient) > this.anomalyThresholds.gradientLimit * 1.5 ?
                   'critical' : 'warning'
        });
      }
    }

    return gradients;
  }

  /**
   * 異常パターン検出（周期的異常、ノイズなど）
   */
  detectAnomalousPatterns(data) {
    const patterns = [];

    // 周期的パターンの検出
    const periodicAnomalies = this.detectPeriodicAnomalies(data);
    patterns.push(...periodicAnomalies);

    // 高周波ノイズの検出
    const noiseAnomalies = this.detectHighFrequencyNoise(data);
    patterns.push(...noiseAnomalies);

    // 平坦部の検出（データ欠損の可能性）
    const flatAnomalies = this.detectFlatRegions(data);
    patterns.push(...flatAnomalies);

    return patterns;
  }

  /**
   * 周期的異常検出
   */
  detectPeriodicAnomalies(data) {
    const anomalies = [];
    const windowSize = 20; // 分析窓サイズ

    for (let i = 0; i < data.length - windowSize; i++) {
      const window = data.slice(i, i + windowSize);
      const fft = this.simpleFFT(window.map(d => d.value));

      // 特定周波数成分が異常に強い場合
      const maxAmplitude = Math.max(...fft.amplitudes);
      if (maxAmplitude > 10) { // 閾値
        anomalies.push({
          startIndex: i,
          endIndex: i + windowSize,
          type: 'periodic',
          subtype: 'strong_frequency',
          amplitude: maxAmplitude,
          severity: 'warning'
        });
      }
    }

    return anomalies;
  }

  /**
   * 高周波ノイズ検出
   */
  detectHighFrequencyNoise(data) {
    const anomalies = [];
    const windowSize = 10;

    for (let i = 0; i < data.length - windowSize; i++) {
      const window = data.slice(i, i + windowSize);
      const variance = this.calculateVariance(window.map(d => d.value));

      if (variance > 50) { // 閾値
        anomalies.push({
          startIndex: i,
          endIndex: i + windowSize,
          type: 'noise',
          variance: variance,
          severity: variance > 100 ? 'critical' : 'warning'
        });
      }
    }

    return anomalies;
  }

  /**
   * 平坦領域検出
   */
  detectFlatRegions(data) {
    const anomalies = [];
    const minFlatLength = 10;
    const tolerance = 0.1;

    let flatStart = -1;
    let referenceValue = null;

    for (let i = 0; i < data.length; i++) {
      if (flatStart === -1) {
        flatStart = i;
        referenceValue = data[i].value;
      } else if (Math.abs(data[i].value - referenceValue) > tolerance) {
        if (i - flatStart >= minFlatLength) {
          anomalies.push({
            startIndex: flatStart,
            endIndex: i - 1,
            type: 'flat',
            length: i - flatStart,
            value: referenceValue,
            severity: 'warning'
          });
        }
        flatStart = -1;
        referenceValue = null;
      }
    }

    return anomalies;
  }

  /**
   * 連続異常値検出
   */
  detectConsecutiveAnomalies(data, existingAnomalies) {
    const consecutive = [];
    const allAnomalyIndices = new Set();

    // すべての異常インデックスを収集
    Object.values(existingAnomalies).forEach(anomalyList => {
      if (Array.isArray(anomalyList)) {
        anomalyList.forEach(a => {
          if (a.index !== undefined) {
            allAnomalyIndices.add(a.index);
          }
        });
      }
    });

    // 連続性チェック
    let consecutiveCount = 0;
    let startIndex = -1;

    for (let i = 0; i < data.length; i++) {
      if (allAnomalyIndices.has(i)) {
        if (startIndex === -1) {
          startIndex = i;
        }
        consecutiveCount++;
      } else {
        if (consecutiveCount >= this.anomalyThresholds.consecutiveLimit) {
          consecutive.push({
            startIndex: startIndex,
            endIndex: i - 1,
            count: consecutiveCount,
            type: 'consecutive',
            severity: 'critical'
          });
        }
        consecutiveCount = 0;
        startIndex = -1;
      }
    }

    return consecutive;
  }

  /**
   * 異常の重要度分類
   */
  classifyAnomalies(anomalies) {
    // すべての異常を走査して重要度別に分類
    const allAnomalies = [
      ...anomalies.outliers,
      ...anomalies.jumps,
      ...anomalies.gradients,
      ...anomalies.patterns,
      ...anomalies.consecutive
    ];

    allAnomalies.forEach(anomaly => {
      if (anomaly.severity === 'critical') {
        anomalies.critical.push(anomaly);
      } else if (anomaly.severity === 'warning') {
        anomalies.warning.push(anomaly);
      }
    });
  }

  /**
   * 品質スコア計算
   */
  calculateQualityScore(statistics, anomalies, dataType) {
    let score = 100;

    // 統計指標による減点
    const standards = this.qualityStandards.excellent[dataType] ||
                     this.qualityStandards.excellent.level;

    // σ値による評価
    const sigmaRatio = statistics.stdDev / standards.sigma;
    score -= Math.min(30, sigmaRatio * 10 * this.weights.sigma);

    // 最大値による評価
    const maxRatio = statistics.max / standards.max;
    score -= Math.min(20, maxRatio * 10 * this.weights.max);

    // RMS値による評価
    const rmsRatio = statistics.rms / standards.rms;
    score -= Math.min(30, rmsRatio * 10 * this.weights.rms);

    // 異常値による減点
    score -= anomalies.critical.length * 5;
    score -= anomalies.warning.length * 2;
    score -= Math.min(10, anomalies.total * 0.5 * this.weights.anomalies);

    // 連続異常による追加減点
    score -= anomalies.consecutive.length * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 品質レベル判定
   */
  determineQualityLevel(statistics, dataType) {
    const standards = this.qualityStandards;
    const dataStandards = {
      excellent: standards.excellent[dataType] || standards.excellent.level,
      good: standards.good[dataType] || standards.good.level,
      acceptable: standards.acceptable[dataType] || standards.acceptable.level
    };

    // 各基準との比較
    if (statistics.stdDev <= dataStandards.excellent.sigma &&
        statistics.max <= dataStandards.excellent.max &&
        statistics.rms <= dataStandards.excellent.rms) {
      return 'excellent';
    }

    if (statistics.stdDev <= dataStandards.good.sigma &&
        statistics.max <= dataStandards.good.max &&
        statistics.rms <= dataStandards.good.rms) {
      return 'good';
    }

    if (statistics.stdDev <= dataStandards.acceptable.sigma &&
        statistics.max <= dataStandards.acceptable.max &&
        statistics.rms <= dataStandards.acceptable.rms) {
      return 'acceptable';
    }

    return 'poor';
  }

  /**
   * 改善提案生成
   */
  generateRecommendations(statistics, anomalies, qualityLevel, dataType) {
    const recommendations = [];

    // 品質レベルに基づく基本提案
    if (qualityLevel === 'poor') {
      recommendations.push({
        priority: 'high',
        category: 'urgent',
        action: '緊急整正が必要です',
        reason: '品質基準を大幅に下回っています'
      });
    }

    // 統計値に基づく提案
    if (statistics.stdDev > 10) {
      recommendations.push({
        priority: 'high',
        category: 'variability',
        action: '全体的な平滑化処理を推奨',
        reason: `標準偏差が${statistics.stdDev.toFixed(1)}mmと大きい`
      });
    }

    if (statistics.max > 20) {
      recommendations.push({
        priority: 'high',
        category: 'peak',
        action: `最大値${statistics.max.toFixed(1)}mm地点の重点整正`,
        reason: '局所的な大きな狂いが存在'
      });
    }

    // 異常値に基づく提案
    if (anomalies.jumps.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'discontinuity',
        action: 'ジャンプ箇所の確認と修正',
        reason: `${anomalies.jumps.length}箇所で急激な変化を検出`
      });
    }

    if (anomalies.consecutive.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'systematic',
        action: '連続異常区間の原因調査',
        reason: '系統的な問題の可能性'
      });
    }

    // データタイプ別の特別提案
    if (dataType === 'alignment' && statistics.rms > 5) {
      recommendations.push({
        priority: 'medium',
        category: 'alignment',
        action: '通り整正の実施',
        reason: '横方向の変位が大きい'
      });
    }

    if (dataType === 'level' && anomalies.patterns.some(p => p.type === 'periodic')) {
      recommendations.push({
        priority: 'low',
        category: 'periodic',
        action: 'まくらぎ間隔の確認',
        reason: '周期的なパターンを検出'
      });
    }

    return recommendations;
  }

  /**
   * 詳細レポート生成
   */
  generateDetailedReport(params) {
    const {
      section,
      dataType,
      trackType,
      statistics,
      anomalies,
      qualityScore,
      qualityLevel,
      recommendations,
      data
    } = params;

    const report = {
      header: {
        title: '軌道品質検証レポート',
        section: section,
        dataType: dataType,
        trackType: trackType,
        generatedAt: new Date().toISOString(),
        dataPoints: data.length
      },
      summary: {
        overallScore: qualityScore,
        qualityLevel: qualityLevel,
        passed: qualityLevel !== 'poor',
        criticalIssues: anomalies.critical.length,
        warnings: anomalies.warning.length
      },
      statistics: {
        mean: statistics.mean,
        stdDev: statistics.stdDev,
        min: statistics.min,
        max: statistics.max,
        rms: statistics.rms,
        range: statistics.max - statistics.min
      },
      anomalyAnalysis: {
        totalAnomalies: anomalies.total,
        byType: {
          outliers: anomalies.outliers.length,
          jumps: anomalies.jumps.length,
          gradients: anomalies.gradients.length,
          patterns: anomalies.patterns.length,
          consecutive: anomalies.consecutive.length
        },
        criticalLocations: anomalies.critical.map(a => ({
          index: a.index || a.startIndex,
          type: a.type,
          description: this.getAnomalyDescription(a)
        }))
      },
      recommendations: recommendations.map(r => ({
        ...r,
        implementationGuide: this.getImplementationGuide(r)
      })),
      visualization: {
        histogramData: this.generateHistogramData(data),
        trendData: this.generateTrendData(data),
        anomalyMap: this.generateAnomalyMap(data, anomalies)
      }
    };

    return report;
  }

  /**
   * 作業前後比較
   */
  compareBeforeAfter(beforeData, afterData, options = {}) {
    const {
      dataType = 'level',
      detailedComparison = true
    } = options;

    // 各データセットの品質検証
    const beforeQuality = this.verifyQuality(beforeData, { dataType, detailedReport: false });
    const afterQuality = this.verifyQuality(afterData, { dataType, detailedReport: false });

    // 改善率の計算
    const improvements = {
      score: ((afterQuality.score - beforeQuality.score) / beforeQuality.score * 100),
      sigma: ((beforeQuality.statistics.stdDev - afterQuality.statistics.stdDev) /
              beforeQuality.statistics.stdDev * 100),
      rms: ((beforeQuality.statistics.rms - afterQuality.statistics.rms) /
            beforeQuality.statistics.rms * 100),
      max: ((beforeQuality.statistics.max - afterQuality.statistics.max) /
            beforeQuality.statistics.max * 100),
      anomalies: ((beforeQuality.anomalies.count - afterQuality.anomalies.count) /
                  beforeQuality.anomalies.count * 100)
    };

    // 詳細比較
    let detailedAnalysis = null;
    if (detailedComparison) {
      detailedAnalysis = {
        pointByPointComparison: this.comparePointByPoint(beforeData, afterData),
        anomalyResolution: this.analyzeAnomalyResolution(
          beforeQuality.anomalies,
          afterQuality.anomalies
        ),
        workEffectiveness: this.evaluateWorkEffectiveness(improvements)
      };
    }

    return {
      before: {
        score: beforeQuality.score,
        level: beforeQuality.level,
        statistics: beforeQuality.statistics
      },
      after: {
        score: afterQuality.score,
        level: afterQuality.level,
        statistics: afterQuality.statistics
      },
      improvements: improvements,
      overallImprovement: improvements.score > 0,
      workQuality: this.evaluateWorkQuality(improvements),
      detailedAnalysis: detailedAnalysis,
      recommendations: this.generatePostWorkRecommendations(improvements, afterQuality)
    };
  }

  // ========== ヘルパー関数 ==========

  /**
   * 統計量計算
   */
  calculateStatistics(data) {
    const values = data.map(d => d.value);
    const n = values.length;

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const rms = Math.sqrt(values.reduce((a, b) => a + b * b, 0) / n);

    return { mean, stdDev, min, max, rms, variance, count: n };
  }

  /**
   * 分散計算
   */
  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  }

  /**
   * データ間隔推定
   */
  estimateInterval(data) {
    if (data.length < 2) return 0.25;

    if (data[0].distance !== undefined && data[1].distance !== undefined) {
      return data[1].distance - data[0].distance;
    }

    return 0.25; // デフォルト
  }

  /**
   * 簡易FFT（周波数解析用）
   */
  simpleFFT(values) {
    // 簡易的な周波数成分抽出（実際のFFTの簡略版）
    const n = values.length;
    const amplitudes = [];

    for (let k = 0; k < n / 2; k++) {
      let real = 0, imag = 0;
      for (let t = 0; t < n; t++) {
        const angle = 2 * Math.PI * t * k / n;
        real += values[t] * Math.cos(angle);
        imag -= values[t] * Math.sin(angle);
      }
      amplitudes.push(Math.sqrt(real * real + imag * imag) / n);
    }

    return { amplitudes };
  }

  /**
   * 異常説明文生成
   */
  getAnomalyDescription(anomaly) {
    const descriptions = {
      'z-score': `統計的外れ値 (Z-score: ${anomaly.zScore?.toFixed(2)})`,
      'iqr': `四分位範囲外の値 (${anomaly.value?.toFixed(1)}mm)`,
      'jump': `急激な変化 (${anomaly.change?.toFixed(1)}mm)`,
      'gradient': `異常な勾配 (${anomaly.gradient?.toFixed(1)}mm/m)`,
      'periodic': '周期的な異常パターン',
      'noise': `高周波ノイズ (分散: ${anomaly.variance?.toFixed(1)})`,
      'flat': `平坦領域 (${anomaly.length}点)`,
      'consecutive': `連続異常値 (${anomaly.count}点)`
    };

    return descriptions[anomaly.type] || '不明な異常';
  }

  /**
   * 実装ガイド生成
   */
  getImplementationGuide(recommendation) {
    const guides = {
      'urgent': '即座に現場確認と整正作業を実施してください',
      'variability': 'マルチプルタイタンパーによる全体整正を推奨',
      'peak': '該当箇所の重点的な整正作業を実施',
      'discontinuity': '継目や構造物境界の確認が必要',
      'systematic': '測定機器の校正確認と再測定を検討',
      'alignment': '通り整正機能を使用した修正',
      'periodic': 'まくらぎや締結装置の点検'
    };

    return guides[recommendation.category] || '専門技術者による詳細診断を推奨';
  }

  /**
   * ヒストグラムデータ生成
   */
  generateHistogramData(data) {
    const values = data.map(d => d.value);
    const bins = 20;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / bins;

    const histogram = Array(bins).fill(0);
    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
      histogram[binIndex]++;
    });

    return histogram.map((count, i) => ({
      range: `${(min + i * binWidth).toFixed(1)}-${(min + (i + 1) * binWidth).toFixed(1)}`,
      count: count
    }));
  }

  /**
   * トレンドデータ生成
   */
  generateTrendData(data) {
    // 移動平均によるトレンド抽出
    const windowSize = 20;
    const trend = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
      const window = data.slice(start, end);
      const avg = window.reduce((a, b) => a + b.value, 0) / window.length;

      trend.push({
        index: i,
        value: data[i].value,
        trend: avg
      });
    }

    return trend;
  }

  /**
   * 異常マップ生成
   */
  generateAnomalyMap(data, anomalies) {
    return data.map((point, index) => {
      const anomalyInfo = [];

      // 各種異常をチェック
      if (anomalies.outliers.some(a => a.index === index)) {
        anomalyInfo.push('outlier');
      }
      if (anomalies.jumps.some(a => a.index === index)) {
        anomalyInfo.push('jump');
      }
      if (anomalies.gradients.some(a => a.index === index)) {
        anomalyInfo.push('gradient');
      }

      return {
        index: index,
        hasAnomaly: anomalyInfo.length > 0,
        types: anomalyInfo
      };
    });
  }

  /**
   * 点ごとの比較
   */
  comparePointByPoint(beforeData, afterData) {
    const comparison = [];
    const minLength = Math.min(beforeData.length, afterData.length);

    for (let i = 0; i < minLength; i++) {
      const improvement = beforeData[i].value - afterData[i].value;
      comparison.push({
        index: i,
        before: beforeData[i].value,
        after: afterData[i].value,
        improvement: improvement,
        percentChange: (improvement / Math.abs(beforeData[i].value)) * 100
      });
    }

    return comparison;
  }

  /**
   * 異常解決分析
   */
  analyzeAnomalyResolution(beforeAnomalies, afterAnomalies) {
    const resolved = [];
    const persistent = [];
    const newIssues = [];

    // 解決された異常
    beforeAnomalies.critical.forEach(anomaly => {
      const stillExists = afterAnomalies.critical.some(a =>
        a.index === anomaly.index && a.type === anomaly.type
      );
      if (!stillExists) {
        resolved.push(anomaly);
      } else {
        persistent.push(anomaly);
      }
    });

    // 新たに発生した異常
    afterAnomalies.critical.forEach(anomaly => {
      const existedBefore = beforeAnomalies.critical.some(a =>
        a.index === anomaly.index && a.type === anomaly.type
      );
      if (!existedBefore) {
        newIssues.push(anomaly);
      }
    });

    return {
      resolved: resolved,
      persistent: persistent,
      newIssues: newIssues,
      resolutionRate: (resolved.length / beforeAnomalies.critical.length) * 100
    };
  }

  /**
   * 作業効果評価
   */
  evaluateWorkEffectiveness(improvements) {
    let effectiveness = 'excellent';

    if (improvements.score < 10) effectiveness = 'poor';
    else if (improvements.score < 30) effectiveness = 'fair';
    else if (improvements.score < 50) effectiveness = 'good';

    return {
      rating: effectiveness,
      scoreImprovement: improvements.score,
      keyMetrics: {
        variabilityReduction: improvements.sigma,
        peakReduction: improvements.max,
        overallSmoothing: improvements.rms
      }
    };
  }

  /**
   * 作業品質評価
   */
  evaluateWorkQuality(improvements) {
    const score = (improvements.score + improvements.sigma + improvements.rms) / 3;

    if (score > 50) return 'excellent';
    if (score > 30) return 'good';
    if (score > 10) return 'acceptable';
    return 'needs_improvement';
  }

  /**
   * 作業後推奨事項生成
   */
  generatePostWorkRecommendations(improvements, afterQuality) {
    const recommendations = [];

    if (improvements.score < 20) {
      recommendations.push({
        priority: 'high',
        action: '追加整正の実施を検討',
        reason: '改善率が期待値を下回っています'
      });
    }

    if (afterQuality.anomalies.critical > 0) {
      recommendations.push({
        priority: 'high',
        action: '残存する重大異常の対処',
        reason: `${afterQuality.anomalies.critical}件の重大異常が未解決`
      });
    }

    if (afterQuality.level === 'poor' || afterQuality.level === 'acceptable') {
      recommendations.push({
        priority: 'medium',
        action: '定期的な監視と追加整正',
        reason: '品質レベルがまだ改善の余地あり'
      });
    }

    return recommendations;
  }
}

module.exports = QualityVerifier;