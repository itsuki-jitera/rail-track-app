/**
 * データキャッシュ管理モジュール
 * 計算結果をキャッシュして高速化
 *
 * 機能:
 * - 計算結果のキャッシュ
 * - キャッシュの有効期限管理
 * - メモリベースとファイルベースの両対応
 * - LRU（Least Recently Used）方式
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DataCacheManager {
  constructor(options = {}) {
    this.options = {
      cacheDirectory: options.cacheDirectory || './cache',
      maxMemoryItems: options.maxMemoryItems || 100,
      maxDiskItems: options.maxDiskItems || 1000,
      defaultTTL: options.defaultTTL || 3600000, // 1時間（ミリ秒）
      useMemoryCache: options.useMemoryCache !== false,
      useDiskCache: options.useDiskCache !== false,
      ...options
    };

    // メモリキャッシュ
    this.memoryCache = new Map();

    // アクセス履歴（LRU用）
    this.accessOrder = [];

    // 統計情報
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      diskHits: 0
    };
  }

  /**
   * キャッシュキーを生成
   * @param {string} type - データタイプ
   * @param {Object} params - パラメータ
   * @returns {string} キャッシュキー
   */
  generateCacheKey(type, params) {
    const hash = crypto.createHash('sha256');
    hash.update(type);
    hash.update(JSON.stringify(params));
    return hash.digest('hex');
  }

  /**
   * キャッシュを取得
   * @param {string} type - データタイプ
   * @param {Object} params - パラメータ
   * @returns {Promise<Object|null>} キャッシュデータ
   */
  async get(type, params) {
    const key = this.generateCacheKey(type, params);

    // メモリキャッシュをチェック
    if (this.options.useMemoryCache && this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);

      // 有効期限チェック
      if (this.isValid(cached)) {
        this.updateAccessOrder(key);
        this.stats.hits++;
        this.stats.memoryHits++;
        return cached.data;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // ディスクキャッシュをチェック
    if (this.options.useDiskCache) {
      const cached = await this.getDiskCache(key);

      if (cached && this.isValid(cached)) {
        // メモリキャッシュに昇格
        if (this.options.useMemoryCache) {
          this.setMemoryCache(key, cached);
        }

        this.stats.hits++;
        this.stats.diskHits++;
        return cached.data;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * キャッシュを設定
   * @param {string} type - データタイプ
   * @param {Object} params - パラメータ
   * @param {Object} data - データ
   * @param {number} ttl - 有効期限（ミリ秒）
   * @returns {Promise<void>}
   */
  async set(type, params, data, ttl = null) {
    const key = this.generateCacheKey(type, params);
    const expiresAt = Date.now() + (ttl || this.options.defaultTTL);

    const cached = {
      key,
      type,
      params,
      data,
      createdAt: Date.now(),
      expiresAt,
      accessCount: 0
    };

    // メモリキャッシュに保存
    if (this.options.useMemoryCache) {
      this.setMemoryCache(key, cached);
    }

    // ディスクキャッシュに保存
    if (this.options.useDiskCache) {
      await this.setDiskCache(key, cached);
    }
  }

  /**
   * メモリキャッシュに設定
   * @param {string} key - キャッシュキー
   * @param {Object} cached - キャッシュデータ
   */
  setMemoryCache(key, cached) {
    // LRU方式で古いものを削除
    if (this.memoryCache.size >= this.options.maxMemoryItems) {
      const oldestKey = this.accessOrder[0];
      this.memoryCache.delete(oldestKey);
      this.accessOrder.shift();
    }

    this.memoryCache.set(key, cached);
    this.updateAccessOrder(key);
  }

  /**
   * ディスクキャッシュに保存
   * @param {string} key - キャッシュキー
   * @param {Object} cached - キャッシュデータ
   * @returns {Promise<void>}
   */
  async setDiskCache(key, cached) {
    try {
      await fs.mkdir(this.options.cacheDirectory, { recursive: true });

      const filePath = path.join(this.options.cacheDirectory, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(cached), 'utf8');
    } catch (error) {
      console.error('Failed to save disk cache:', error);
    }
  }

  /**
   * ディスクキャッシュを取得
   * @param {string} key - キャッシュキー
   * @returns {Promise<Object|null>} キャッシュデータ
   */
  async getDiskCache(key) {
    try {
      const filePath = path.join(this.options.cacheDirectory, `${key}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * キャッシュの有効性をチェック
   * @param {Object} cached - キャッシュデータ
   * @returns {boolean} 有効な場合true
   */
  isValid(cached) {
    return Date.now() < cached.expiresAt;
  }

  /**
   * アクセス順序を更新（LRU用）
   * @param {string} key - キャッシュキー
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);

    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    this.accessOrder.push(key);

    // キャッシュデータのアクセス回数を更新
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);
      cached.accessCount++;
    }
  }

  /**
   * キャッシュを削除
   * @param {string} type - データタイプ
   * @param {Object} params - パラメータ
   * @returns {Promise<void>}
   */
  async delete(type, params) {
    const key = this.generateCacheKey(type, params);

    // メモリキャッシュから削除
    this.memoryCache.delete(key);

    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    // ディスクキャッシュから削除
    try {
      const filePath = path.join(this.options.cacheDirectory, `${key}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  }

  /**
   * タイプ別にキャッシュを削除
   * @param {string} type - データタイプ
   * @returns {Promise<number>} 削除件数
   */
  async deleteByType(type) {
    let deletedCount = 0;

    // メモリキャッシュから削除
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.type === type) {
        this.memoryCache.delete(key);
        deletedCount++;
      }
    }

    // アクセス順序も更新
    this.accessOrder = this.accessOrder.filter(key => this.memoryCache.has(key));

    // ディスクキャッシュから削除
    try {
      const files = await fs.readdir(this.options.cacheDirectory);

      for (const file of files) {
        const filePath = path.join(this.options.cacheDirectory, file);
        const data = await fs.readFile(filePath, 'utf8');
        const cached = JSON.parse(data);

        if (cached.type === type) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
    } catch (error) {
      console.error('Failed to delete disk cache by type:', error);
    }

    return deletedCount;
  }

  /**
   * 期限切れキャッシュを削除
   * @returns {Promise<number>} 削除件数
   */
  async cleanupExpired() {
    let deletedCount = 0;

    // メモリキャッシュから削除
    for (const [key, cached] of this.memoryCache.entries()) {
      if (!this.isValid(cached)) {
        this.memoryCache.delete(key);
        deletedCount++;
      }
    }

    // アクセス順序も更新
    this.accessOrder = this.accessOrder.filter(key => this.memoryCache.has(key));

    // ディスクキャッシュから削除
    try {
      const files = await fs.readdir(this.options.cacheDirectory);

      for (const file of files) {
        const filePath = path.join(this.options.cacheDirectory, file);
        const data = await fs.readFile(filePath, 'utf8');
        const cached = JSON.parse(data);

        if (!this.isValid(cached)) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired disk cache:', error);
    }

    return deletedCount;
  }

  /**
   * 全キャッシュをクリア
   * @returns {Promise<void>}
   */
  async clear() {
    // メモリキャッシュをクリア
    this.memoryCache.clear();
    this.accessOrder = [];

    // ディスクキャッシュをクリア
    try {
      const files = await fs.readdir(this.options.cacheDirectory);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.options.cacheDirectory, file);
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to clear disk cache:', error);
    }

    // 統計情報をリセット
    this.resetStats();
  }

  /**
   * キャッシュ統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      memoryHits: this.stats.memoryHits,
      diskHits: this.stats.diskHits,
      total,
      hitRate: hitRate.toFixed(2),
      memorySize: this.memoryCache.size,
      maxMemorySize: this.options.maxMemoryItems
    };
  }

  /**
   * 統計情報をリセット
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      diskHits: 0
    };
  }

  /**
   * キャッシュ情報を取得
   * @returns {Promise<Array>} キャッシュ情報配列
   */
  async getCacheInfo() {
    const info = [];

    // メモリキャッシュ
    for (const [key, cached] of this.memoryCache.entries()) {
      info.push({
        key,
        type: cached.type,
        createdAt: new Date(cached.createdAt).toISOString(),
        expiresAt: new Date(cached.expiresAt).toISOString(),
        accessCount: cached.accessCount,
        isExpired: !this.isValid(cached),
        location: 'memory'
      });
    }

    // ディスクキャッシュ
    try {
      const files = await fs.readdir(this.options.cacheDirectory);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.options.cacheDirectory, file);
        const data = await fs.readFile(filePath, 'utf8');
        const cached = JSON.parse(data);

        // メモリキャッシュに存在しない場合のみ追加
        if (!this.memoryCache.has(cached.key)) {
          info.push({
            key: cached.key,
            type: cached.type,
            createdAt: new Date(cached.createdAt).toISOString(),
            expiresAt: new Date(cached.expiresAt).toISOString(),
            accessCount: cached.accessCount,
            isExpired: !this.isValid(cached),
            location: 'disk'
          });
        }
      }
    } catch (error) {
      console.error('Failed to get disk cache info:', error);
    }

    return info;
  }

  /**
   * オプションを設定
   * @param {Object} options - オプション
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }

  /**
   * オプションを取得
   * @returns {Object} オプション
   */
  getOptions() {
    return { ...this.options };
  }
}

module.exports = { DataCacheManager };
