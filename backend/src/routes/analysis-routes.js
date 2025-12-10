/**
 * 分析関連APIルート定義
 * 各種分析機能へのエンドポイント提供
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 分析器のインポート
const WavebandAnalyzer = require('../analyzers/waveband-analyzer');
const QualityAnalyzer = require('../analyzers/quality-analyzer');
const FieldMeasurementAnalyzer = require('../analyzers/field-measurement');
const VerticalCurveManager = require('../analyzers/vertical-curve-manager');

// エクスポーターのインポート
const ALSExporter = require('../exporters/als-exporter');
const ALCExporter = require('../exporters/alc-exporter');
const MJDataExporter = require('../exporters/mj-exporter');
const GeneralDataExporter = require('../exporters/general-exporter');

// レポート生成器
const ComprehensiveReportGenerator = require('../reports/comprehensive-report');

// ファイルアップロード設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

/**
 * 波長帯域分析
 * POST /api/analysis/waveband
 */
router.post('/waveband', async (req, res) => {
  try {
    const { data, options } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: '有効なデータ配列が必要です'
      });
    }

    const analyzer = new WavebandAnalyzer(options);
    const results = analyzer.analyzeWavebands(data);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('波長帯域分析エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 品質分析（σ値・良化率）
 * POST /api/analysis/quality
 */
router.post('/quality', async (req, res) => {
  try {
    const { beforeData, afterData, options } = req.body;

    if (!beforeData || !afterData) {
      return res.status(400).json({
        success: false,
        error: '整備前後のデータが必要です'
      });
    }

    const analyzer = new QualityAnalyzer(options);
    const results = analyzer.analyzeQuality(beforeData, afterData);
    const report = analyzer.generateReport(results);

    res.json({
      success: true,
      data: {
        analysis: results,
        report: report
      }
    });
  } catch (error) {
    console.error('品質分析エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手検測データ相関分析
 * POST /api/analysis/field-correlation
 */
router.post('/field-correlation', async (req, res) => {
  try {
    const { fieldMeasurement, trackData, options } = req.body;

    if (!fieldMeasurement || !trackData) {
      return res.status(400).json({
        success: false,
        error: '手検測データと軌道データが必要です'
      });
    }

    const analyzer = new FieldMeasurementAnalyzer(options);
    const correlation = analyzer.calculateCorrelation(fieldMeasurement, trackData);

    res.json({
      success: true,
      data: correlation
    });
  } catch (error) {
    console.error('相関分析エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 複数手検測データ統合
 * POST /api/analysis/integrate-field-measurements
 */
router.post('/integrate-field-measurements', async (req, res) => {
  try {
    const { fieldMeasurements, trackData, options } = req.body;

    if (!fieldMeasurements || !Array.isArray(fieldMeasurements)) {
      return res.status(400).json({
        success: false,
        error: '複数の手検測データが必要です'
      });
    }

    const analyzer = new FieldMeasurementAnalyzer(options);
    const integration = analyzer.integrateMultipleMeasurements(
      fieldMeasurements,
      trackData
    );

    res.json({
      success: true,
      data: integration
    });
  } catch (error) {
    console.error('統合分析エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 縦曲線データ管理
 * POST /api/analysis/vertical-curves
 */
router.post('/vertical-curves', async (req, res) => {
  try {
    const { action, data, options } = req.body;
    const manager = new VerticalCurveManager(options);

    let result;
    switch (action) {
      case 'add':
        result = manager.addVerticalCurve(data);
        break;

      case 'calculate':
        const { position, curves } = data;
        result = manager.calculateGradientAtPosition(position, curves);
        break;

      case 'adjust':
        const { elevationData, curves: curvesData } = data;
        result = manager.adjustForVerticalCurves(elevationData, curvesData);
        break;

      case 'generateTable':
        const { curves: curveList, workSection } = data;
        result = manager.generateCurveTable(curveList, workSection);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: '無効なアクションです'
        });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('縦曲線処理エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 波長帯域別改善効果予測
 * POST /api/analysis/improvement-prediction
 */
router.post('/improvement-prediction', async (req, res) => {
  try {
    const { beforeData, afterData, options } = req.body;

    const analyzer = new WavebandAnalyzer(options);
    const improvements = analyzer.predictImprovementByBand(beforeData, afterData);

    res.json({
      success: true,
      data: improvements
    });
  } catch (error) {
    console.error('改善予測エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ALS形式データエクスポート
 * POST /api/export/als
 */
router.post('/export/als', async (req, res) => {
  try {
    const { movementData, workSection, options } = req.body;

    const exporter = new ALSExporter(options);
    const filePath = await exporter.exportALSData(movementData, workSection);

    res.json({
      success: true,
      data: {
        filePath: filePath,
        message: 'ALS形式でエクスポートしました'
      }
    });
  } catch (error) {
    console.error('ALSエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ALC形式データエクスポート
 * POST /api/export/alc
 */
router.post('/export/alc', async (req, res) => {
  try {
    const { movementData, workSection, options } = req.body;

    const exporter = new ALCExporter(options);
    const filePath = await exporter.exportALCData(movementData, workSection);

    res.json({
      success: true,
      data: {
        filePath: filePath,
        message: 'ALC形式でエクスポートしました'
      }
    });
  } catch (error) {
    console.error('ALCエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * MJ作業用データエクスポート
 * POST /api/export/mj
 */
router.post('/export/mj', async (req, res) => {
  try {
    const { data, workSection, options } = req.body;

    const exporter = new MJDataExporter(options);
    const filePath = await exporter.exportMJData(data, workSection);

    res.json({
      success: true,
      data: {
        filePath: filePath,
        message: 'MJ作業用データをエクスポートしました'
      }
    });
  } catch (error) {
    console.error('MJエクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 汎用移動量データエクスポート
 * POST /api/export/general
 */
router.post('/export/general', async (req, res) => {
  try {
    const { data, workSection, options } = req.body;

    const exporter = new GeneralDataExporter(options);
    const results = await exporter.exportAllFormats(data, workSection);

    res.json({
      success: true,
      data: {
        files: results,
        message: '全形式でエクスポートしました'
      }
    });
  } catch (error) {
    console.error('汎用エクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 総合レポート生成
 * POST /api/report/comprehensive
 */
router.post('/report/comprehensive', async (req, res) => {
  try {
    const { analysisData, workSection, options } = req.body;

    if (!analysisData || !workSection) {
      return res.status(400).json({
        success: false,
        error: '分析データと作業区間情報が必要です'
      });
    }

    const generator = new ComprehensiveReportGenerator(options);
    const report = await generator.generateReport(analysisData, workSection);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('レポート生成エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手検測データアップロード
 * POST /api/upload/field-measurement
 */
router.post('/upload/field-measurement', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'ファイルがアップロードされていません'
      });
    }

    // ファイル解析処理（実装は簡略化）
    const filePath = req.file.path;
    const measurementData = await parseFieldMeasurementFile(filePath);

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        measurements: measurementData
      }
    });
  } catch (error) {
    console.error('アップロードエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * バッチ分析処理
 * POST /api/analysis/batch
 */
router.post('/analysis/batch', async (req, res) => {
  try {
    const { data, analyses, workSection } = req.body;
    const results = {};

    // 波長帯域分析
    if (analyses.includes('waveband')) {
      const analyzer = new WavebandAnalyzer();
      results.waveband = analyzer.analyzeWavebands(data.trackData);
    }

    // 品質分析
    if (analyses.includes('quality')) {
      const analyzer = new QualityAnalyzer();
      results.quality = analyzer.analyzeQuality(data.before, data.after);
    }

    // 縦曲線分析
    if (analyses.includes('verticalCurve') && data.verticalCurves) {
      const manager = new VerticalCurveManager();
      results.verticalCurve = manager.generateCurveTable(
        data.verticalCurves,
        workSection
      );
    }

    // 総合レポート生成
    if (analyses.includes('report')) {
      const generator = new ComprehensiveReportGenerator();
      results.report = await generator.generateReport(
        {
          ...results,
          movements: data.movements,
          trackData: data.trackData
        },
        workSection
      );
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('バッチ分析エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 分析状態取得
 * GET /api/analysis/status/:analysisId
 */
router.get('/status/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;

    // 分析状態の取得（実装は簡略化）
    const status = await getAnalysisStatus(analysisId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('状態取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ヘルパー関数（実装は簡略化）
async function parseFieldMeasurementFile(filePath) {
  // CSVファイルの解析などを実装
  return [];
}

async function getAnalysisStatus(analysisId) {
  // 分析状態の管理実装
  return {
    id: analysisId,
    status: 'completed',
    progress: 100
  };
}

module.exports = router;