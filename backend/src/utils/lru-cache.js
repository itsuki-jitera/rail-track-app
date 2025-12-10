/**
 * LRU (Least Recently Used) キャッシュ実装
 * LRU Cache Implementation
 *
 * 計算結果をメモリ内にキャッシュして、同じパラメータでの再計算を避ける
 */

class LRUCache {
  /**
   * @param {number} maxSize - 最大キャッシュサイズ（エントリ数）
   * @param {number} maxMemoryMB - 最大メモリ使用量（MB）
   */
  constructor(maxSize = 100, maxMemoryMB = 100) {
    this.maxSize = maxSize;
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this.cache = new Map(); // key -> { value, size, timestamp, hits }
    this.currentMemoryBytes = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * キーの生成（パラメータからハッシュ値を生成）
   *
   * @param {Object} params - パラメータオブジェクト
   * @returns {string} キャッシュキー
   */
  static generateKey(params) {
    // パラメータを正規化してJSON文字列化
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    return normalized;
  }

  /**
   * データサイズの推定（バイト）
   *
   * @param {any} data - データ
   * @returns {number} 推定サイズ（バイト）
   */
  static estimateSize(data) {
    const json = JSON.stringify(data);
    // JSON文字列のバイト数を推定（UTF-8）
    return new Blob([json]).size;
  }

  /**
   * キャッシュから値を取得
   *
   * @param {string} key - キャッシュキー
   * @returns {any|null} キャッシュされた値、または null
   */
  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return null;
    }

    const entry = this.cache.get(key);

    // LRU: アクセスされたエントリを最後に移動
    this.cache.delete(key);
    entry.timestamp = Date.now();
    entry.hits++;
    this.cache.set(key, entry);

    this.hits++;
    return entry.value;
  }

  /**
   * キャッシュに値を設定
   *
   * @param {string} key - キャッシュキー
   * @param {any} value - 値
   * @returns {boolean} 成功したかどうか
   */
  set(key, value) {
    const size = LRUCache.estimateSize(value);

    // メモリ制限チェック
    if (size > this.maxMemoryBytes) {
      console.warn(`Value too large to cache: ${size} bytes (max: ${this.maxMemoryBytes})`);
      return false;
    }

    // 既存のエントリを削除
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key);
      this.currentMemoryBytes -= oldEntry.size;
      this.cache.delete(key);
    }

    // 容量確保のため古いエントリを削除
    while (
      (this.cache.size >= this.maxSize ||
       this.currentMemoryBytes + size > this.maxMemoryBytes) &&
      this.cache.size > 0
    ) {
      this.evictOldest();
    }

    // 新しいエントリを追加
    const entry = {
      value,
      size,
      timestamp: Date.now(),
      hits: 0
    };

    this.cache.set(key, entry);
    this.currentMemoryBytes += size;

    return true;
  }

  /**
   * 最も古いエントリを削除（LRU）
   */
  evictOldest() {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      const entry = this.cache.get(firstKey);
      this.cache.delete(firstKey);
      this.currentMemoryBytes -= entry.size;
    }
  }

  /**
   * キャッシュをクリア
   */
  clear() {
    this.cache.clear();
    this.currentMemoryBytes = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 特定のキーを削除
   *
   * @param {string} key - キャッシュキー
   * @returns {boolean} 削除されたかどうか
   */
  delete(key) {
    if (!this.cache.has(key)) {
      return false;
    }

    const entry = this.cache.get(key);
    this.cache.delete(key);
    this.currentMemoryBytes -= entry.size;
    return true;
  }

  /**
   * キャッシュ統計を取得
   *
   * @returns {Object} 統計情報
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsed: `${(this.currentMemoryBytes / 1024 / 1024).toFixed(2)} MB`,
      maxMemory: `${(this.maxMemoryBytes / 1024 / 1024).toFixed(2)} MB`,
      memoryUsagePercent: ((this.currentMemoryBytes / this.maxMemoryBytes) * 100).toFixed(1),
      hits: this.hits,
      misses: this.misses,
      totalRequests,
      hitRate: `${hitRate.toFixed(1)}%`,
      entries: this.getEntryStats()
    };
  }

  /**
   * エントリごとの統計
   *
   * @returns {Array} エントリ統計
   */
  getEntryStats() {
    const stats = [];
    for (const [key, entry] of this.cache.entries()) {
      stats.push({
        key: key.substring(0, 50) + (key.length > 50 ? '...' : ''),
        size: `${(entry.size / 1024).toFixed(2)} KB`,
        hits: entry.hits,
        age: `${Math.round((Date.now() - entry.timestamp) / 1000)}s`
      });
    }
    return stats;
  }

  /**
   * 有効期限切れのエントリを削除
   *
   * @param {number} maxAgeMs - 最大有効期限（ミリ秒）
   * @returns {number} 削除されたエントリ数
   */
  evictExpired(maxAgeMs) {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAgeMs) {
        this.delete(key);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * キャッシュヒット率の最適化
   * 使用頻度の低いエントリを削除
   *
   * @param {number} minHits - 最小ヒット数
   * @returns {number} 削除されたエントリ数
   */
  optimizeByHits(minHits = 2) {
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        this.delete(key);
        evicted++;
      }
    }

    return evicted;
  }
}

/**
 * グローバルキャッシュマネージャー
 */
class CacheManager {
  constructor() {
    // 異なる種類のキャッシュ
    this.caches = {
      eccentricVersine: new LRUCache(50, 50),      // 偏心矢計算結果
      characteristics: new LRUCache(100, 20),      // 検測特性
      conversion: new LRUCache(50, 50),            // 偏心矢変換
      abCoefficients: new LRUCache(200, 10)        // A,B係数（軽量）
    };
  }

  /**
   * 特定のキャッシュを取得
   *
   * @param {string} cacheName - キャッシュ名
   * @returns {LRUCache} キャッシュインスタンス
   */
  getCache(cacheName) {
    return this.caches[cacheName];
  }

  /**
   * 全キャッシュをクリア
   */
  clearAll() {
    for (const cache of Object.values(this.caches)) {
      cache.clear();
    }
  }

  /**
   * 全キャッシュの統計を取得
   *
   * @returns {Object} 全キャッシュの統計
   */
  getAllStats() {
    const stats = {};
    for (const [name, cache] of Object.entries(this.caches)) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  /**
   * 有効期限切れエントリの一括削除
   *
   * @param {number} maxAgeMs - 最大有効期限（ミリ秒）
   * @returns {Object} 削除統計
   */
  evictExpiredAll(maxAgeMs = 3600000) { // デフォルト1時間
    const stats = {};
    for (const [name, cache] of Object.entries(this.caches)) {
      stats[name] = cache.evictExpired(maxAgeMs);
    }
    return stats;
  }

  /**
   * メモリ使用量の最適化
   *
   * @returns {Object} 最適化統計
   */
  optimize() {
    const stats = {};
    for (const [name, cache] of Object.entries(this.caches)) {
      stats[name] = {
        expiredEvicted: cache.evictExpired(3600000), // 1時間以上古いエントリ
        lowHitsEvicted: cache.optimizeByHits(2)      // ヒット数2未満
      };
    }
    return stats;
  }
}

// グローバルインスタンスをエクスポート
const globalCacheManager = new CacheManager();

module.exports = {
  LRUCache,
  CacheManager,
  globalCacheManager
};
