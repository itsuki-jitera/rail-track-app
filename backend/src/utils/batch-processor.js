/**
 * バッチ処理ユーティリティ
 * Batch Processing Utility
 *
 * 複数ファイルの一括処理と結果の統合
 */

const fs = require('fs').promises;
const path = require('path');
const { EccentricVersine } = require('../algorithms/eccentric-versine');
const { EccentricVersineOptimized } = require('../algorithms/eccentric-versine-optimized');

class BatchProcessor {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5; // 同時処理数
    this.timeout = options.timeout || 60000; // タイムアウト（ミリ秒）
    this.enableOptimization = options.enableOptimization !== false; // 最適化の有効化
    this.progressCallback = options.progressCallback || null;
  }

  /**
   * 複数ファイルのバッチ処理
   *
   * @param {Array} files - 処理対象ファイルの配列
   * @param {Object} processingOptions - 処理オプション
   * @returns {Promise<Object>} バッチ処理結果
   */
  async processBatch(files, processingOptions = {}) {
    const startTime = Date.now();
    const results = [];
    const errors = [];

    // 進捗通知
    const totalFiles = files.length;
    let processedFiles = 0;

    this.notifyProgress({
      type: 'start',
      totalFiles,
      processedFiles: 0,
      message: `バッチ処理を開始します（${totalFiles}ファイル）`
    });

    // ファイルをチャンクに分割（同時処理数に基づいて）
    const chunks = this.chunkArray(files, this.maxConcurrent);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (file) => {
        try {
          const result = await this.processFile(file, processingOptions);
          processedFiles++;

          this.notifyProgress({
            type: 'file_complete',
            totalFiles,
            processedFiles,
            filename: file.filename,
            message: `${file.filename} の処理が完了しました (${processedFiles}/${totalFiles})`
          });

          return {
            success: true,
            filename: file.filename,
            ...result
          };
        } catch (error) {
          processedFiles++;
          errors.push({
            filename: file.filename,
            error: error.message
          });

          this.notifyProgress({
            type: 'file_error',
            totalFiles,
            processedFiles,
            filename: file.filename,
            error: error.message,
            message: `${file.filename} の処理に失敗しました: ${error.message}`
          });

          return {
            success: false,
            filename: file.filename,
            error: error.message
          };
        }
      });

      // チャンクの処理を待機
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // 統計情報の計算
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // 完了通知
    this.notifyProgress({
      type: 'complete',
      totalFiles,
      processedFiles: totalFiles,
      successCount,
      failureCount,
      processingTime,
      message: `バッチ処理が完了しました (成功: ${successCount}, 失敗: ${failureCount})`
    });

    return {
      summary: {
        totalFiles,
        successCount,
        failureCount,
        processingTime,
        processingTimeSeconds: processingTime / 1000,
        averageTimePerFile: processingTime / totalFiles
      },
      results,
      errors
    };
  }

  /**
   * 単一ファイルの処理
   *
   * @param {Object} file - ファイル情報
   * @param {Object} options - 処理オプション
   * @returns {Promise<Object>} 処理結果
   */
  async processFile(file, options) {
    const { p = 10, q = 5, samplingInterval = 0.25, calculationType = 'versine' } = options;

    // ファイルデータの読み込み（実際の実装ではファイル読み込み処理が必要）
    const measurementData = await this.loadFileData(file);

    // データサイズに基づいて最適化版を使用するか判定
    const dataSize = measurementData.length;
    const useOptimized = this.enableOptimization && dataSize >= 10000;

    let calculator;
    if (useOptimized) {
      calculator = new EccentricVersineOptimized({
        samplingInterval,
        chunkSize: 10000,
        enableProgress: false
      });
    } else {
      calculator = new EccentricVersine({ samplingInterval });
    }

    let result;
    const startTime = process.hrtime.bigint();

    switch (calculationType) {
      case 'versine':
        // 偏心矢計算
        if (useOptimized) {
          result = calculator.calculateLarge(measurementData, p, q);
        } else {
          result = calculator.calculate(measurementData, p, q);
        }
        break;

      case 'characteristics':
        // 検測特性計算
        const wavelengthRange = options.wavelengthRange || { min: 1, max: 200, step: 1 };
        const wavelengths = [];
        for (let w = wavelengthRange.min; w <= wavelengthRange.max; w += wavelengthRange.step) {
          wavelengths.push(w);
        }
        result = {
          characteristics: calculator.calculateMeasurementCharacteristics(p, q, wavelengths)
        };
        break;

      case 'conversion':
        // 偏心矢変換
        const { p2, q2 } = options;
        const values = new Float32Array(measurementData.map(d => d.value));
        const converted = calculator.convertVersine(values, p, q, p2, q2, options.wavelength || 20.0);
        result = {
          data: measurementData.map((d, i) => ({
            distance: d.distance,
            originalValue: d.value,
            value: converted[i]
          })),
          parameters: {
            source: { p, q },
            target: { p: p2, q: q2 }
          }
        };
        break;

      default:
        throw new Error(`Unknown calculation type: ${calculationType}`);
    }

    const endTime = process.hrtime.bigint();
    const processingTimeNs = Number(endTime - startTime);
    const processingTimeMs = processingTimeNs / 1e6;

    // 統計情報を追加
    if (!result.statistics && result.data) {
      result.statistics = calculator.calculateStatistics(result.data);
    }

    return {
      ...result,
      metadata: {
        filename: file.filename,
        filesize: file.size,
        dataPoints: dataSize,
        calculationType,
        useOptimized,
        processingTimeMs,
        parameters: { p, q, samplingInterval }
      }
    };
  }

  /**
   * ファイルデータの読み込み（仮実装）
   *
   * @param {Object} file - ファイル情報
   * @returns {Promise<Array>} 測定データ
   */
  async loadFileData(file) {
    // 実際の実装では、ファイルタイプに応じて適切なパーサーを使用
    if (file.data) {
      return file.data;
    }

    if (file.path) {
      // ファイルパスから読み込み
      const content = await fs.readFile(file.path, 'utf8');
      return this.parseCSV(content);
    }

    throw new Error('No file data available');
  }

  /**
   * CSVパース（簡易版）
   *
   * @param {string} content - CSVコンテンツ
   * @returns {Array} パース結果
   */
  parseCSV(content) {
    const lines = content.trim().split('\n');
    const data = [];

    for (let i = 1; i < lines.length; i++) { // ヘッダーをスキップ
      const cols = lines[i].split(',');
      if (cols.length >= 2) {
        data.push({
          distance: parseFloat(cols[0]),
          value: parseFloat(cols[1])
        });
      }
    }

    return data;
  }

  /**
   * 配列をチャンクに分割
   *
   * @param {Array} array - 分割対象の配列
   * @param {number} chunkSize - チャンクサイズ
   * @returns {Array} チャンクの配列
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 進捗通知
   *
   * @param {Object} progress - 進捗情報
   */
  notifyProgress(progress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }

    // コンソールログ出力（デバッグ用）
    const percentage = progress.totalFiles > 0
      ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
      : 0;

    console.log(`[${percentage}%] ${progress.message}`);
  }

  /**
   * バッチ処理結果の統合
   *
   * @param {Array} results - 個別処理結果の配列
   * @returns {Object} 統合結果
   */
  static consolidateResults(results) {
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0) {
      return {
        success: false,
        message: 'All files failed to process'
      };
    }

    // 全体統計の計算
    let totalPoints = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;
    let sumValue = 0;

    successfulResults.forEach(result => {
      if (result.statistics) {
        totalPoints += result.metadata?.dataPoints || 0;
        minValue = Math.min(minValue, result.statistics.min);
        maxValue = Math.max(maxValue, result.statistics.max);
        sumValue += (result.statistics.mean || 0) * (result.metadata?.dataPoints || 0);
      }
    });

    const overallMean = totalPoints > 0 ? sumValue / totalPoints : 0;

    return {
      success: true,
      fileCount: successfulResults.length,
      totalDataPoints: totalPoints,
      overallStatistics: {
        min: minValue,
        max: maxValue,
        mean: overallMean,
        range: maxValue - minValue
      },
      files: successfulResults.map(r => ({
        filename: r.metadata?.filename || r.filename,
        dataPoints: r.metadata?.dataPoints || 0,
        statistics: r.statistics
      }))
    };
  }

  /**
   * バッチ処理設定の検証
   *
   * @param {Object} config - バッチ処理設定
   * @returns {Object} 検証結果
   */
  static validateBatchConfig(config) {
    const errors = [];
    const warnings = [];

    // 必須パラメータのチェック
    if (!config.files || !Array.isArray(config.files) || config.files.length === 0) {
      errors.push('ファイルリストが指定されていません');
    }

    // パラメータの検証
    if (config.p !== undefined && (typeof config.p !== 'number' || config.p <= 0)) {
      errors.push('パラメータpは正の数値である必要があります');
    }

    if (config.q !== undefined && (typeof config.q !== 'number' || config.q <= 0)) {
      errors.push('パラメータqは正の数値である必要があります');
    }

    // 警告のチェック
    if (config.files && config.files.length > 100) {
      warnings.push('大量のファイル（100以上）を処理します。処理に時間がかかる可能性があります');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = { BatchProcessor };