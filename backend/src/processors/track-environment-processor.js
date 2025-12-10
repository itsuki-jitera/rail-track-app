/**
 * 軌道環境データプロセッサー
 * Track Environment Data Processor
 *
 * 軌道環境データセットの管理と統合処理
 */

const fs = require('fs').promises;
const path = require('path');

class TrackEnvironmentProcessor {
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
    const datasetId = `track_env_${Date.now()}_${++this.datasetIdCounter}`;

    const dataset = {
      id: datasetId,
      status: 'initialized', // initialized, processing, completed, failed
      config,
      files: {}, // データ項目コード → ファイルパス
      data: {
        stations: [],      // 駅名 (EM)
        gradients: [],     // こう配 (JS)
        curves: [],        // 曲線 (HS)
        structures: [],    // 構造物 (KR)
        joints: [],        // レール継目 (RT/RU)
        ballasts: [],      // 道床 (DS)
        turnouts: [],      // 分岐器 (BK)
        ejs: [],           // EJ
        ijs: []            // IJ
      },
      metadata: {
        lineName: null,
        lineType: null,
        section: null,
        updateYear: null,
        updateMonth: null
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
   * @param {string} dataType - データ項目コード (EM, JS, HS等)
   * @param {string} filePath - ファイルパス
   * @param {Object} parsedData - 解析済みデータ
   */
  async addFile(datasetId, dataType, filePath, parsedData) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    dataset.files[dataType] = filePath;

    // ファイル情報からメタデータを更新
    if (parsedData.fileInfo) {
      dataset.metadata.lineName = parsedData.fileInfo.lineName;
      dataset.metadata.lineType = parsedData.fileInfo.lineType;
      dataset.metadata.section = parsedData.fileInfo.section;
      dataset.metadata.updateYear = parsedData.fileInfo.updateYear;
      dataset.metadata.updateMonth = parsedData.fileInfo.updateMonth;
    }

    // データ項目に応じて格納
    this.storeData(dataset, dataType, parsedData.records || []);

    dataset.updatedAt = new Date().toISOString();

    // 必須データが揃っているか確認
    this.checkDatasetStatus(dataset);

    return dataset;
  }

  /**
   * データを格納
   * @param {Object} dataset - データセット
   * @param {string} dataType - データ項目コード
   * @param {Array} records - レコード配列
   */
  storeData(dataset, dataType, records) {
    switch (dataType) {
      case 'EM':
        dataset.data.stations = records;
        break;
      case 'JS':
        dataset.data.gradients = records;
        break;
      case 'HS':
        dataset.data.curves = records;
        break;
      case 'KR':
        dataset.data.structures = records;
        break;
      case 'RT':
      case 'RU':
        dataset.data.joints = [...dataset.data.joints, ...records];
        break;
      case 'DS':
        dataset.data.ballasts = records;
        break;
      case 'BK':
        dataset.data.turnouts = records;
        break;
      case 'EJ':
        dataset.data.ejs = records;
        break;
      case 'IJ':
        dataset.data.ijs = records;
        break;
      default:
        // その他のデータ型は汎用格納
        if (!dataset.data.other) {
          dataset.data.other = {};
        }
        dataset.data.other[dataType] = records;
        break;
    }
  }

  /**
   * データセットのステータスを確認
   * @param {Object} dataset - データセット
   */
  checkDatasetStatus(dataset) {
    const requiredTypes = ['JS', 'HS', 'KR', 'RT', 'DS', 'BK', 'EJ', 'IJ'];
    const loadedTypes = Object.keys(dataset.files);

    const missingTypes = requiredTypes.filter(type => !loadedTypes.includes(type));

    if (missingTypes.length === 0) {
      dataset.status = 'completed';
    } else if (loadedTypes.length > 0) {
      dataset.status = 'processing';
    }

    dataset.missingTypes = missingTypes;
  }

  /**
   * データをキロ程範囲で検索
   * @param {string} datasetId - データセットID
   * @param {number} startKm - 開始キロ程
   * @param {number} endKm - 終了キロ程
   * @returns {Object} - 検索結果
   */
  findDataByRange(datasetId, startKm, endKm) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    const filterByRange = (items, fromField = 'from', toField = 'to') => {
      return items.filter(item => {
        const itemStart = item[fromField] || item.kilometer;
        const itemEnd = item[toField] || item.kilometer;

        return (itemStart >= startKm && itemStart <= endKm) ||
               (itemEnd >= startKm && itemEnd <= endKm) ||
               (itemStart <= startKm && itemEnd >= endKm);
      });
    };

    return {
      stations: filterByRange(dataset.data.stations, 'kilometer', 'kilometer'),
      gradients: filterByRange(dataset.data.gradients),
      curves: filterByRange(dataset.data.curves),
      structures: filterByRange(dataset.data.structures),
      joints: filterByRange(dataset.data.joints),
      ballasts: filterByRange(dataset.data.ballasts),
      turnouts: filterByRange(dataset.data.turnouts),
      ejs: filterByRange(dataset.data.ejs),
      ijs: filterByRange(dataset.data.ijs)
    };
  }

