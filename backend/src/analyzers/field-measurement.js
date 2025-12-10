/**
 * 手検測軌道狂いデータ分析器
 * PDFドキュメント P15の仕様に基づく実装
 * 現地測定データとキヤデータの相関計算・位置合わせ
 */

class FieldMeasurementAnalyzer {
  constructor(options = {}) {
    this.correlationRange = options.correlationRange || 20; // ±20m以内で相関を検索
    this.maxMeasurementPoints = options.maxMeasurementPoints || 25; // 最大25測点
    this.measurementInterval = options.measurementInterval || 1; // 1m間隔
  }

  /**
   * 手検測データを追加
   * @param {Object} fieldData - 手検測データ
   * @returns {Object} 追加されたデータ
   */
  addFieldMeasurement(fieldData) {
    const measurement = {
      id: this.generateId(),
      startPosition: fieldData.startPosition, // 開始キロ程（m）
      type: fieldData.type, // 'gauge'（軌間）, 'elevationLeft', 'elevationRight'
      values: this.validateMeasurementValues(fieldData.values),
      measurementDate: fieldData.measurementDate || new Date(),
      description: fieldData.description || ''
    };

    return measurement;
  }

  /**
   * 測定値の検証
   * 最大25点、1m間隔
   */
  validateMeasurementValues(values) {
    if (!Array.isArray(values)) {
      throw new Error('測定値は配列である必要があります');
    }

    if (values.length > this.maxMeasurementPoints) {
      console.warn(`測定点が最大値(${this.maxMeasurementPoints})を超えています。切り詰めます。`);
      return values.slice(0, this.maxMeasurementPoints);
    }

    // 数値検証と変換
    return values.map(v => {
      const numValue = parseFloat(v);
      if (isNaN(numValue)) {
        throw new Error(`無効な測定値: ${v}`);
      }
      return numValue;
    });
  }

  /**
   * キヤデータとの相関を計算
   * @param {Object} fieldMeasurement - 手検測データ
   * @param {Array} trackData - キヤデータ（軌道狂いデータ）
   * @returns {Object} 相関計算結果
   */
  calculateCorrelation(fieldMeasurement, trackData) {
    const results = [];
    const searchStart = fieldMeasurement.startPosition - this.correlationRange;
    const searchEnd = fieldMeasurement.startPosition + this.correlationRange;

    // 検索範囲内で相関を計算
    for (let offset = searchStart; offset <= searchEnd; offset += 1) {
      const correlation = this.computeCorrelationCoefficient(
        fieldMeasurement.values,
        trackData,
        offset
      );

      results.push({
        offset: offset,
        correlation: correlation,
        shift: offset - fieldMeasurement.startPosition
      });
    }

    // 最大相関を見つける
    const maxCorrelation = results.reduce((max, current) =>
      current.correlation > max.correlation ? current : max
    );

    return {
      bestMatch: maxCorrelation,
      allResults: results,
      fieldMeasurement: fieldMeasurement,
      recommendation: this.generateRecommendation(maxCorrelation)
    };
  }

