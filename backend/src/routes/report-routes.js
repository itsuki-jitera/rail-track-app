/**
 * レポート生成API
 * Report generation routes
 */

const express = require('express');
const router = express.Router();

// レポート生成
const { ReportManager } = require('../reports/report-manager');

// レポートマネージャー初期化
const reportManager = new ReportManager('./reports');

/**
 * 復元波形レポート生成
 * POST /api/reports/generate-restoration
 */
router.post('/generate-restoration', async (req, res) => {
  try {
    const { result, metadata, formats } = req.body;

    if (!result) {
      return res.status(400).json({
        success: false,
        error: 'Restoration result is required'
      });
    }

    const reportFormats = formats || ['csv', 'html'];
    const paths = await reportManager.saveMultipleFormats(
      'restoration',
      reportFormats,
      result,
      metadata || {}
    );

    res.json({
      success: true,
      reports: paths
    });
  } catch (error) {
    console.error('Generate restoration report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 矢中弦レポート生成
 * POST /api/reports/generate-versine
 */
router.post('/generate-versine', async (req, res) => {
  try {
    const { versineData, metadata, formats } = req.body;

    if (!versineData) {
      return res.status(400).json({
        success: false,
        error: 'Versine data is required'
      });
    }

    const reportFormats = formats || ['csv', 'html'];
    const paths = await reportManager.saveMultipleFormats(
      'versine',
      reportFormats,
      versineData,
      metadata || {}
    );

    res.json({
      success: true,
      reports: paths
    });
  } catch (error) {
    console.error('Generate versine report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 統計情報レポート生成
 * POST /api/reports/generate-statistics
 */
router.post('/generate-statistics', async (req, res) => {
  try {
    const { statistics, metadata, formats } = req.body;

    if (!statistics) {
      return res.status(400).json({
        success: false,
        error: 'Statistics is required'
      });
    }

    const reportFormats = formats || ['csv'];
    const paths = await reportManager.saveMultipleFormats(
      'statistics',
      reportFormats,
      statistics,
      metadata || {}
    );

    res.json({
      success: true,
      reports: paths
    });
  } catch (error) {
    console.error('Generate statistics report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 総合レポート生成
 * POST /api/reports/generate-comprehensive
 */
router.post('/generate-comprehensive', async (req, res) => {
  try {
    const { result, environmentData, metadata, formats } = req.body;

    if (!result) {
      return res.status(400).json({
        success: false,
        error: 'Restoration result is required'
      });
    }

    const reportFormats = formats || ['html'];
    const paths = await reportManager.saveMultipleFormats(
      'comprehensive',
      reportFormats,
      { result, environmentData },
      metadata || {}
    );

    res.json({
      success: true,
      reports: paths
    });
  } catch (error) {
    console.error('Generate comprehensive report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 標準レポートセット生成
 * POST /api/reports/generate-standard-set
 */
router.post('/generate-standard-set', async (req, res) => {
  try {
    const { result, metadata, formats } = req.body;

    if (!result) {
      return res.status(400).json({
        success: false,
        error: 'Restoration result is required'
      });
    }

    const reportFormats = formats || ['csv', 'html'];
    const reports = await reportManager.generateStandardReportSet(
      result,
      metadata || {},
      reportFormats
    );

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('Generate standard report set error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * レポート一覧取得
 * GET /api/reports/list
 */
router.get('/list', async (req, res) => {
  try {
    const reports = await reportManager.listReports();

    res.json({
      success: true,
      reports,
      count: reports.length
    });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * レポート削除
 * DELETE /api/reports/:filename
 */
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    const deleted = await reportManager.deleteReport(filename);

    if (deleted) {
      res.json({
        success: true,
        message: 'Report deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Report not found or failed to delete'
      });
    }
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 古いレポートのクリーンアップ
 * POST /api/reports/cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { daysToKeep } = req.body;

    const deletedCount = await reportManager.cleanupOldReports(daysToKeep || 30);

    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} old reports`
    });
  } catch (error) {
    console.error('Cleanup reports error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * サポートされているフォーマット取得
 * GET /api/reports/supported-formats
 */
router.get('/supported-formats', (req, res) => {
  try {
    const formats = reportManager.getSupportedFormats();

    res.json({
      success: true,
      formats
    });
  } catch (error) {
    console.error('Get supported formats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * テンプレート一覧取得
 * GET /api/reports/templates
 */
router.get('/templates', (req, res) => {
  try {
    const templates = reportManager.getTemplates();

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
