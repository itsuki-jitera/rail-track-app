/**
 * キヤデータ処理プロセッサー
 * Kiya 141 inspection car data processor
 *
 * MO処理手順に基づいた統合処理:
 * 1. ファイル選択と読み込み
 * 2. 線路名抽出（LKファイル）
 * 3. 位置情報作成（CKファイル）
 * 4. LABOCS形式変換（O010ファイル）
 * 5. 検知状況確認
 */

const fs = require('fs').promises;
const path = require('path');
const iconv = require('iconv-lite');

class KiyaDataProcessor {
  constructor() {
    this.datasets = new Map(); // データセット管理
    this.datasetIdCounter = 0;
  }

  /**
   * 新しいデータセットを作成
   * @param {Object} config - データセット設定
   * @returns {string} - データセットID
   */
  createDataset(config) {
    const datasetId = `kiya_${Date.now()}_${++this.datasetIdCounter}`;

    const dataset = {
      id: datasetId,
      status: 'initialized', // initialized, processing, completed, failed
      config,
      files: {
        ck: null,  // 曲線情報ファイル
        lk: null,  // 線区管理ファイル
        o010: null // 旧測定データファイル
      },
      data: {
        curves: [],
        sections: [],
        measurements: [],
        positionInfo: null,
        labocs: null
      },
      metadata: {
        lineName: null,
        measurementDate: null,
        startKm: null,
        endKm: null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.datasets.set(datasetId, dataset);
    return datasetId;
  }

  /**
   * データセット取得
   * @param {string} datasetId - データセットID
   * @returns {Object} - データセット
   */
  getDataset(datasetId) {
    return this.datasets.get(datasetId);
  }

  /**
   * すべてのデータセットを取得
   * @returns {Array} - データセット一覧
   */
  getAllDatasets() {
    return Array.from(this.datasets.values()).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  /**
   * ファイルを追加
   * @param {string} datasetId - データセットID
   * @param {string} fileType - ファイルタイプ (ck/lk/o010)
   * @param {string} filePath - ファイルパス
   */
  async addFile(datasetId, fileType, filePath) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    dataset.files[fileType] = filePath;
    dataset.updatedAt = new Date().toISOString();

    // ファイルタイプに応じて自動処理
    switch (fileType) {
      case 'lk':
        await this.processLKFile(datasetId, filePath);
        break;
      case 'ck':
        await this.processCKFile(datasetId, filePath);
        break;
      case 'o010':
        await this.processO010File(datasetId, filePath);
        break;
    }

    return dataset;
  }

  /**
   * LKファイル処理（線路名抽出）
   * @param {string} datasetId - データセットID
   * @param {string} filePath - ファイルパス
   */
  async processLKFile(datasetId, filePath) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) throw new Error('Dataset not found');

    try {
      const buffer = await fs.readFile(filePath);
      const content = iconv.decode(buffer, 'Shift_JIS');

      // LKパーサーを使用（後で動的インポート）
      const { parseLK } = await this.loadParser('lk-parser.js');
      const lkData = parseLK(content);

      dataset.data.sections = lkData.sections;
      dataset.data.managementValues = lkData.managementValues;
      dataset.data.managementSections = lkData.managementSections;

      // 線路名を抽出
      if (lkData.sections && lkData.sections.length > 0) {
        dataset.metadata.lineName = lkData.sections[0].routeName;
      }

      dataset.status = 'lk_processed';
      dataset.updatedAt = new Date().toISOString();

      console.log(`✓ LKファイル処理完了: ${lkData.sections.length}区間`);
    } catch (error) {
      console.error('LKファイル処理エラー:', error);
      dataset.status = 'error';
      dataset.error = error.message;
      throw error;
    }
  }

