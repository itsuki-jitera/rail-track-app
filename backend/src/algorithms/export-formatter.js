/**
 * データ出力フォーマッター
 * ALS/ALC/MJ/汎用形式への変換処理
 * 高精度な出力形式管理とバリデーション機能を含む
 */

class ExportFormatter {
  constructor() {
    // フォーマット定義
    this.formats = {
      ALS: {
        name: 'Auto Leveling System',
        extension: '.als',
        dataInterval: 5.0, // 標準5m間隔
        headerRequired: true,
        supportedDataTypes: ['height', 'alignment', 'cant', 'gauge', 'all']
      },
      ALC: {
        name: 'Auto Lining and Cant',
        extension: '.alc',
        dataInterval: 5.0, // 標準5m間隔
        headerRequired: true,
        supportedDataTypes: ['alignment', 'cant', 'combined']
      },
      MJ: {
        name: 'Machine Job Data',
        extension: '.mj',
        dataInterval: 0.5, // 0.5m間隔固定
        headerRequired: false,
        supportedDataTypes: ['movement', 'tamping', 'lining']
      },
      GENERAL: {
        name: 'General Format',
        extension: '.csv',
        dataInterval: 1.0, // 1m間隔標準
        headerRequired: false,
        supportedDataTypes: ['all']
      }
    };

    // 単位変換係数
    this.unitFactors = {
      m: 1.0,
      cm: 100.0,
      mm: 1000.0
    };
  }

  /**
   * ALS形式でエクスポート
   */
  exportALS(data, options = {}) {
    const format = this.formats.ALS;
    const {
      dataType = 'height',
      includeHeader = true,
      includeMetadata = true,
      decimalPlaces = 2,
      distanceUnit = 'm',
      coordinateSystem = 'relative',
      startKm = 0,
      endKm = null,
      section = 'UNKNOWN'
    } = options;

    // データ検証
    if (!this.validateData(data, format, dataType)) {
      throw new Error('Invalid data format for ALS export');
    }

    // データ間隔調整（5m間隔に変換）
    const resampledData = this.resampleData(data, format.dataInterval);

    // 出力内容の構築
    let output = '';

    // ヘッダー部
    if (includeHeader) {
      output += this.generateALSHeader({
        version: '2.0',
        date: new Date().toISOString().split('T')[0],
        section: section,
        dataType: dataType.toUpperCase(),
        coordinateSystem: coordinateSystem,
        startKm: startKm,
        endKm: endKm || startKm + (resampledData.length * format.dataInterval) / 1000,
        dataPoints: resampledData.length,
        interval: format.dataInterval,
        unit: distanceUnit
      });
    }

    // メタデータ部
    if (includeMetadata) {
      output += this.generateMetadata({
        processedAt: new Date().toISOString(),
        dataSource: 'Rail Track Restoration System',
        processingMethod: 'Restored Waveform',
        qualityScore: this.calculateQualityScore(resampledData),
        statistics: this.calculateStatistics(resampledData)
      });
    }

    // データ部
    output += '[DATA]\n';
    const unitFactor = this.unitFactors[distanceUnit] || 1.0;

    resampledData.forEach((point, index) => {
      const distance = (startKm * 1000 + index * format.dataInterval) / unitFactor;
      const value = this.formatValue(point.value, decimalPlaces);

      if (coordinateSystem === 'absolute') {
        const absolutePos = this.convertToAbsolute(distance, startKm);
        output += `${absolutePos.toFixed(2)},${value}\n`;
      } else {
        output += `${distance.toFixed(2)},${value}\n`;
      }
    });

    return {
      content: output,
      filename: `als_export_${dataType}_${Date.now()}${format.extension}`,
      mimeType: 'text/plain',
      metadata: {
        format: 'ALS',
        dataType: dataType,
        points: resampledData.length,
        interval: format.dataInterval
      }
    };
  }

  /**
   * ALC形式でエクスポート
   */
  exportALC(data, options = {}) {
    const format = this.formats.ALC;
    const {
      includeHeader = true,
      decimalPlaces = 2,
      section = 'UNKNOWN'
    } = options;

    // ALCは通りとカントの複合データ
    if (!data.alignment || !data.cant) {
      throw new Error('ALC export requires both alignment and cant data');
    }

    // データ間隔調整
    const alignmentResampled = this.resampleData(data.alignment, format.dataInterval);
    const cantResampled = this.resampleData(data.cant, format.dataInterval);

    let output = '';

    // ヘッダー
    if (includeHeader) {
      output += '[ALC_HEADER]\n';
      output += `VERSION=1.5\n`;
      output += `DATE=${new Date().toISOString().split('T')[0]}\n`;
      output += `SECTION=${section}\n`;
      output += `DATA_TYPE=ALIGNMENT_CANT\n`;
      output += `INTERVAL=${format.dataInterval}m\n`;
      output += '\n';
    }

    // データ部
    output += '[ALC_DATA]\n';
    output += 'DISTANCE,ALIGNMENT,CANT\n';

    for (let i = 0; i < alignmentResampled.length; i++) {
      const distance = i * format.dataInterval;
      const alignmentValue = this.formatValue(alignmentResampled[i].value, decimalPlaces);
      const cantValue = this.formatValue(cantResampled[i].value, decimalPlaces);
      output += `${distance.toFixed(1)},${alignmentValue},${cantValue}\n`;
    }

    return {
      content: output,
      filename: `alc_export_${Date.now()}${format.extension}`,
      mimeType: 'text/plain',
      metadata: {
        format: 'ALC',
        points: alignmentResampled.length,
        interval: format.dataInterval
      }
    };
  }

