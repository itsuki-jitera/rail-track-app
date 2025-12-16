/**
 * 軌道データ統合サービス
 *
 * 仕様書「057_復元波形を用いた軌道整正計算の操作手順」に基づく実装
 * - 複数データソースの統合
 * - 作業方向による符号調整
 * - 手検測データの統合
 * - エクスポート処理の統括
 */

const path = require('path');
const fs = require('fs').promises;

// パーサー群
const { RSQParser } = require('../parsers/rsq-parser');
const LaboxParser = require('../parsers/labox-parser');
const KilometerDataParser = require('../parsers/kk-kdt-parser');
const MTTParser = require('../parsers/mtt-parser');

// アルゴリズム群
const RestorationWaveform = require('../algorithms/restoration-waveform');
const ConvexPlanLine = require('../algorithms/convex-plan-line');
const CurveTrapezoid = require('../algorithms/curve-trapezoid');
const VerticalCurveExclusion = require('../algorithms/vertical-curve-exclusion');
const CantCalculation = require('../algorithms/cant-calculation');
const CorrelationMatching = require('../algorithms/correlation-matching');
const ALSCorrection = require('../algorithms/als-correction');

// エクスポーター群
const ALSDataExporter = require('../exporters/als-exporter');
const MTTDataExporter = require('../exporters/mtt-data-exporter');
const CSVMovementExporter = require('../exporters/csv-movement-exporter');

class TrackDataIntegrationService {
  constructor(options = {}) {
    this.workDirection = options.workDirection || 'up';  // 作業方向（up/down）
    this.dataDirectory = options.dataDirectory || './data';
    this.outputDirectory = options.outputDirectory || './output';
    this.verbose = options.verbose !== false;
  }

  /**
   * 完全な軌道整正処理フロー
   */
  async processTrackCorrection(filePrefix, workSection) {
    try {
      console.log('=== 軌道整正処理開始 ===');
      console.log(`ファイルプレフィックス: ${filePrefix}`);
      console.log(`作業区間: ${workSection.startKm}km - ${workSection.endKm}km`);

      // 1. データ読み込みと統合
      const trackData = await this.loadAndIntegrateData(filePrefix);

      // 2. 作業方向による符号調整
      const adjustedData = this.adjustSignsByDirection(trackData);

      // 3. 手検測データの統合（存在する場合）
      const integratedData = await this.integrateHandMeasurements(adjustedData, workSection);

      // 4. 復元波形計算
      const restorationResult = await this.calculateRestorationWaveform(integratedData);

      // 5. 計画線生成（こう上優先）
      const planLine = await this.generatePlanLine(restorationResult, workSection);

      // 6. 移動量計算
      const movementData = this.calculateMovementAmount(restorationResult, planLine);

      // 7. MTT補正計算
      const mttCorrectedData = await this.applyMTTCorrection(movementData, workSection);

      // 8. データエクスポート
      const exportResults = await this.exportAllFormats(
        mttCorrectedData,
        workSection,
        filePrefix
      );

      console.log('=== 軌道整正処理完了 ===');

      return {
        success: true,
        trackData: integratedData,
        restorationWaveform: restorationResult,
        planLine: planLine,
        movementData: mttCorrectedData,
        exports: exportResults
      };

    } catch (error) {
      console.error('軌道整正処理エラー:', error);
      throw error;
    }
  }

  /**
   * データ読み込みと統合
   */
  async loadAndIntegrateData(filePrefix) {
    const results = {};

    // キロ程データ（KK.KDT）
    const kilometerFile = path.join(this.dataDirectory, `${filePrefix}KK.KDT`);
    if (await this.fileExists(kilometerFile)) {
      const parser = new KilometerDataParser();
      const buffer = await fs.readFile(kilometerFile);
      results.kilometer = parser.parse(buffer);
    }

    // RSQファイル群
    const rsqTypes = ['1C', '2C', '5C', '6C', 'SC', 'GC', 'AC', 'RC'];
    for (const type of rsqTypes) {
      const rsqFile = path.join(this.dataDirectory, `${filePrefix}${type}.RSQ`);
      if (await this.fileExists(rsqFile)) {
        const parser = new RSQParser();
        const buffer = await fs.readFile(rsqFile);
        const parsed = parser.parse(buffer);
        results[this.getDataTypeKey(type)] = parser.toMeasurementData(parsed);
      }
    }

    // データ統合
    return this.integrateAllData(results);
  }