  /**
   * CKファイル処理（位置情報作成）
   * @param {string} datasetId - データセットID
   * @param {string} filePath - ファイルパス
   */
  async processCKFile(datasetId, filePath) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) throw new Error('Dataset not found');

    try {
      const buffer = await fs.readFile(filePath);
      const content = iconv.decode(buffer, 'Shift_JIS');

      // CKパーサーを使用
      const { parseCK } = await this.loadParser('ck-parser.js');
      const ckData = parseCK(content);

      dataset.data.curves = ckData.curves;
      dataset.data.structures = ckData.structures;
      dataset.data.stations = ckData.stations;

      // 位置情報を作成（曲線とマーカー情報を統合）
      dataset.data.positionInfo = this.createPositionInfo(ckData);

      dataset.status = 'ck_processed';
      dataset.updatedAt = new Date().toISOString();

      console.log(`✓ CKファイル処理完了: ${ckData.curves.length}曲線`);
    } catch (error) {
      console.error('CKファイル処理エラー:', error);
      dataset.status = 'error';
      dataset.error = error.message;
      throw error;
    }
  }

  /**
   * O010ファイル処理（測定データ読み込み）
   * @param {string} datasetId - データセットID
   * @param {string} filePath - ファイルパス
   */
  async processO010File(datasetId, filePath) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) throw new Error('Dataset not found');

    try {
      const buffer = await fs.readFile(filePath);

      // O010パーサーを使用
      const { parseO010CSV, convertToStandardFormat } = await this.loadParser('o010-parser.js');
      const o010Data = parseO010CSV(buffer);

      if (!o010Data.success) {
        throw new Error(o010Data.error || 'O010ファイルの解析に失敗しました');
      }

      dataset.data.measurements = o010Data.data.measurements;

      // メタデータを設定
      if (o010Data.data.header) {
        dataset.metadata.measurementDate = o010Data.data.header.measurementDate;
        dataset.metadata.startKm = o010Data.data.header.startKilometer;
        dataset.metadata.endKm = o010Data.data.header.endKilometer;
      }

      // 標準フォーマットに変換
      const standardData = convertToStandardFormat(o010Data);
      dataset.data.standardMeasurements = standardData;

      dataset.status = 'o010_processed';
      dataset.updatedAt = new Date().toISOString();

      console.log(`✓ O010ファイル処理完了: ${o010Data.data.measurements.length}レコード`);
    } catch (error) {
      console.error('O010ファイル処理エラー:', error);
      dataset.status = 'error';
      dataset.error = error.message;
      throw error;
    }
  }

  /**
   * 位置情報を作成
   * @param {Object} ckData - CKパーサーの結果
   * @returns {Object} - 位置情報
   */
  createPositionInfo(ckData) {
    const positionInfo = {
      curves: ckData.curves.map(curve => ({
        id: curve.id,
        type: 'curve',
        startKm: curve.start,
        endKm: curve.end,
        radius: curve.radius,
        cant: curve.cant,
        direction: curve.direction,
        length: curve.end - curve.start
      })),
      structures: ckData.structures.map(structure => ({
        id: structure.id,
        type: structure.type,
        startKm: structure.start,
        endKm: structure.end,
        length: structure.end - structure.start
      })),
      stations: ckData.stations.map(station => ({
        id: station.id,
        type: 'station',
        km: station.km,
        name: station.name
      })),
      // Data depot / ATS地上子位置（仕様書に基づく）
      alignmentPoints: this.extractAlignmentPoints(ckData)
    };

    return positionInfo;
  }

  /**
   * 位置合わせポイントを抽出
   * @param {Object} ckData - CKパーサーの結果
   * @returns {Array} - 位置合わせポイント
   */
  extractAlignmentPoints(ckData) {
    // Data depot、ATS地上子などの位置情報を抽出
    // 現時点ではstationsを使用（将来的にはCKファイルから取得）
    return ckData.stations.map(station => ({
      type: 'station',
      km: station.km,
      name: station.name || 'Unknown'
    }));
  }

  /**
   * LABOCS形式に変換
   * @param {string} datasetId - データセットID
   * @param {Object} options - 変換オプション
   * @returns {Object} - LABOCS形式データ
   */
  async convertToLABOCS(datasetId, options = {}) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) throw new Error('Dataset not found');

    if (!dataset.data.standardMeasurements || dataset.data.standardMeasurements.length === 0) {
      throw new Error('測定データが見つかりません');
    }

    try {
      // LABOCS形式に変換
      const labocs = {
        header: {
          version: '1.0',
          createdAt: new Date().toISOString(),
          lineName: dataset.metadata.lineName,
          measurementDate: dataset.metadata.measurementDate,
          startKm: dataset.metadata.startKm,
          endKm: dataset.metadata.endKm,
          dataInterval: options.dataInterval || 0.25 // デフォルト0.25m
        },
        data: {
          measurements: dataset.data.standardMeasurements,
          curves: dataset.data.curves || [],
          positionInfo: dataset.data.positionInfo || {}
        },
        statistics: this.calculateStatistics(dataset.data.standardMeasurements)
      };

      dataset.data.labocs = labocs;
      dataset.status = 'completed';
      dataset.updatedAt = new Date().toISOString();

      console.log(`✓ LABOCS変換完了: ${labocs.data.measurements.length}データポイント`);

      return labocs;
    } catch (error) {
      console.error('LABOCS変換エラー:', error);
      dataset.status = 'error';
      dataset.error = error.message;
      throw error;
    }
  }

  /**
   * 統計情報を計算
   * @param {Array} measurements - 測定データ
   * @returns {Object} - 統計情報
   */
  calculateStatistics(measurements) {
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const stats = {
      totalPoints: measurements.length,
      distance: {
        start: measurements[0].distance,
        end: measurements[measurements.length - 1].distance,
        total: measurements[measurements.length - 1].distance - measurements[0].distance
      }
    };

    // 各測定値の統計
    const measurementKeys = Object.keys(measurements[0].measurements || {});
    stats.measurements = {};

    measurementKeys.forEach(key => {
      const values = measurements
        .map(m => m.measurements[key])
        .filter(v => v !== null && !isNaN(v));

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;

        stats.measurements[key] = {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          mean: parseFloat(mean.toFixed(3)),
          stdDev: parseFloat(Math.sqrt(variance).toFixed(3))
        };
      }
    });

    return stats;
  }

  /**
   * パーサーを動的にロード（ESモジュール対応）
   * @param {string} parserName - パーサーファイル名
   * @returns {Object} - パーサーモジュール
   */
  async loadParser(parserName) {
    const parserPath = path.join(__dirname, '../parsers', parserName);
    try {
      // ESモジュールを動的インポート
      const module = await import(`file:///${parserPath.replace(/\\/g, '/')}`);
      return module;
    } catch (error) {
      console.error(`パーサーロードエラー (${parserName}):`, error);
      throw new Error(`Failed to load parser: ${parserName}`);
    }
  }

  /**
   * データセットを削除
   * @param {string} datasetId - データセットID
   */
  deleteDataset(datasetId) {
    return this.datasets.delete(datasetId);
  }

  /**
   * 統計情報を取得
   * @returns {Object} - 統計情報
   */
  getStatistics() {
    const datasets = Array.from(this.datasets.values());

    return {
      total: datasets.length,
      initialized: datasets.filter(d => d.status === 'initialized').length,
      processing: datasets.filter(d => d.status.includes('_processed')).length,
      completed: datasets.filter(d => d.status === 'completed').length,
      failed: datasets.filter(d => d.status === 'error').length
    };
  }
}

// シングルトンインスタンス
const kiyaDataProcessor = new KiyaDataProcessor();

module.exports = kiyaDataProcessor;
