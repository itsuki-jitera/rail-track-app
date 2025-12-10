/**
 * 偏心矢計算 - 大規模データセット最適化版
 * Eccentric Versine Calculation - Optimized for Large Datasets
 *
 * 特徴:
 * - チャンク処理によるメモリ効率化
 * - プログレス通知機能
 * - Worker Thread対応（将来実装）
 */

const { EccentricVersine } = require('./eccentric-versine.js');

class EccentricVersineOptimized extends EccentricVersine {
  constructor(options = {}) {
    super(options);

    // 大規模データセット用の設定
    this.chunkSize = options.chunkSize || 10000; // チャンクサイズ（データ点数）
    this.enableProgress = options.enableProgress !== false; // プログレス通知の有効化
    this.progressCallback = options.progressCallback || null; // プログレスコールバック
  }

  /**
   * 大規模データセット用の偏心矢計算（チャンク処理版）
   *
   * @param {Array<{distance: number, value: number}>} measurementData - 測定データ
   * @param {number} p - 前方弦長（m）
   * @param {number} q - 後方弦長（m）
   * @returns {Object} 計算結果
   */
  calculateLarge(measurementData, p, q) {
    const totalPoints = measurementData.length;

    // データサイズに基づいた処理方法の選択
    if (totalPoints < this.chunkSize) {
      // 小規模データは通常処理
      return this.calculate(measurementData, p, q);
    }

    try {
      // プログレス通知開始
      this.notifyProgress(0, totalPoints, 'Starting calculation...');

      // 測定値を Float32Array に変換
      const values = new Float32Array(totalPoints);
      for (let i = 0; i < totalPoints; i++) {
        values[i] = measurementData[i].value;
      }

      // チャンクごとに処理
      const versineValues = this.calculateEccentricVersineChunked(values, p, q, totalPoints);

      // 結果を MeasurementData 形式に変換
      const versineData = [];
      for (let i = 0; i < totalPoints; i++) {
        versineData.push({
          distance: measurementData[i].distance,
          value: parseFloat(versineValues[i].toFixed(this.precision))
        });

        // プログレス通知（変換処理）
        if (i % 10000 === 0) {
          this.notifyProgress(i, totalPoints, 'Converting results...');
        }
      }

      // 統計情報計算
      this.notifyProgress(totalPoints, totalPoints, 'Calculating statistics...');
      const statistics = this.calculateStatistics(versineData);

      // 完了通知
      this.notifyProgress(totalPoints, totalPoints, 'Completed');

      return {
        success: true,
        data: versineData,
        statistics,
        parameters: {
          p,
          q,
          isSymmetric: p === q,
          pPoints: Math.round(p / this.samplingInterval),
          qPoints: Math.round(q / this.samplingInterval),
          totalPoints,
          chunked: true,
          chunkSize: this.chunkSize
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * チャンク処理による偏心矢計算
   * メモリ効率を最適化するため、オーバーラップ領域を考慮したチャンク処理
   *
   * @param {Float32Array} signal - 入力信号
   * @param {number} p - 前方弦長（m）
   * @param {number} q - 後方弦長（m）
   * @param {number} totalPoints - 総点数
   * @returns {Float32Array} 偏心矢データ
   */
  calculateEccentricVersineChunked(signal, p, q, totalPoints) {
    const versine = new Float32Array(totalPoints);
    const pPoints = Math.round(p / this.samplingInterval);
    const qPoints = Math.round(q / this.samplingInterval);

    // オーバーラップサイズ（境界での計算に必要）
    const overlapSize = Math.max(pPoints, qPoints);

    // チャンク数の計算
    const numChunks = Math.ceil(totalPoints / this.chunkSize);

    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
      const chunkStart = chunkIdx * this.chunkSize;
      const chunkEnd = Math.min(chunkStart + this.chunkSize, totalPoints);

      // チャンク内のデータを処理
      for (let i = chunkStart; i < chunkEnd; i++) {
        const leftIndex = i - qPoints;
        const rightIndex = i + pPoints;

        // 境界チェック
        if (leftIndex < 0 || rightIndex >= totalPoints) {
          versine[i] = 0.0;
          continue;
        }

        // 偏心矢計算
        const weightedAvg = (p * signal[leftIndex] + q * signal[rightIndex]) / (p + q);
        versine[i] = signal[i] - weightedAvg;
      }

      // プログレス通知
      this.notifyProgress(chunkEnd, totalPoints, `Processing chunk ${chunkIdx + 1}/${numChunks}`);
    }

    return versine;
  }

  /**
   * ストリーミング処理による偏心矢計算
   * 超大規模データセット（100万点以上）用
   *
   * @param {Generator} dataGenerator - データジェネレータ
   * @param {number} p - 前方弦長（m）
   * @param {number} q - 後方弦長（m）
   * @param {number} totalPoints - 総点数（事前にわかっている場合）
   * @returns {AsyncGenerator} 偏心矢データのジェネレータ
   */
  async* calculateStreaming(dataGenerator, p, q, totalPoints = null) {
    const pPoints = Math.round(p / this.samplingInterval);
    const qPoints = Math.round(q / this.samplingInterval);
    const bufferSize = Math.max(pPoints, qPoints) * 2 + this.chunkSize;

    const buffer = [];
    let index = 0;
    let processedCount = 0;

    for await (const dataPoint of dataGenerator) {
      buffer.push(dataPoint.value);

      // バッファが十分なサイズになったら処理
      if (buffer.length >= bufferSize || index >= totalPoints - 1) {
        // 処理可能な範囲を計算
        const startIdx = Math.max(0, index - buffer.length + 1);
        const processableStart = startIdx + qPoints;
        const processableEnd = Math.min(startIdx + buffer.length - pPoints, index + 1);

        // 偏心矢計算
        for (let i = processableStart; i < processableEnd; i++) {
          const bufferIdx = i - startIdx;
          const leftIdx = bufferIdx - qPoints;
          const rightIdx = bufferIdx + pPoints;

          if (leftIdx >= 0 && rightIdx < buffer.length) {
            const weightedAvg = (p * buffer[leftIdx] + q * buffer[rightIdx]) / (p + q);
            const versineValue = buffer[bufferIdx] - weightedAvg;

            yield {
              distance: dataPoint.distance,
              value: parseFloat(versineValue.toFixed(this.precision))
            };

            processedCount++;
            if (totalPoints && processedCount % 10000 === 0) {
              this.notifyProgress(processedCount, totalPoints, 'Streaming...');
            }
          }
        }

        // バッファの古いデータを削除（スライディングウィンドウ）
        const keepSize = Math.max(pPoints, qPoints) * 2;
        if (buffer.length > keepSize) {
          buffer.splice(0, buffer.length - keepSize);
        }
      }

      index++;
    }
  }

  /**
   * プログレス通知
   *
   * @param {number} current - 現在の進捗
   * @param {number} total - 総数
   * @param {string} message - メッセージ
   */
  notifyProgress(current, total, message = '') {
    if (!this.enableProgress) return;

    const progress = {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      message,
      timestamp: Date.now()
    };

    if (this.progressCallback && typeof this.progressCallback === 'function') {
      this.progressCallback(progress);
    }
  }

  /**
   * メモリ使用量の推定
   *
   * @param {number} dataPoints - データ点数
   * @param {number} p - 前方弦長
   * @param {number} q - 後方弦長
   * @returns {Object} メモリ使用量の推定値
   */
  static estimateMemoryUsage(dataPoints, p, q) {
    // Float32Array: 4 bytes per element
    const inputDataMemory = dataPoints * 4; // bytes
    const outputDataMemory = dataPoints * 4; // bytes

    // JavaScript オブジェクトのオーバーヘッド（推定値）
    const objectOverhead = dataPoints * 32; // bytes (distance + value + オブジェクト構造)

    const totalBytes = inputDataMemory + outputDataMemory + objectOverhead;
    const totalMB = totalBytes / (1024 * 1024);

    return {
      dataPoints,
      inputDataMemory: `${(inputDataMemory / 1024 / 1024).toFixed(2)} MB`,
      outputDataMemory: `${(outputDataMemory / 1024 / 1024).toFixed(2)} MB`,
      objectOverhead: `${(objectOverhead / 1024 / 1024).toFixed(2)} MB`,
      totalMemory: `${totalMB.toFixed(2)} MB`,
      totalBytes,
      recommendation: totalMB > 100 ? 'Use chunked processing' : 'Normal processing is fine'
    };
  }

  /**
   * 最適な処理方法を推奨
   *
   * @param {number} dataPoints - データ点数
   * @returns {string} 推奨される処理方法
   */
  static recommendProcessingMethod(dataPoints) {
    if (dataPoints < 10000) {
      return 'normal'; // 通常処理
    } else if (dataPoints < 100000) {
      return 'chunked'; // チャンク処理
    } else {
      return 'streaming'; // ストリーミング処理
    }
  }

  /**
   * アルゴリズム情報を取得
   *
   * @returns {Object} アルゴリズム情報
   */
  getAlgorithmInfo() {
    const baseInfo = super.getAlgorithmInfo();
    return {
      ...baseInfo,
      name: 'EccentricVersineOptimized',
      version: '2.0.0',
      description: 'Optimized Asymmetric Chord Configuration Versine Calculation for Large Datasets',
      optimizations: {
        chunkProcessing: true,
        streamingSupport: true,
        progressNotification: this.enableProgress,
        chunkSize: this.chunkSize
      }
    };
  }
}

module.exports = { EccentricVersineOptimized };
