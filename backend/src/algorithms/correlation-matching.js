/**
 * 相関係数による位置合わせアルゴリズム
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 手検測軌道狂いの主な目的は、チャート上の一点と現地の位置を正確に対応づけること
 * - チャート上で特徴のある波形の区間を選び現地で手検測する
 * - 軌間あるいは高低を1mごとに最大25mまで測定
 * - ラボックスデータと±20m以内で波形比較して、相関係数が最大の位置にチャート表示
 */

class CorrelationMatching {
  /**
   * 手検測データとラボックスデータの最適マッチング位置を検索
   *
   * @param {Array} handMeasurement - 手検測データ [{ distance, value }]
   * @param {Array} laboxData - ラボックスデータ [{ position, value }]
   * @param {number} searchRange - 検索範囲 (m) デフォルト±20m
   * @param {Object} options - オプション設定
   * @returns {Object} マッチング結果
   */
  static findBestMatch(handMeasurement, laboxData, searchRange = 20, options = {}) {
    const {
      dataInterval = 0.25,     // ラボックスデータの間隔 (m)
      handInterval = 1.0,      // 手検測データの間隔 (m)
      minCorrelation = 0.4,    // 最小相関係数（これ以下は無効）
      interpolate = true,      // データ補間を行うか
      verbose = true
    } = options;

    if (verbose) {
      console.log('相関マッチング開始');
      console.log(`手検測データ: ${handMeasurement.length}点`);
      console.log(`ラボックスデータ: ${laboxData.length}点`);
      console.log(`検索範囲: ±${searchRange}m`);
    }

    // 入力データの検証
    if (!handMeasurement || handMeasurement.length < 3) {
      throw new Error('手検測データが不足しています（最低3点必要）');
    }

    if (!laboxData || laboxData.length < handMeasurement.length) {
      throw new Error('ラボックスデータが不足しています');
    }

    // 手検測データの正規化
    const normalizedHand = this.normalizeData(handMeasurement);

    // 検索範囲の計算
    const searchSteps = Math.floor(searchRange / dataInterval);
    const results = [];

    // 各位置での相関係数を計算
    for (let offset = -searchSteps; offset <= searchSteps; offset++) {
      const offsetDistance = offset * dataInterval;
      const correlation = this.calculateCorrelation(
        normalizedHand,
        laboxData,
        offsetDistance,
        { dataInterval, handInterval, interpolate }
      );

      if (correlation !== null && correlation >= minCorrelation) {
        results.push({
          offset: offsetDistance,
          correlation: correlation,
          confidence: this.calculateConfidence(correlation, normalizedHand.length)
        });
      }
    }

    // 結果のソート（相関係数の降順）
    results.sort((a, b) => b.correlation - a.correlation);

    if (results.length === 0) {
      if (verbose) {
        console.log('有効なマッチングが見つかりませんでした');
      }
      return {
        success: false,
        bestMatch: null,
        allMatches: [],
        message: '相関係数が閾値を下回りました'
      };
    }

    // 最良のマッチング
    const bestMatch = results[0];

    // ピーク検出による信頼性向上
    const refinedMatch = this.refinePeak(
      bestMatch,
      normalizedHand,
      laboxData,
      { dataInterval, handInterval }
    );

    if (verbose) {
      console.log(`最良マッチング: オフセット=${refinedMatch.offset.toFixed(2)}m`);
      console.log(`相関係数: ${refinedMatch.correlation.toFixed(4)}`);
      console.log(`信頼度: ${refinedMatch.confidence.toFixed(2)}%`);
    }

    return {
      success: true,
      bestMatch: refinedMatch,
      allMatches: results.slice(0, 5), // 上位5つ
      statistics: this.calculateMatchStatistics(results)
    };
  }

  /**
   * データの正規化
   * 平均を0、標準偏差を1に正規化
   */
  static normalizeData(data) {
    const values = data.map(d => d.value || d);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return data.map(d => ({ ...d, normalizedValue: 0 }));
    }

