/**
 * 相関マッチング機能
 * 手検測データとチャートデータの相関を計算し、最適な位置合わせを行う
 * 文書「057_復元波形を用いた軌道整正計算」の仕様に基づく実装
 */

class CorrelationMatcher {
  constructor(options = {}) {
    this.searchRange = options.searchRange || 20; // ±20m以内で検索
    this.samplingInterval = options.samplingInterval || 0.25; // m
    this.correlationThreshold = options.correlationThreshold || 0.7; // 相関係数の閾値
  }

  /**
   * ピアソン相関係数を計算
   * @param {Array} data1 - データ配列1
   * @param {Array} data2 - データ配列2
   * @returns {number} 相関係数 (-1 ～ 1)
   */
  calculateCorrelation(data1, data2) {
    if (!data1 || !data2 || data1.length !== data2.length) {
      throw new Error('データ配列のサイズが一致しません');
    }

    const n = data1.length;
    if (n < 2) {
      return 0;
    }

    // 平均値の計算
    let sum1 = 0, sum2 = 0;
    for (let i = 0; i < n; i++) {
      sum1 += data1[i];
      sum2 += data2[i];
    }
    const mean1 = sum1 / n;
    const mean2 = sum2 / n;

    // 分散・共分散の計算
    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = data1[i] - mean1;
      const diff2 = data2[i] - mean2;
      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }

    // 標準偏差がゼロの場合
    if (variance1 === 0 || variance2 === 0) {
      return 0;
    }

