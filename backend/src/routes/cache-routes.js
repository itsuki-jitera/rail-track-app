/**
 * データキャッシュ管理API
 * Data cache management routes
 */

const express = require('express');
const router = express.Router();

// キャッシュ管理
const { DataCacheManager } = require('../utils/data-cache-manager');

// キャッシュマネージャー初期化
const cacheManager = new DataCacheManager({
  cacheDirectory: './cache',
  maxMemoryItems: 100,
  maxDiskItems: 1000,
  defaultTTL: 3600000 // 1時間
});

/**
 * キャッシュ取得
 * GET /api/cache/get
 */
router.get('/get', async (req, res) => {
  try {
    const { type, params } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Type is required'
      });
    }

    const parsedParams = params ? JSON.parse(params) : {};
    const data = await cacheManager.get(type, parsedParams);

    if (data) {
      res.json({
        success: true,
        data,
        cached: true
      });
    } else {
      res.json({
        success: true,
        data: null,
        cached: false
      });
    }
  } catch (error) {
    console.error('Cache get error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * キャッシュ設定
 * POST /api/cache/set
 */
router.post('/set', async (req, res) => {
  try {
    const { type, params, data, ttl } = req.body;

    if (!type || !params || !data) {
      return res.status(400).json({
        success: false,
        error: 'Type, params, and data are required'
      });
    }

    await cacheManager.set(type, params, data, ttl);

    res.json({
      success: true,
      message: 'Cache set successfully'
    });
  } catch (error) {
    console.error('Cache set error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * キャッシュ削除
 * DELETE /api/cache/delete
 */
router.delete('/delete', async (req, res) => {
  try {
    const { type, params } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Type is required'
      });
    }

    const parsedParams = params ? JSON.parse(params) : {};
    await cacheManager.delete(type, parsedParams);

    res.json({
      success: true,
      message: 'Cache deleted successfully'
    });
  } catch (error) {
    console.error('Cache delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * タイプ別キャッシュ削除
 * DELETE /api/cache/delete-by-type
 */
router.delete('/delete-by-type', async (req, res) => {
  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Type is required'
      });
    }

    const deletedCount = await cacheManager.deleteByType(type);

    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} cache entries`
    });
  } catch (error) {
    console.error('Delete cache by type error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 期限切れキャッシュクリーンアップ
 * POST /api/cache/cleanup-expired
 */
router.post('/cleanup-expired', async (req, res) => {
  try {
    const deletedCount = await cacheManager.cleanupExpired();

    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} expired cache entries`
    });
  } catch (error) {
    console.error('Cleanup expired cache error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 全キャッシュクリア
 * POST /api/cache/clear
 */
router.post('/clear', async (req, res) => {
  try {
    await cacheManager.clear();

    res.json({
      success: true,
      message: 'All cache cleared successfully'
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * キャッシュ統計情報取得
 * GET /api/cache/stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = cacheManager.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get cache stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 統計情報リセット
 * POST /api/cache/reset-stats
 */
router.post('/reset-stats', (req, res) => {
  try {
    cacheManager.resetStats();

    res.json({
      success: true,
      message: 'Cache stats reset successfully'
    });
  } catch (error) {
    console.error('Reset cache stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * キャッシュ情報取得
 * GET /api/cache/info
 */
router.get('/info', async (req, res) => {
  try {
    const info = await cacheManager.getCacheInfo();

    res.json({
      success: true,
      info,
      count: info.length
    });
  } catch (error) {
    console.error('Get cache info error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * キャッシュオプション取得
 * GET /api/cache/options
 */
router.get('/options', (req, res) => {
  try {
    const options = cacheManager.getOptions();

    res.json({
      success: true,
      options
    });
  } catch (error) {
    console.error('Get cache options error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * キャッシュオプション設定
 * POST /api/cache/options
 */
router.post('/options', (req, res) => {
  try {
    const { options } = req.body;

    cacheManager.setOptions(options);

    res.json({
      success: true,
      options: cacheManager.getOptions()
    });
  } catch (error) {
    console.error('Set cache options error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