  /**
   * 相関係数を計算（ピアソンの積率相関係数）
   */
  computeCorrelationCoefficient(fieldValues, trackData, startOffset) {
    const n = fieldValues.length;

    // トラックデータから対応する区間を抽出
    const trackSegment = this.extractTrackSegment(trackData, startOffset, n);

    if (trackSegment.length !== n) {
      return 0; // データ長が一致しない場合
    }

    // 平均値計算
    const fieldMean = fieldValues.reduce((a, b) => a + b, 0) / n;
    const trackMean = trackSegment.reduce((a, b) => a + b, 0) / n;

    // 相関係数計算
    let numerator = 0;
    let fieldDenominator = 0;
    let trackDenominator = 0;

    for (let i = 0; i < n; i++) {
      const fieldDiff = fieldValues[i] - fieldMean;
      const trackDiff = trackSegment[i] - trackMean;

      numerator += fieldDiff * trackDiff;
      fieldDenominator += fieldDiff * fieldDiff;
      trackDenominator += trackDiff * trackDiff;
    }

    const denominator = Math.sqrt(fieldDenominator * trackDenominator);

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  /**
   * トラックデータから指定区間を抽出
   */
  extractTrackSegment(trackData, startOffset, length) {
    const segment = [];

    for (let i = 0; i < length; i++) {
      const position = startOffset + i * this.measurementInterval;
      const dataPoint = this.findTrackDataAtPosition(trackData, position);

      if (dataPoint !== null) {
        segment.push(dataPoint);
      }
    }

    return segment;
  }

  /**
   * 指定位置のトラックデータを取得
   */
  findTrackDataAtPosition(trackData, position) {
    // trackDataが位置をキーとするオブジェクトの場合
    if (trackData[position] !== undefined) {
      return trackData[position];
    }

    // trackDataが配列の場合
    const dataPoint = trackData.find(d => d.position === position);
    return dataPoint ? dataPoint.value : null;
  }

  /**
   * 相関結果に基づく推奨事項を生成
   */
  generateRecommendation(correlationResult) {
    const correlation = correlationResult.correlation;
    const shift = correlationResult.shift;

    let confidence = '';
    let action = '';

    // 相関係数による信頼度判定
    if (correlation > 0.9) {
      confidence = '非常に高い';
      action = 'この位置合わせを採用することを強く推奨します';
    } else if (correlation > 0.7) {
      confidence = '高い';
      action = 'この位置合わせを採用することを推奨します';
    } else if (correlation > 0.5) {
      confidence = '中程度';
      action = '追加の手検測データで確認することを推奨します';
    } else {
      confidence = '低い';
      action = '手検測データの再測定を検討してください';
    }

    return {
      confidence: confidence,
      correlationCoefficient: correlation,
      positionShift: shift,
      action: action,
      adjustedStartPosition: correlationResult.offset
    };
  }

  /**
   * 複数の手検測データから最適な位置合わせを決定
   * @param {Array} fieldMeasurements - 複数の手検測データ
   * @param {Array} trackData - キヤデータ
   * @returns {Object} 統合された位置合わせ結果
   */
  integrateMultipleMeasurements(fieldMeasurements, trackData) {
    const correlations = fieldMeasurements.map(fm =>
      this.calculateCorrelation(fm, trackData)
    );

    // 重み付き平均でシフト量を決定
    let totalWeight = 0;
    let weightedShift = 0;

    correlations.forEach(result => {
      const weight = Math.max(0, result.bestMatch.correlation);
      totalWeight += weight;
      weightedShift += weight * result.bestMatch.shift;
    });

    const averageShift = totalWeight > 0 ? weightedShift / totalWeight : 0;

    return {
      recommendedShift: Math.round(averageShift),
      individualResults: correlations,
      overallConfidence: this.calculateOverallConfidence(correlations),
      summary: this.generateIntegrationSummary(correlations, averageShift)
    };
  }

  /**
   * 全体的な信頼度を計算
   */
  calculateOverallConfidence(correlations) {
    const avgCorrelation = correlations.reduce((sum, r) =>
      sum + r.bestMatch.correlation, 0) / correlations.length;

    if (avgCorrelation > 0.8) return '高';
    if (avgCorrelation > 0.6) return '中';
    return '低';
  }

  /**
   * 統合結果のサマリーを生成
   */
  generateIntegrationSummary(correlations, averageShift) {
    const summary = {
      measurementCount: correlations.length,
      averageCorrelation: correlations.reduce((sum, r) =>
        sum + r.bestMatch.correlation, 0) / correlations.length,
      recommendedAdjustment: averageShift,
      details: correlations.map((r, i) => ({
        measurement: i + 1,
        correlation: r.bestMatch.correlation.toFixed(3),
        shift: r.bestMatch.shift,
        position: r.fieldMeasurement.startPosition
      }))
    };

    return summary;
  }

  /**
   * 手検測データの可視化用データを生成
   * @param {Object} fieldMeasurement - 手検測データ
   * @param {number} bestOffset - 最適なオフセット
   * @returns {Array} チャート表示用データ
   */
  generateVisualizationData(fieldMeasurement, bestOffset) {
    const data = [];

    for (let i = 0; i < fieldMeasurement.values.length; i++) {
      data.push({
        position: bestOffset + i * this.measurementInterval,
        fieldValue: fieldMeasurement.values[i],
        measurementType: fieldMeasurement.type,
        index: i
      });
    }

    return data;
  }

  /**
   * CSVフォーマットで手検測データを出力
   * @param {Array} measurements - 手検測データ配列
   * @returns {string} CSV文字列
   */
  exportToCSV(measurements) {
    const headers = ['測定種別', '開始位置(m)', '測定値1', '測定値2', '...', '測定値25'];
    const rows = [];

    measurements.forEach(m => {
      const row = [
        this.getTypeLabel(m.type),
        m.startPosition,
        ...m.values
      ];
      rows.push(row);
    });

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * 測定種別のラベルを取得
   */
  getTypeLabel(type) {
    const labels = {
      'gauge': '軌間',
      'elevationLeft': '高低左',
      'elevationRight': '高低右'
    };
    return labels[type] || type;
  }

  /**
   * IDを生成
   */
  generateId() {
    return `fm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = FieldMeasurementAnalyzer;