  /**
   * MJ作業データ形式でエクスポート
   */
  exportMJ(data, options = {}) {
    const format = this.formats.MJ;
    const {
      workType = 'tamping',
      machineType = '08-32',
      direction = 'forward',
      section = 'UNKNOWN'
    } = options;

    // 0.5m間隔固定でリサンプリング
    const resampledData = this.resampleData(data, format.dataInterval);

    let output = '';

    // MJ形式はヘッダーなし、直接データ
    output += `# MJ Work Data - ${workType.toUpperCase()}\n`;
    output += `# Machine: ${machineType}\n`;
    output += `# Direction: ${direction}\n`;
    output += `# Section: ${section}\n`;
    output += `# Generated: ${new Date().toISOString()}\n`;
    output += '#\n';

    // データ形式: 距離,作業量,優先度
    resampledData.forEach((point, index) => {
      const distance = index * format.dataInterval;
      const workAmount = Math.abs(point.value); // 作業量は絶対値
      const priority = this.calculateWorkPriority(point.value);

      output += `${distance.toFixed(1)},${workAmount.toFixed(1)},${priority}\n`;
    });

    return {
      content: output,
      filename: `mj_${workType}_${Date.now()}${format.extension}`,
      mimeType: 'text/plain',
      metadata: {
        format: 'MJ',
        workType: workType,
        points: resampledData.length,
        interval: format.dataInterval
      }
    };
  }

  /**
   * 汎用形式（CSV）でエクスポート
   */
  exportGeneral(data, options = {}) {
    const format = this.formats.GENERAL;
    const {
      includeAllColumns = false,
      delimiter = ',',
      decimalPlaces = 3,
      includeStatistics = false
    } = options;

    // 1m間隔でリサンプリング
    const resampledData = this.resampleData(data, format.dataInterval);

    let output = '';

    // ヘッダー行
    if (includeAllColumns) {
      output += 'Distance,Value,Gradient,Curvature,Quality\n';
    } else {
      output += 'Distance,Value\n';
    }

    // データ行
    resampledData.forEach((point, index) => {
      const distance = index * format.dataInterval;
      const value = this.formatValue(point.value, decimalPlaces);

      if (includeAllColumns) {
        const gradient = this.calculateGradient(resampledData, index);
        const curvature = this.calculateCurvature(resampledData, index);
        const quality = this.assessPointQuality(point);

        output += `${distance}${delimiter}${value}${delimiter}`;
        output += `${gradient.toFixed(4)}${delimiter}`;
        output += `${curvature.toFixed(6)}${delimiter}`;
        output += `${quality}\n`;
      } else {
        output += `${distance}${delimiter}${value}\n`;
      }
    });

    // 統計情報追加
    if (includeStatistics) {
      const stats = this.calculateStatistics(resampledData);
      output += '\n# Statistics\n';
      output += `# Mean: ${stats.mean.toFixed(3)}\n`;
      output += `# Std Dev: ${stats.stdDev.toFixed(3)}\n`;
      output += `# Min: ${stats.min.toFixed(3)}\n`;
      output += `# Max: ${stats.max.toFixed(3)}\n`;
      output += `# RMS: ${stats.rms.toFixed(3)}\n`;
    }

    return {
      content: output,
      filename: `export_${Date.now()}${format.extension}`,
      mimeType: 'text/csv',
      metadata: {
        format: 'GENERAL',
        points: resampledData.length,
        interval: format.dataInterval
      }
    };
  }

  /**
   * データのリサンプリング
   */
  resampleData(data, targetInterval) {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    // 現在のデータ間隔を推定
    const currentInterval = this.estimateInterval(data);

    if (Math.abs(currentInterval - targetInterval) < 0.01) {
      // 間隔が同じなら変換不要
      return data;
    }

    // リサンプリング実行
    const resampled = [];
    const ratio = targetInterval / currentInterval;

    for (let i = 0; i < data.length; i += ratio) {
      const index = Math.floor(i);
      const fraction = i - index;

      if (index + 1 < data.length) {
        // 線形補間
        const value = data[index].value * (1 - fraction) +
                     data[index + 1].value * fraction;
        resampled.push({
          distance: resampled.length * targetInterval,
          value: value
        });
      } else if (index < data.length) {
        resampled.push({
          distance: resampled.length * targetInterval,
          value: data[index].value
        });
      }
    }

    return resampled;
  }

