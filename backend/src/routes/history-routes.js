/**
 * ファイル履歴管理API
 * File history management routes
 */

const express = require('express');
const router = express.Router();

// 履歴管理
const { FileHistoryManager } = require('../utils/file-history-manager');

// 履歴マネージャー初期化
const historyManager = new FileHistoryManager('./data/file-history.json');

/**
 * 履歴追加
 * POST /api/history/add
 */
router.post('/add', async (req, res) => {
  try {
    const { record } = req.body;

    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'Record is required'
      });
    }

    await historyManager.addRecord(record);

    res.json({
      success: true,
      message: 'Record added successfully'
    });
  } catch (error) {
    console.error('Add history record error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ファイルパスで検索
 * GET /api/history/find-by-path
 */
router.get('/find-by-path', async (req, res) => {
  try {
    const { filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    const records = await historyManager.findByFilePath(filePath);

    res.json({
      success: true,
      records,
      count: records.length
    });
  } catch (error) {
    console.error('Find by path error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ハッシュ値で検索
 * GET /api/history/find-by-hash
 */
router.get('/find-by-hash', async (req, res) => {
  try {
    const { hash } = req.query;

    if (!hash) {
      return res.status(400).json({
        success: false,
        error: 'Hash is required'
      });
    }

    const records = await historyManager.findByHash(hash);

    res.json({
      success: true,
      records,
      count: records.length
    });
  } catch (error) {
    console.error('Find by hash error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 期間で検索
 * GET /api/history/find-by-date-range
 */
router.get('/find-by-date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const records = await historyManager.findByDateRange(
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      records,
      count: records.length
    });
  } catch (error) {
    console.error('Find by date range error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 全履歴取得
 * GET /api/history/all
 */
router.get('/all', async (req, res) => {
  try {
    const options = {
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const records = await historyManager.getAll(options);

    res.json({
      success: true,
      records,
      count: records.length
    });
  } catch (error) {
    console.error('Get all history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 統計情報取得
 * GET /api/history/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const statistics = await historyManager.getStatistics();

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Get history statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 処理済みチェック
 * GET /api/history/is-processed
 */
router.get('/is-processed', async (req, res) => {
  try {
    const { filePath, hash } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    const isProcessed = await historyManager.isProcessed(filePath, hash);

    res.json({
      success: true,
      isProcessed
    });
  } catch (error) {
    console.error('Check processed error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 最新記録取得
 * GET /api/history/latest
 */
router.get('/latest', async (req, res) => {
  try {
    const { filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    const record = await historyManager.getLatestRecord(filePath);

    res.json({
      success: true,
      record
    });
  } catch (error) {
    console.error('Get latest record error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 古い履歴クリーンアップ
 * POST /api/history/cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { daysToKeep } = req.body;

    const deletedCount = await historyManager.cleanupOldRecords(daysToKeep || 90);

    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} old records`
    });
  } catch (error) {
    console.error('Cleanup history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 履歴クリア
 * POST /api/history/clear
 */
router.post('/clear', async (req, res) => {
  try {
    await historyManager.clear();

    res.json({
      success: true,
      message: 'History cleared successfully'
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 履歴エクスポート
 * GET /api/history/export
 */
router.get('/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const exportPath = path.join(__dirname, '../../temp', `history-export-${Date.now()}.${format}`);

    await historyManager.export(exportPath, format);

    res.download(exportPath, `history-export.${format}`, async (error) => {
      if (error) {
        console.error('Export download error:', error);
      }

      // ファイル削除
      try {
        await fs.unlink(exportPath);
      } catch (e) {
        // ignore
      }
    });
  } catch (error) {
    console.error('Export history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