    return data.map((d, i) => ({
      ...d,
      normalizedValue: (values[i] - mean) / stdDev
    }));
  }

  /**
   * 相関係数の計算
   * ピアソンの積率相関係数を使用
   */
  static calculateCorrelation(handData, laboxData, offset, options) {
    const { dataInterval, handInterval, interpolate } = options;

    // オフセットを適用した位置でのデータ抽出
    const extractedLabox = this.extractLaboxSegment(
      laboxData,
      offset,
      handData.length,
      { dataInterval, handInterval, interpolate }
    );

    if (!extractedLabox || extractedLabox.length !== handData.length) {
      return null;
    }

    // 正規化
    const normalizedLabox = this.normalizeData(extractedLabox);

    // 相関係数計算
    let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
    const n = handData.length;

    for (let i = 0; i < n; i++) {
      const x = handData[i].normalizedValue || 0;
      const y = normalizedLabox[i].normalizedValue || 0;

      sumXY += x * y;
      sumX += x;
      sumY += y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  /**
   * ラボックスデータから指定位置のセグメントを抽出
   */
  static extractLaboxSegment(laboxData, offset, length, options) {
    const { dataInterval, handInterval, interpolate } = options;

    // 開始インデックスの計算
    const startIndex = Math.floor(offset / dataInterval);
    if (startIndex < 0 || startIndex + length > laboxData.length) {
      return null;
    }

    const segment = [];
    const ratio = handInterval / dataInterval;

    for (let i = 0; i < length; i++) {
      const targetIndex = startIndex + Math.floor(i * ratio);

      if (interpolate && ratio !== Math.floor(ratio)) {
        // 補間処理
        const index1 = Math.floor(targetIndex);
        const index2 = Math.min(index1 + 1, laboxData.length - 1);
        const weight = targetIndex - index1;

        const value = laboxData[index1].value * (1 - weight) +
                     laboxData[index2].value * weight;

        segment.push({
          position: laboxData[index1].position + offset,
          value: value
        });
      } else {
        // 補間なし
        if (targetIndex < laboxData.length) {
          segment.push({
            position: laboxData[targetIndex].position,
            value: laboxData[targetIndex].value
          });
        }
      }
    }

    return segment;
  }

  /**
   * 信頼度の計算
   * 相関係数とサンプル数から信頼度を算出
   */
  static calculateConfidence(correlation, sampleSize) {
    // Fisher's z変換を使用した信頼度計算
    const z = 0.5 * Math.log((1 + correlation) / (1 - correlation));
    const standardError = 1 / Math.sqrt(sampleSize - 3);

    // 95%信頼区間での信頼度
    const confidenceLevel = Math.min(100, Math.abs(z / standardError) * 10);

    return confidenceLevel;
  }

  /**
   * ピーク位置の精緻化
   * サブピクセル精度での位置推定
   */
  static refinePeak(match, handData, laboxData, options) {
    const { dataInterval } = options;
    const refinementRange = 2 * dataInterval; // ±2データ点の範囲で精緻化

    let bestOffset = match.offset;
    let bestCorrelation = match.correlation;

    // より細かいステップで再検索
    const fineSteps = 10;
    const fineInterval = refinementRange / fineSteps;

    for (let i = -fineSteps; i <= fineSteps; i++) {
      const testOffset = match.offset + i * fineInterval;
      const correlation = this.calculateCorrelation(
        handData,
        laboxData,
        testOffset,
        options
      );

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = testOffset;
      }
    }

    return {
      ...match,
      offset: bestOffset,
      correlation: bestCorrelation,
      refined: true
    };
  }

  /**
   * マッチング統計の計算
   */
  static calculateMatchStatistics(results) {
    if (results.length === 0) {
      return null;
    }

    const correlations = results.map(r => r.correlation);
    const mean = correlations.reduce((a, b) => a + b, 0) / correlations.length;
    const max = Math.max(...correlations);
    const min = Math.min(...correlations);

    // ピークの鮮鋭度（最大値と次点の差）
    const sharpness = results.length > 1
      ? results[0].correlation - results[1].correlation
      : 1.0;

    return {
      mean: mean,
      max: max,
      min: min,
      sharpness: sharpness,
      peakCount: results.filter(r => r.correlation > mean + 0.1).length,
      isUnique: sharpness > 0.2 // ピークが明確かどうか
    };
  }

  /**
   * 複数区間での手検測データの統合マッチング
   * より確実な位置合わせのため
   */
  static multiSectionMatching(handMeasurements, laboxData, options = {}) {
    const {
      searchRange = 20,
      weightByLength = true,  // 長い区間により重みを与える
      verbose = true
    } = options;

    if (verbose) {
      console.log(`複数区間マッチング: ${handMeasurements.length}区間`);
    }

    const allResults = [];

    // 各区間でマッチング
    for (const section of handMeasurements) {
      const result = this.findBestMatch(
        section.data,
        laboxData,
        searchRange,
        { ...options, verbose: false }
      );

      if (result.success) {
        const weight = weightByLength
          ? section.data.length / 25  // 最大25mなので正規化
          : 1.0;

        allResults.push({
          ...result.bestMatch,
          sectionId: section.id,
          weight: weight
        });
      }
    }

    if (allResults.length === 0) {
      return {
        success: false,
        message: 'どの区間もマッチングできませんでした'
      };
    }

    // 重み付き平均でオフセットを決定
    const totalWeight = allResults.reduce((sum, r) => sum + r.weight, 0);
    const averageOffset = allResults.reduce(
      (sum, r) => sum + r.offset * r.weight, 0
    ) / totalWeight;

    // 信頼度の計算
    const offsetVariance = allResults.reduce(
      (sum, r) => sum + Math.pow(r.offset - averageOffset, 2) * r.weight, 0
    ) / totalWeight;
    const offsetStdDev = Math.sqrt(offsetVariance);

    const combinedConfidence = Math.min(
      100,
      (1 - offsetStdDev / searchRange) * 100
    );

    if (verbose) {
      console.log(`統合オフセット: ${averageOffset.toFixed(2)}m`);
      console.log(`標準偏差: ${offsetStdDev.toFixed(2)}m`);
      console.log(`統合信頼度: ${combinedConfidence.toFixed(2)}%`);
    }

    return {
      success: true,
      offset: averageOffset,
      confidence: combinedConfidence,
      standardDeviation: offsetStdDev,
      sectionResults: allResults
    };
  }
}

module.exports = CorrelationMatching;