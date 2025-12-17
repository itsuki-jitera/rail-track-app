/**
 * 復元波形計算エンジン
 * 測定データから復元波形を計算する統合モジュール
 *
 * 処理フロー:
 * 1. 測定データの読み込み
 * 2. 逆フィルタ（6m-40m帯域通過）適用
 * 3. 復元波形の計算
 * 4. 矢中弦変換（10m/20m/40m弦）
 * 5. 統計情報の算出
 */

const { InverseFilter } = require('./inverse-filter');
const { VersineConverter } = require('./versine-converter');
const PlanLineZeroPointSystem = require('./plan-line-zero-point');

class RestorationEngine {
  constructor(options = {}) {
    // 逆フィルタ
    this.inverseFilter = new InverseFilter({
      minWavelength: options.minWavelength || 6.0,
      maxWavelength: options.maxWavelength || 40.0,
      samplingInterval: options.samplingInterval || 0.25,
      filterOrder: options.filterOrder || 513,
      attenuationGain: options.attenuationGain || 0.01
    });

    // 矢中弦変換器
    this.versineConverter = new VersineConverter(
      options.samplingInterval || 0.25
    );

    // 計画線ゼロ点システム
    this.planLineZeroPointSystem = new PlanLineZeroPointSystem({
      samplingInterval: options.samplingInterval || 0.25,
      interpolationMethod: options.planLineInterpolation || 'spline'
    });

    // 計画線計算方法の選択
    this.planLineMethod = options.planLineMethod || 'zero-point'; // 'zero-point' or 'moving-average'

    this.samplingInterval = options.samplingInterval || 0.25;
  }

