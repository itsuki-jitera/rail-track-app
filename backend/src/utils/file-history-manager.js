/**
 * ファイル履歴管理モジュール
 * ファイルの処理履歴を管理
 *
 * 機能:
 * - ファイル処理履歴の記録
 * - 履歴の検索・フィルタリング
 * - 重複処理の検出
 * - JSONファイルでの永続化
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileHistoryManager {
  constructor(historyFilePath = './data/file-history.json') {
    this.historyFilePath = historyFilePath;
    this.history = [];
    this.loaded = false;
  }

  /**
   * 履歴ファイルを読み込み
   */
  async load() {
    try {
      const data = await fs.readFile(this.historyFilePath, 'utf8');
      this.history = JSON.parse(data);
      this.loaded = true;
    } catch (error) {
      // ファイルが存在しない場合は新規作成
      if (error.code === 'ENOENT') {
        this.history = [];
        this.loaded = true;
        await this.save();
      } else {
        console.error('Failed to load history:', error);
        this.history = [];
        this.loaded = true;
      }
    }
  }

  /**
   * 履歴ファイルを保存
   */
  async save() {
    try {
      const dir = path.dirname(this.historyFilePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.historyFilePath,
        JSON.stringify(this.history, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }

  /**
   * ファイルのハッシュ値を計算
   * @param {string} filePath - ファイルパス
   * @returns {Promise<string>} ハッシュ値
   */
  async calculateFileHash(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(buffer);
      return hash.digest('hex');
    } catch (error) {
      console.error('Failed to calculate file hash:', error);
      return null;
    }
  }

  /**
   * ファイル処理を記録
   * @param {Object} record - 処理記録
   * @returns {Promise<void>}
   */
  async addRecord(record) {
    if (!this.loaded) {
      await this.load();
    }

    const entry = {
      id: this.generateRecordId(),
      timestamp: new Date().toISOString(),
      filePath: record.filePath,
      fileName: record.fileName || path.basename(record.filePath),
      fileHash: record.fileHash || null,
      fileSize: record.fileSize || null,
      processingType: record.processingType || 'unknown',
      success: record.success !== false,
      error: record.error || null,
      metadata: record.metadata || {},
      results: record.results || {}
    };

    this.history.push(entry);

    // 履歴の上限（10000件）
    if (this.history.length > 10000) {
      this.history = this.history.slice(-10000);
    }

    await this.save();
  }

  /**
   * レコードIDを生成
   * @returns {string} レコードID
   */
  generateRecordId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * ファイル処理履歴を検索
   * @param {string} filePath - ファイルパス
   * @returns {Promise<Array>} 処理履歴
   */
  async findByFilePath(filePath) {
    if (!this.loaded) {
      await this.load();
    }

    return this.history.filter(entry => entry.filePath === filePath);
  }

  /**
   * ハッシュ値で検索
   * @param {string} hash - ファイルハッシュ
   * @returns {Promise<Array>} 処理履歴
   */
  async findByHash(hash) {
    if (!this.loaded) {
      await this.load();
    }

    return this.history.filter(entry => entry.fileHash === hash);
  }

  /**
   * 期間で検索
   * @param {Date} startDate - 開始日時
   * @param {Date} endDate - 終了日時
   * @returns {Promise<Array>} 処理履歴
   */
  async findByDateRange(startDate, endDate) {
    if (!this.loaded) {
      await this.load();
    }

    const start = startDate.getTime();
    const end = endDate.getTime();

    return this.history.filter(entry => {
      const timestamp = new Date(entry.timestamp).getTime();
      return timestamp >= start && timestamp <= end;
    });
  }

  /**
   * 処理タイプで検索
   * @param {string} processingType - 処理タイプ
   * @returns {Promise<Array>} 処理履歴
   */
  async findByProcessingType(processingType) {
    if (!this.loaded) {
      await this.load();
    }

    return this.history.filter(entry => entry.processingType === processingType);
  }

  /**
   * 成功/失敗で検索
   * @param {boolean} success - 成功フラグ
   * @returns {Promise<Array>} 処理履歴
   */
  async findBySuccess(success) {
    if (!this.loaded) {
      await this.load();
    }

    return this.history.filter(entry => entry.success === success);
  }

  /**
   * ファイルが既に処理済みかチェック
   * @param {string} filePath - ファイルパス
   * @param {string} hash - ファイルハッシュ（オプション）
   * @returns {Promise<boolean>} 処理済みの場合true
   */
  async isProcessed(filePath, hash = null) {
    if (!this.loaded) {
      await this.load();
    }

    if (hash) {
      const records = await this.findByHash(hash);
      return records.some(r => r.success);
    } else {
      const records = await this.findByFilePath(filePath);
      return records.some(r => r.success);
    }
  }

  /**
   * 最新の処理記録を取得
   * @param {string} filePath - ファイルパス
   * @returns {Promise<Object|null>} 処理記録
   */
  async getLatestRecord(filePath) {
    const records = await this.findByFilePath(filePath);

    if (records.length === 0) {
      return null;
    }

    return records.reduce((latest, current) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    });
  }

  /**
   * 全履歴を取得
   * @param {Object} options - オプション
   * @returns {Promise<Array>} 処理履歴
   */
  async getAll(options = {}) {
    if (!this.loaded) {
      await this.load();
    }

    let result = [...this.history];

    // ソート
    if (options.sortBy) {
      result.sort((a, b) => {
        if (options.sortOrder === 'asc') {
          return a[options.sortBy] > b[options.sortBy] ? 1 : -1;
        } else {
          return a[options.sortBy] < b[options.sortBy] ? 1 : -1;
        }
      });
    }

    // 制限
    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * 統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getStatistics() {
    if (!this.loaded) {
      await this.load();
    }

    const total = this.history.length;
    const successful = this.history.filter(e => e.success).length;
    const failed = this.history.filter(e => !e.success).length;

    // 処理タイプ別の集計
    const byProcessingType = {};
    for (const entry of this.history) {
      const type = entry.processingType || 'unknown';
      if (!byProcessingType[type]) {
        byProcessingType[type] = { total: 0, successful: 0, failed: 0 };
      }
      byProcessingType[type].total++;
      if (entry.success) {
        byProcessingType[type].successful++;
      } else {
        byProcessingType[type].failed++;
      }
    }

    // 日別の集計
    const byDate = {};
    for (const entry of this.history) {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = { total: 0, successful: 0, failed: 0 };
      }
      byDate[date].total++;
      if (entry.success) {
        byDate[date].successful++;
      } else {
        byDate[date].failed++;
      }
    }

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      byProcessingType,
      byDate
    };
  }

  /**
   * 古い履歴を削除
   * @param {number} daysToKeep - 保持日数
   * @returns {Promise<number>} 削除件数
   */
  async cleanupOldRecords(daysToKeep = 90) {
    if (!this.loaded) {
      await this.load();
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTime = cutoffDate.getTime();

    const beforeCount = this.history.length;

    this.history = this.history.filter(entry => {
      const entryTime = new Date(entry.timestamp).getTime();
      return entryTime >= cutoffTime;
    });

    const deletedCount = beforeCount - this.history.length;

    if (deletedCount > 0) {
      await this.save();
    }

    return deletedCount;
  }

  /**
   * 履歴をクリア
   * @returns {Promise<void>}
   */
  async clear() {
    this.history = [];
    await this.save();
  }

  /**
   * 履歴をエクスポート
   * @param {string} exportPath - エクスポート先パス
   * @param {string} format - フォーマット（json, csv）
   * @returns {Promise<void>}
   */
  async export(exportPath, format = 'json') {
    if (!this.loaded) {
      await this.load();
    }

    if (format === 'json') {
      await fs.writeFile(
        exportPath,
        JSON.stringify(this.history, null, 2),
        'utf8'
      );
    } else if (format === 'csv') {
      const lines = [];
      lines.push('ID,Timestamp,FilePath,FileName,ProcessingType,Success,Error');

      for (const entry of this.history) {
        lines.push([
          entry.id,
          entry.timestamp,
          entry.filePath,
          entry.fileName,
          entry.processingType,
          entry.success,
          entry.error || ''
        ].join(','));
      }

      await fs.writeFile(exportPath, lines.join('\n'), 'utf8');
    }
  }

  /**
   * 履歴をインポート
   * @param {string} importPath - インポート元パス
   * @returns {Promise<number>} インポート件数
   */
  async import(importPath) {
    try {
      const data = await fs.readFile(importPath, 'utf8');
      const imported = JSON.parse(data);

      if (!Array.isArray(imported)) {
        throw new Error('Invalid history format');
      }

      const beforeCount = this.history.length;
      this.history.push(...imported);

      // 重複削除（IDベース）
      const uniqueHistory = [];
      const seenIds = new Set();

      for (const entry of this.history) {
        if (!seenIds.has(entry.id)) {
          uniqueHistory.push(entry);
          seenIds.add(entry.id);
        }
      }

      this.history = uniqueHistory;

      await this.save();

      return this.history.length - beforeCount;
    } catch (error) {
      console.error('Failed to import history:', error);
      return 0;
    }
  }
}

module.exports = { FileHistoryManager };