  /**
   * 全データの統合
   */
  integrateAllData(parsedData) {
    const integrated = [];

    // 位置範囲を決定
    let minPosition = Infinity;
    let maxPosition = -Infinity;

    Object.values(parsedData).forEach(data => {
      if (Array.isArray(data)) {
        data.forEach(point => {
          if (point.distance !== undefined) {
            minPosition = Math.min(minPosition, point.distance);
            maxPosition = Math.max(maxPosition, point.distance);
          }
        });
      }
    });

    // 0.25m間隔でデータ点を生成
    const interval = 0.25;
    for (let pos = minPosition; pos <= maxPosition; pos += interval) {
      const point = {
        position: pos,
        kilometer: pos / 1000
      };

      // 各データタイプから値を取得
      if (parsedData.levelRight) {
        point.levelRight = this.findValueAtPosition(parsedData.levelRight, pos);
      }
      if (parsedData.levelLeft) {
        point.levelLeft = this.findValueAtPosition(parsedData.levelLeft, pos);
      }
      if (parsedData.alignmentRight) {
        point.alignmentRight = this.findValueAtPosition(parsedData.alignmentRight, pos);
      }
      if (parsedData.alignmentLeft) {
        point.alignmentLeft = this.findValueAtPosition(parsedData.alignmentLeft, pos);
      }
      if (parsedData.cant) {
        point.cant = this.findValueAtPosition(parsedData.cant, pos);
      }
      if (parsedData.gauge) {
        point.gauge = this.findValueAtPosition(parsedData.gauge, pos);
      }
      if (parsedData.atsDetection) {
        point.atsDetection = this.hasDetectionAtPosition(parsedData.atsDetection, pos);
      }
      if (parsedData.jointDetection) {
        point.jointDetection = this.hasDetectionAtPosition(parsedData.jointDetection, pos);
      }

      integrated.push(point);
    }

    return integrated;
  }

  /**
   * 作業方向による符号調整
   */
  adjustSignsByDirection(trackData) {
    return trackData.map(point => {
      const adjusted = { ...point };

      // 通りの符号調整
      // 起点を背にして右カーブが正
      if (this.workDirection === 'down') {
        // 下り方向の場合、符号を反転
        if (adjusted.alignmentRight !== null) {
          adjusted.alignmentRight = -adjusted.alignmentRight;
        }
        if (adjusted.alignmentLeft !== null) {
          adjusted.alignmentLeft = -adjusted.alignmentLeft;
        }
      }

      // カントの符号調整
      // 前を向いて左カントがプラス
      if (this.workDirection === 'down') {
        if (adjusted.cant !== null) {
          adjusted.cant = -adjusted.cant;
        }
      }

      return adjusted;
    });
  }

  /**
   * 手検測データの統合
   */
  async integrateHandMeasurements(trackData, workSection) {
    const handMeasurementFile = path.join(
      this.dataDirectory,
      `hand_measurement_${workSection.id}.json`
    );

    if (!await this.fileExists(handMeasurementFile)) {
      return trackData;  // 手検測データなし
    }

    const handData = JSON.parse(await fs.readFile(handMeasurementFile, 'utf8'));

    // 相関マッチングで位置合わせ
    const matchResult = CorrelationMatching.findBestMatch(
      handData,
      trackData,
      20  // ±20mの検索範囲
    );

    if (matchResult.correlation < 0.7) {
      console.warn('手検測データの相関が低い:', matchResult.correlation);
      return trackData;
    }

    // データ統合
    return this.mergeHandMeasurementData(trackData, handData, matchResult.offset);
  }

  /**
   * 手検測データのマージ
   */
  mergeHandMeasurementData(trackData, handData, offset) {
    return trackData.map(point => {
      const handPoint = handData.find(h =>
        Math.abs((h.position + offset) - point.position) < 0.1
      );

      if (handPoint) {
        return {
          ...point,
          levelLeft: handPoint.levelLeft || point.levelLeft,
          levelRight: handPoint.levelRight || point.levelRight,
          gauge: handPoint.gauge || point.gauge,
          handMeasurement: true
        };
      }

      return point;
    });
  }

  /**
   * 復元波形計算
   */
  async calculateRestorationWaveform(trackData) {
    const options = {
      method: 'fft',
      windowSize: 100,
      minWavelength: 6,   // MTT用は6m
      maxWavelength: 40,
      verbose: this.verbose
    };

    // 高低と通りの復元波形を計算
    const levelData = trackData.map(p => ({
      position: p.position,
      value: (p.levelLeft + p.levelRight) / 2  // 左右平均
    }));

    const alignmentData = trackData.map(p => ({
      position: p.position,
      value: (p.alignmentLeft + p.alignmentRight) / 2
    }));

    const levelRestoration = RestorationWaveform.calculateRestorationWaveform(
      levelData,
      options
    );

    const alignmentRestoration = RestorationWaveform.calculateRestorationWaveform(
      alignmentData,
      options
    );

    return {
      level: levelRestoration,
      alignment: alignmentRestoration,
      originalData: trackData
    };
  }