  /**
   * ALSヘッダー生成
   */
  generateALSHeader(params) {
    let header = '[HEADER]\n';
    header += `VERSION=${params.version}\n`;
    header += `DATE=${params.date}\n`;
    header += `SECTION=${params.section}\n`;
    header += `DATA_TYPE=${params.dataType}\n`;
    header += `COORDINATE_SYSTEM=${params.coordinateSystem.toUpperCase()}\n`;
    header += `START_KM=${params.startKm}\n`;
    header += `END_KM=${params.endKm}\n`;
    header += `DATA_POINTS=${params.dataPoints}\n`;
    header += `INTERVAL=${params.interval}m\n`;
    header += `UNIT=${params.unit}\n`;
    header += '\n';
    return header;
  }

  /**
   * メタデータ生成
   */
  generateMetadata(params) {
    let metadata = '[METADATA]\n';
    metadata += `PROCESSED_AT=${params.processedAt}\n`;
    metadata += `DATA_SOURCE=${params.dataSource}\n`;
    metadata += `PROCESSING_METHOD=${params.processingMethod}\n`;
    metadata += `QUALITY_SCORE=${params.qualityScore.toFixed(2)}\n`;
    metadata += `MEAN=${params.statistics.mean.toFixed(3)}\n`;
    metadata += `STD_DEV=${params.statistics.stdDev.toFixed(3)}\n`;
    metadata += `MIN=${params.statistics.min.toFixed(3)}\n`;
    metadata += `MAX=${params.statistics.max.toFixed(3)}\n`;
    metadata += '\n';
    return metadata;
  }

  /**
   * データ検証
   */
  validateData(data, format, dataType) {
    if (!data || !Array.isArray(data)) {
      return false;
    }

    if (!format.supportedDataTypes.includes(dataType) &&
        !format.supportedDataTypes.includes('all')) {
      return false;
    }

    // データ構造の検証
    return data.every(point =>
      typeof point === 'object' &&
      'value' in point &&
      typeof point.value === 'number' &&
      !isNaN(point.value)
    );
  }

  /**
   * 統計計算
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

    return { mean, stdDev, min, max, rms, variance };
  }

  /**
   * 品質スコア計算
   */
  calculateQualityScore(data) {
    const stats = this.calculateStatistics(data);

    // 品質スコアは標準偏差とRMSから算出
    let score = 100;

    // 標準偏差による減点
    if (stats.stdDev > 10) score -= 20;
    else if (stats.stdDev > 5) score -= 10;
    else if (stats.stdDev > 2) score -= 5;

    // RMS値による減点
    if (stats.rms > 15) score -= 20;
    else if (stats.rms > 7) score -= 10;
    else if (stats.rms > 3) score -= 5;

    // 極値による減点
    if (Math.abs(stats.max) > 30 || Math.abs(stats.min) > 30) score -= 15;

    return Math.max(0, score);
  }

  /**
   * 作業優先度計算
   */
  calculateWorkPriority(value) {
    const absValue = Math.abs(value);

    if (absValue > 20) return 1; // 最高優先度
    if (absValue > 10) return 2;
    if (absValue > 5) return 3;
    if (absValue > 2) return 4;
    return 5; // 最低優先度
  }

  /**
   * データ間隔推定
   */
  estimateInterval(data) {
    if (data.length < 2) return 0.25;

    // 最初の数点から間隔を推定
    const intervals = [];
    for (let i = 1; i < Math.min(10, data.length); i++) {
      if (data[i].distance !== undefined && data[i-1].distance !== undefined) {
        intervals.push(data[i].distance - data[i-1].distance);
      }
    }

    if (intervals.length === 0) return 0.25; // デフォルト

    // 中央値を採用
    intervals.sort((a, b) => a - b);
    return intervals[Math.floor(intervals.length / 2)];
  }

  /**
   * 勾配計算
   */
  calculateGradient(data, index) {
    if (index === 0 || index === data.length - 1) {
      return 0;
    }

    const interval = this.estimateInterval(data);
    return (data[index + 1].value - data[index - 1].value) / (2 * interval);
  }

  /**
   * 曲率計算
   */
  calculateCurvature(data, index) {
    if (index <= 0 || index >= data.length - 1) {
      return 0;
    }

    const interval = this.estimateInterval(data);
    const secondDerivative = (data[index + 1].value - 2 * data[index].value + data[index - 1].value) / (interval * interval);

    return secondDerivative;
  }

  /**
   * 点品質評価
   */
  assessPointQuality(point) {
    const absValue = Math.abs(point.value);

    if (absValue > 30) return 'Poor';
    if (absValue > 15) return 'Fair';
    if (absValue > 5) return 'Good';
    return 'Excellent';
  }

  /**
   * 相対座標から絶対座標への変換
   */
  convertToAbsolute(relativeDistance, startKm) {
    return startKm * 1000 + relativeDistance;
  }

  /**
   * 値のフォーマット
   */
  formatValue(value, decimalPlaces) {
    return value.toFixed(decimalPlaces);
  }
}

module.exports = ExportFormatter;