  /**
   * 復元波形を計算
   * @param {MeasurementData[]} measurementData - 測定データ配列
   * @param {Object} options - オプション
   * @param {boolean} options.calculateVersine - 矢中弦を計算するか（デフォルト: true）
   * @param {string[]} options.versineChords - 計算する弦長 (デフォルト: ['10m', '20m', '40m'])
   * @returns {RestorationWaveformResult} 復元結果
   */
  calculate(measurementData, options = {}) {
    const calculateVersine = options.calculateVersine !== false;
    const versineChords = options.versineChords || ['10m', '20m', '40m'];

    try {
      // 1. 元データの統計情報
      const originalStatistics = this.calculateStatistics(measurementData);

      // 2. 逆フィルタ適用
      const restoredWaveform = this.inverseFilter.applyToMeasurementData(measurementData);

      // 3. 復元波形の統計情報
      const restoredStatistics = this.calculateStatistics(restoredWaveform);

      // 4. 良化率の計算
      const improvementRate = this.calculateImprovementRate(
        originalStatistics.sigma,
        restoredStatistics.sigma
      );

      // 5. 矢中弦変換（オプション）
      let versineData = null;
      if (calculateVersine) {
        versineData = this.versineConverter.convertMultiple(
          restoredWaveform,
          versineChords
        );
      }

      // 6. 計画線の計算（ゼロ点方式または移動平均）
      const planLine = this.planLineMethod === 'zero-point'
        ? this.calculateZeroPointPlanLine(restoredWaveform, options.restrictions)
        : this.calculatePlanLine(restoredWaveform);

      // 7. 移動量データの計算
      const movementData = this.calculateMovementData(restoredWaveform, planLine);

      return {
        success: true,
        restoredWaveform,
        planLine,
        movementData,
        versineData,
        statistics: {
          original: originalStatistics,
          restored: restoredStatistics,
          improvementRate
        },
        filterParams: this.inverseFilter.getParameters()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 統計情報を計算
   * @param {MeasurementData[]} data - 測定データ配列
   * @returns {Object} 統計情報
   */
  calculateStatistics(data) {
    return this.versineConverter.calculateStatistics(data);
  }

  /**
   * 良化率を計算
   * @param {number} sigmaOriginal - 元データのσ値
   * @param {number} sigmaRestored - 復元波形のσ値
   * @returns {number} 良化率（%）
   */
  calculateImprovementRate(sigmaOriginal, sigmaRestored) {
    if (sigmaOriginal === 0) return 0;

    const rate = ((sigmaOriginal - sigmaRestored) / sigmaOriginal) * 100;
    return parseFloat(rate.toFixed(2));
  }

  /**
   * ゼロ点方式による計画線を計算
   * @param {MeasurementData[]} restoredWaveform - 復元波形
   * @param {Object} restrictions - 移動量制限
   * @returns {MeasurementData[]} 計画線データ
   */
  calculateZeroPointPlanLine(restoredWaveform, restrictions = {}) {
    try {
      // ゼロクロス点の検出
      const zeroCrossPoints = this.planLineZeroPointSystem.detectZeroCrossPoints(restoredWaveform);

      // 初期計画線の生成
      const initialPlanLine = this.planLineZeroPointSystem.generateInitialPlanLine(
        zeroCrossPoints,
        restoredWaveform
      );

      // 移動量制限による調整
      const adjustedPlanLine = this.planLineZeroPointSystem.adjustPlanLineWithRestrictions(
        initialPlanLine,
        restoredWaveform,
        restrictions
      );

      // 品質評価
      const quality = this.planLineZeroPointSystem.evaluatePlanLineQuality(
        adjustedPlanLine,
        restoredWaveform
      );

      console.log('ゼロ点計画線品質:', quality);

      return adjustedPlanLine;
    } catch (error) {
      console.error('ゼロ点計画線計算エラー:', error);
      console.log('フォールバック: 移動平均方式を使用');
      return this.calculatePlanLine(restoredWaveform);
    }
  }

  /**
   * 計画線を計算（移動平均による平滑化）
   * @param {MeasurementData[]} restoredWaveform - 復元波形
   * @param {number} windowSize - 移動平均の窓サイズ（デフォルト: 200m = 800点）
   * @returns {MeasurementData[]} 計画線データ
   */
  calculatePlanLine(restoredWaveform, windowSize = 800) {
    const length = restoredWaveform.length;
    const planLine = [];

    // データ点数が少ない場合は、より小さな窓サイズを使用
    const minPoints = 10;
    const adaptiveWindowSize = length < minPoints ? Math.max(3, Math.floor(length / 2)) :
                                length < 100 ? Math.floor(length / 4) :
                                length < windowSize ? Math.floor(length / 2) :
                                windowSize;

    console.log(`計画線計算: データ点数=${length}, 窓サイズ=${adaptiveWindowSize}`);

    // データ点数が極端に少ない場合（10点未満）は、スプライン補間を使用
    if (length < minPoints) {
      // 単純な線形補間で計画線を生成
      for (let i = 0; i < length; i++) {
        let value = restoredWaveform[i].value;

        // 前後の点との平均を取る（端点は除く）
        if (i > 0 && i < length - 1) {
          const prev = restoredWaveform[i - 1].value;
          const next = restoredWaveform[i + 1].value;
          value = (prev + value + next) / 3;
        }

        planLine.push({
          distance: restoredWaveform[i].distance,
          value: parseFloat(value.toFixed(3))
        });
      }

      return planLine;
    }

    // 通常の移動平均処理
    const halfWindow = Math.floor(adaptiveWindowSize / 2);

    for (let i = 0; i < length; i++) {
      let sum = 0.0;
      let count = 0;

      const startIdx = Math.max(0, i - halfWindow);
      const endIdx = Math.min(length - 1, i + halfWindow);

      for (let j = startIdx; j <= endIdx; j++) {
        sum += restoredWaveform[j].value;
        count++;
      }

      const average = count > 0 ? sum / count : 0;

      planLine.push({
        distance: restoredWaveform[i].distance,
        value: parseFloat(average.toFixed(3))
      });
    }

    return planLine;
  }

  /**
   * 移動量データを計算
   * @param {MeasurementData[]} restoredWaveform - 復元波形
   * @param {MeasurementData[]} planLine - 計画線
   * @returns {MovementData[]} 移動量データ
   */
  calculateMovementData(restoredWaveform, planLine) {
    const movementData = [];

    for (let i = 0; i < restoredWaveform.length; i++) {
      const tamping = restoredWaveform[i].value - planLine[i].value;
      const lining = 0; // 通り整正量は別途計算が必要

      movementData.push({
        distance: restoredWaveform[i].distance,
        tamping: parseFloat(tamping.toFixed(3)),
        lining: parseFloat(lining.toFixed(3))
      });
    }

    return movementData;
  }

  /**
   * バッチ処理: 複数の測定データを一括処理
   * @param {Array<{name: string, data: MeasurementData[]}>} dataList - 測定データリスト
   * @param {Object} options - オプション
   * @returns {Array<{name: string, result: RestorationWaveformResult}>} 処理結果リスト
   */
  batchCalculate(dataList, options = {}) {
    const results = [];

    for (const item of dataList) {
      const result = this.calculate(item.data, options);
      results.push({
        name: item.name,
        result
      });
    }

    return results;
  }

  /**
   * 処理結果をエクスポート（CSV形式）
   * @param {RestorationWaveformResult} result - 処理結果
   * @returns {string} CSV文字列
   */
  exportToCSV(result) {
    if (!result.success) {
      throw new Error('Cannot export failed result');
    }

    const { restoredWaveform, planLine, movementData } = result;

    const lines = [];

    // ヘッダー行
    lines.push('距離(m),測定値(mm),復元波形(mm),計画線(mm),こう上量(mm),移動量(mm)');

    // データ行
    for (let i = 0; i < restoredWaveform.length; i++) {
      const row = [
        restoredWaveform[i].distance,
        restoredWaveform[i].value,
        restoredWaveform[i].value,
        planLine[i].value,
        movementData[i].tamping,
        movementData[i].lining
      ];

      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * フィルタパラメータを取得
   * @returns {Object} パラメータ
   */
  getFilterParameters() {
    return this.inverseFilter.getParameters();
  }

  /**
   * フィルタパラメータを設定
   * @param {Object} params - パラメータ
   */
  setFilterParameters(params) {
    this.inverseFilter.setParameters(params);
  }

  /**
   * 周波数応答を取得（デバッグ用）
   * @param {number} numPoints - 計算点数
   * @returns {{frequencies: Float32Array, amplitudes: Float32Array, phases: Float32Array}} 周波数応答
   */
  getFrequencyResponse(numPoints = 512) {
    return this.inverseFilter.calculateFrequencyResponse(numPoints);
  }

  /**
   * インパルス応答を取得（デバッグ用）
   * @returns {Float32Array} インパルス応答
   */
  getImpulseResponse() {
    return this.inverseFilter.calculateImpulseResponse();
  }

  /**
   * 処理パイプラインの説明を取得
   * @returns {Array<string>} 処理ステップの説明
   */
  getProcessingPipeline() {
    return [
      '1. 測定データの読み込み',
      `2. 逆フィルタ適用 (${this.inverseFilter.minWavelength}m-${this.inverseFilter.maxWavelength}m 帯域通過)`,
      '3. 復元波形の計算 (コンボリューション)',
      '4. 矢中弦変換 (10m/20m/40m弦)',
      '5. 計画線の計算 (移動平均)',
      '6. 移動量データの算出',
      '7. 統計情報・良化率の計算'
    ];
  }
}

module.exports = { RestorationEngine };