  /**
   * 計画線生成（こう上優先）
   */
  async generatePlanLine(restorationResult, workSection) {
    const options = {
      priorityMode: 'upward',  // こう上優先
      maxDownward: 10,         // 最大下方向移動量 10mm
      maxUpward: 50,          // 最大上方向移動量 50mm
      targetUpwardRatio: 0.7,  // 目標こう上率 70%
      verbose: this.verbose
    };

    // 高低の計画線
    const levelPlan = ConvexPlanLine.generateConvexPlan(
      restorationResult.level.restoredWaveform,
      options
    );

    // 通りの計画線
    const alignmentPlan = ConvexPlanLine.generateConvexPlan(
      restorationResult.alignment.restoredWaveform,
      options
    );

    return {
      level: levelPlan,
      alignment: alignmentPlan
    };
  }

  /**
   * 移動量計算
   */
  calculateMovementAmount(restorationResult, planLine) {
    const movements = [];

    for (let i = 0; i < restorationResult.originalData.length; i++) {
      const original = restorationResult.originalData[i];
      const levelPlan = planLine.level.planLine[i];
      const alignmentPlan = planLine.alignment.planLine[i];

      movements.push({
        position: original.position,
        kilometer: original.kilometer,

        // 垂直移動量（高低）
        verticalMovement: levelPlan ? levelPlan.value - original.levelLeft : 0,
        verticalMovementRight: levelPlan ? levelPlan.value - original.levelRight : 0,

        // 水平移動量（通り）
        lateralMovement: alignmentPlan ? alignmentPlan.value - original.alignmentLeft : 0,
        lateralMovementRight: alignmentPlan ? alignmentPlan.value - original.alignmentRight : 0,

        // 元データ
        originalLevel: (original.levelLeft + original.levelRight) / 2,
        originalAlignment: (original.alignmentLeft + original.alignmentRight) / 2,

        // 計画線
        lateralPlanLine: alignmentPlan ? alignmentPlan.value : 0,
        verticalPlanLine: levelPlan ? levelPlan.value : 0
      });
    }

    return movements;
  }

  /**
   * MTT補正の適用
   */
  async applyMTTCorrection(movementData, workSection) {
    // MTT種別の判定
    const mttType = workSection.mttType || '08-475';

    const mttExporter = new MTTDataExporter({ mttType });

    // MTT用仕上がり予測波形（6m未満除去）
    const mttPrediction = await mttExporter.calculateMTTPrediction(
      movementData.map(d => ({
        position: d.position,
        lateral: d.lateralMovement,
        vertical: d.verticalMovement
      })),
      movementData
    );

    // MTT補正値の計算と適用
    return movementData.map((point, index) => {
      const prediction = mttPrediction[index] || {};

      return {
        ...point,
        lateralMovementMTT: prediction.lateral || point.lateralMovement,
        verticalMovementMTT: prediction.vertical || point.verticalMovement,
        alignmentPrediction: prediction.lateral || 0,
        levelPrediction: prediction.vertical || 0
      };
    });
  }

  /**
   * 全フォーマットへのエクスポート
   */
  async exportAllFormats(movementData, workSection, filePrefix) {
    const results = {};

    // ALSエクスポート
    const alsExporter = new ALSDataExporter();
    results.als = await alsExporter.exportALSData(
      movementData.map(d => ({
        lateral: d.lateralMovementMTT,
        vertical: d.verticalMovementMTT
      })),
      workSection
    );

    // MTTエクスポート
    const mttExporter = new MTTDataExporter({ mttType: workSection.mttType });
    results.mtt = await mttExporter.exportMTTData(
      movementData,
      null,  // カーブデータ（必要に応じて追加）
      workSection
    );

    // CSVエクスポート
    const csvExporter = new CSVMovementExporter();
    results.csv = await csvExporter.exportMovementCSV(
      movementData,
      workSection
    );

    return results;
  }

  /**
   * データタイプキーの取得
   */
  getDataTypeKey(typeCode) {
    const mapping = {
      '1C': 'levelRight',
      '2C': 'levelLeft',
      '5C': 'alignmentRight',
      '6C': 'alignmentLeft',
      'SC': 'cant',
      'GC': 'gauge',
      'AC': 'atsDetection',
      'RC': 'jointDetection'
    };
    return mapping[typeCode] || typeCode;
  }

  /**
   * 指定位置の値を検索
   */
  findValueAtPosition(dataArray, position) {
    const point = dataArray.find(p =>
      Math.abs(p.distance - position) < 0.125
    );
    return point ? point.value : null;
  }

  /**
   * 指定位置に検知があるかチェック
   */
  hasDetectionAtPosition(dataArray, position) {
    return dataArray.some(p =>
      Math.abs(p.distance - position) < 0.125 && p.value > 0
    );
  }

  /**
   * ファイル存在チェック
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = TrackDataIntegrationService;