  /**
   * 統計情報を計算
   * @param {string} datasetId - データセットID
   * @returns {Object} - 統計情報
   */
  calculateStatistics(datasetId) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    const stats = {
      datasetId,
      totalFiles: Object.keys(dataset.files).length,
      dataCounts: {
        stations: dataset.data.stations.length,
        gradients: dataset.data.gradients.length,
        curves: dataset.data.curves.length,
        structures: dataset.data.structures.length,
        joints: dataset.data.joints.length,
        ballasts: dataset.data.ballasts.length,
        turnouts: dataset.data.turnouts.length,
        ejs: dataset.data.ejs.length,
        ijs: dataset.data.ijs.length
      },
      status: dataset.status,
      missingTypes: dataset.missingTypes || [],
      coverage: {}
    };

    // カバレッジ計算
    const requiredTypes = ['JS', 'HS', 'KR', 'RT', 'DS', 'BK', 'EJ', 'IJ'];
    const loadedRequiredTypes = requiredTypes.filter(type => dataset.files[type]);
    stats.coverage.percentage = Math.round((loadedRequiredTypes.length / requiredTypes.length) * 100);
    stats.coverage.loaded = loadedRequiredTypes.length;
    stats.coverage.total = requiredTypes.length;

    // キロ程範囲
    if (dataset.data.gradients.length > 0) {
      const kms = dataset.data.gradients.map(g => [g.from, g.to]).flat();
      stats.kilometrage = {
        min: Math.min(...kms),
        max: Math.max(...kms),
        length: Math.max(...kms) - Math.min(...kms)
      };
    }

    return stats;
  }

  /**
   * データセットを削除
   * @param {string} datasetId - データセットID
   */
  deleteDataset(datasetId) {
    return this.datasets.delete(datasetId);
  }

  /**
   * 全体の統計情報を取得
   * @returns {Object} - 統計情報
   */
  getStatistics() {
    const datasets = Array.from(this.datasets.values());

    return {
      total: datasets.length,
      initialized: datasets.filter(d => d.status === 'initialized').length,
      processing: datasets.filter(d => d.status === 'processing').length,
      completed: datasets.filter(d => d.status === 'completed').length,
      failed: datasets.filter(d => d.status === 'failed').length
    };
  }

  /**
   * データをエクスポート
   * @param {string} datasetId - データセットID
   * @param {string} format - エクスポート形式 (json, csv)
   * @returns {Object|string} - エクスポートデータ
   */
  exportData(datasetId, format = 'json') {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    if (format === 'json') {
      return {
        metadata: dataset.metadata,
        data: dataset.data,
        exportedAt: new Date().toISOString()
      };
    } else if (format === 'csv') {
      // CSV形式のエクスポート（簡易版）
      return this.convertToCSV(dataset);
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  /**
   * CSV形式に変換
   * @param {Object} dataset - データセット
   * @returns {string} - CSV文字列
   */
  convertToCSV(dataset) {
    const lines = [];

    // ヘッダー
    lines.push('# 軌道環境データエクスポート');
    lines.push(`# 線名: ${dataset.metadata.lineName || 'N/A'}`);
    lines.push(`# 線別: ${dataset.metadata.lineType || 'N/A'}`);
    lines.push(`# エクスポート日時: ${new Date().toISOString()}`);
    lines.push('');

    // 各データ型のCSV
    const sections = [
      { name: '駅名', data: dataset.data.stations },
      { name: 'こう配', data: dataset.data.gradients },
      { name: '曲線', data: dataset.data.curves },
      { name: '構造物', data: dataset.data.structures },
      { name: 'レール継目', data: dataset.data.joints },
      { name: '道床', data: dataset.data.ballasts },
      { name: '分岐器', data: dataset.data.turnouts },
      { name: 'EJ', data: dataset.data.ejs },
      { name: 'IJ', data: dataset.data.ijs }
    ];

    sections.forEach(section => {
      if (section.data && section.data.length > 0) {
        lines.push(`## ${section.name}`);

        // ヘッダー行
        const headers = Object.keys(section.data[0]);
        lines.push(headers.join(','));

        // データ行
        section.data.forEach(record => {
          const values = headers.map(h => {
            const value = record[h];
            return typeof value === 'string' ? `"${value}"` : value;
          });
          lines.push(values.join(','));
        });

        lines.push('');
      }
    });

    return lines.join('\n');
  }
}

// シングルトンインスタンス
const trackEnvironmentProcessor = new TrackEnvironmentProcessor();

module.exports = trackEnvironmentProcessor;