    // ピアソン相関係数
    const correlation = covariance / Math.sqrt(variance1 * variance2);
    return correlation;
  }

  /**
   * 手検測データと軌道データの最適な位置合わせを検索
   * @param {Object} chartData - チャートデータ {positions: [], values: []}
   * @param {Object} fieldData - 手検測データ {positions: [], values: []}
   * @param {Object} options - オプション設定
   * @returns {Object} マッチング結果
   */
  findBestMatch(chartData, fieldData, options = {}) {
    const {
      searchRange = this.searchRange,
      stepSize = 0.25, // 検索ステップ (m)
      measurementType = 'gauge' // 'gauge'（軌間）または 'level'（高低）
    } = options;

    // データの検証
    if (!chartData || !fieldData) {
      throw new Error('データが不足しています');
    }

    // 手検測データの長さ
    const fieldLength = fieldData.positions[fieldData.positions.length - 1] - fieldData.positions[0];

    // 検索範囲の計算（メートル単位）
    const searchStartOffset = -searchRange;
    const searchEndOffset = searchRange;
    const searchSteps = Math.floor((searchEndOffset - searchStartOffset) / stepSize) + 1;

    let bestCorrelation = -1;
    let bestOffset = 0;
    let correlationResults = [];

    // スライディングウィンドウで相関を計算
    for (let step = 0; step < searchSteps; step++) {
      const offset = searchStartOffset + step * stepSize;

      try {
        // オフセットを適用した手検測データの位置
        const alignedFieldPositions = fieldData.positions.map(pos => pos + offset);

        // チャートデータから対応する区間を抽出
        const extractedChartData = this.extractChartSegment(
          chartData,
          alignedFieldPositions[0],
          alignedFieldPositions[alignedFieldPositions.length - 1]
        );

        // 手検測データと同じサンプリング間隔に補間
        const interpolatedChartValues = this.interpolateData(
          extractedChartData.positions,
          extractedChartData.values,
          alignedFieldPositions
        );

        // 相関係数の計算
        const correlation = this.calculateCorrelation(
          fieldData.values,
          interpolatedChartValues
        );

        // 結果を記録
        correlationResults.push({
          offset: offset,
          correlation: correlation,
          chartStartPos: alignedFieldPositions[0],
          chartEndPos: alignedFieldPositions[alignedFieldPositions.length - 1]
        });

        // 最良の相関を更新
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
        }

      } catch (error) {
        // この位置では比較できない（範囲外など）
        continue;
      }
    }

    // 相関が閾値を超えない場合の警告
    if (bestCorrelation < this.correlationThreshold) {
      console.warn(`相関係数が低い値です: ${bestCorrelation.toFixed(3)} (閾値: ${this.correlationThreshold})`);
    }

    // 最適位置の詳細情報を取得
    const bestMatch = correlationResults.find(r => r.offset === bestOffset);
    const alignedFieldData = this.applyOffset(fieldData, bestOffset);

    return {
      success: true,
      bestOffset: bestOffset,
      bestCorrelation: bestCorrelation,
      correlationResults: correlationResults,
      alignedFieldData: alignedFieldData,
      matchPosition: {
        chartStart: bestMatch.chartStartPos,
        chartEnd: bestMatch.chartEndPos
      },
      quality: this.evaluateMatchQuality(bestCorrelation),
      recommendation: this.generateRecommendation(bestCorrelation, correlationResults)
    };
  }

  /**
   * チャートデータから指定範囲を抽出
   * @private
   */
  extractChartSegment(chartData, startPos, endPos) {
    const positions = [];
    const values = [];

    for (let i = 0; i < chartData.positions.length; i++) {
      const pos = chartData.positions[i];
      if (pos >= startPos && pos <= endPos) {
        positions.push(pos);
        values.push(chartData.values[i]);
      }
    }

    if (positions.length < 2) {
      throw new Error('チャートデータの抽出範囲が不適切です');
    }

    return { positions, values };
  }

  /**
   * データの線形補間
   * @private
   */
  interpolateData(originalPositions, originalValues, targetPositions) {
    const interpolatedValues = [];

    for (const targetPos of targetPositions) {
      // 最も近い2点を見つける
      let leftIndex = 0;
      let rightIndex = originalPositions.length - 1;

      for (let i = 0; i < originalPositions.length - 1; i++) {
        if (targetPos >= originalPositions[i] && targetPos <= originalPositions[i + 1]) {
          leftIndex = i;
          rightIndex = i + 1;
          break;
        }
      }

      // 境界外の処理
      if (targetPos < originalPositions[0]) {
        interpolatedValues.push(originalValues[0]);
      } else if (targetPos > originalPositions[originalPositions.length - 1]) {
        interpolatedValues.push(originalValues[originalValues.length - 1]);
      } else {
        // 線形補間
        const leftPos = originalPositions[leftIndex];
        const rightPos = originalPositions[rightIndex];
        const leftVal = originalValues[leftIndex];
        const rightVal = originalValues[rightIndex];

        const ratio = (targetPos - leftPos) / (rightPos - leftPos);
        const interpolatedValue = leftVal + (rightVal - leftVal) * ratio;
        interpolatedValues.push(interpolatedValue);
      }
    }

    return interpolatedValues;
  }

  /**
   * オフセットを適用
   * @private
   */
  applyOffset(fieldData, offset) {
    return {
      positions: fieldData.positions.map(pos => pos + offset),
      values: [...fieldData.values],
      originalPositions: fieldData.positions,
      appliedOffset: offset
    };
  }

  /**
   * マッチング品質の評価
   * @private
   */
  evaluateMatchQuality(correlation) {
    if (correlation >= 0.95) return 'excellent';
    if (correlation >= 0.90) return 'very_good';
    if (correlation >= 0.80) return 'good';
    if (correlation >= 0.70) return 'acceptable';
    if (correlation >= 0.50) return 'poor';
    return 'unacceptable';
  }

  /**
   * 推奨事項の生成
   * @private
   */
  generateRecommendation(bestCorrelation, correlationResults) {
    const recommendations = [];

    // 相関係数に基づく推奨
    if (bestCorrelation < 0.5) {
      recommendations.push('相関が非常に低いです。手検測データの再測定を検討してください。');
    } else if (bestCorrelation < 0.7) {
      recommendations.push('相関が低めです。複数箇所での手検測を追加することを推奨します。');
    } else if (bestCorrelation < 0.9) {
      recommendations.push('良好な相関です。追加の確認点を1-2箇所設定すると精度が向上します。');
    } else {
      recommendations.push('優れた相関です。現在の位置合わせは信頼性が高いです。');
    }

    // 複数のピークがある場合の警告
    const highCorrelations = correlationResults.filter(r => r.correlation > bestCorrelation * 0.95);
    if (highCorrelations.length > 1) {
      recommendations.push('複数の候補位置が検出されました。追加の基準点で確認することを推奨します。');
    }

    // オフセットが大きい場合の警告
    const bestMatch = correlationResults.find(r => r.correlation === bestCorrelation);
    if (Math.abs(bestMatch.offset) > 10) {
      recommendations.push(`位置ズレが${Math.abs(bestMatch.offset).toFixed(1)}mあります。キロ程の確認が必要です。`);
    }

    return recommendations;
  }

  /**
   * 複数箇所での手検測データの統合マッチング
   * @param {Object} chartData - チャートデータ
   * @param {Array} multipleFieldData - 複数の手検測データの配列
   * @returns {Object} 統合マッチング結果
   */
  multiPointMatching(chartData, multipleFieldData) {
    if (!multipleFieldData || multipleFieldData.length === 0) {
      throw new Error('手検測データがありません');
    }

    const matchResults = [];
    let totalOffset = 0;
    let weightSum = 0;

    // 各手検測データでマッチングを実行
    for (const fieldData of multipleFieldData) {
      const result = this.findBestMatch(chartData, fieldData);
      matchResults.push(result);

      // 重み付き平均のための計算（相関係数を重みとして使用）
      const weight = Math.pow(result.bestCorrelation, 2); // 相関係数の2乗を重みに
      totalOffset += result.bestOffset * weight;
      weightSum += weight;
    }

    // 最適なグローバルオフセットの計算
    const globalOffset = weightSum > 0 ? totalOffset / weightSum : 0;

    // 各測定点での残差計算
    const residuals = matchResults.map(result => ({
      localOffset: result.bestOffset,
      residual: result.bestOffset - globalOffset,
      correlation: result.bestCorrelation,
      position: result.matchPosition
    }));

    // 残差の標準偏差
    const residualStdDev = this.calculateStandardDeviation(residuals.map(r => r.residual));

    return {
      success: true,
      globalOffset: globalOffset,
      matchResults: matchResults,
      residuals: residuals,
      residualStdDev: residualStdDev,
      averageCorrelation: matchResults.reduce((sum, r) => sum + r.bestCorrelation, 0) / matchResults.length,
      quality: this.evaluateMultiPointQuality(residualStdDev, matchResults),
      recommendation: this.generateMultiPointRecommendation(residualStdDev, matchResults)
    };
  }

  /**
   * 標準偏差の計算
   * @private
   */
  calculateStandardDeviation(values) {
    const n = values.length;
    if (n < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    return Math.sqrt(variance);
  }

  /**
   * 複数点マッチングの品質評価
   * @private
   */
  evaluateMultiPointQuality(residualStdDev, matchResults) {
    const avgCorrelation = matchResults.reduce((sum, r) => sum + r.bestCorrelation, 0) / matchResults.length;

    if (residualStdDev < 0.5 && avgCorrelation > 0.9) return 'excellent';
    if (residualStdDev < 1.0 && avgCorrelation > 0.8) return 'very_good';
    if (residualStdDev < 2.0 && avgCorrelation > 0.7) return 'good';
    if (residualStdDev < 5.0 && avgCorrelation > 0.5) return 'acceptable';
    return 'poor';
  }

  /**
   * 複数点マッチングの推奨事項生成
   * @private
   */
  generateMultiPointRecommendation(residualStdDev, matchResults) {
    const recommendations = [];

    if (residualStdDev > 2.0) {
      recommendations.push(`位置合わせのばらつきが大きいです（標準偏差: ${residualStdDev.toFixed(1)}m）`);
      recommendations.push('追加の測定点を設けることを推奨します。');
    }

    // 相関が低い測定点の特定
    const poorMatches = matchResults.filter(r => r.bestCorrelation < 0.7);
    if (poorMatches.length > 0) {
      recommendations.push(`${poorMatches.length}箇所で相関が低いです。再測定を検討してください。`);
    }

    // 優れたマッチングの場合
    if (residualStdDev < 0.5 && matchResults.every(r => r.bestCorrelation > 0.9)) {
      recommendations.push('全測定点で優れたマッチングが得られています。');
    }

    return recommendations;
  }
}

module.exports = CorrelationMatcher;