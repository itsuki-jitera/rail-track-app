/**
 * 曲線諸元管理 APIルート (VB6 KCDW互換)
 *
 * 曲線諸元データのインポート、エクスポート、管理機能を提供
 */

const express = require('express');
const multer = require('multer');
const CurveSpecParser = require('../parsers/curve-spec-parser');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// メモリ上の曲線諸元データストア（実運用ではデータベースを使用）
let curveSpecStore = new Map();
let currentProjectId = 'default';

/**
 * POST /api/curve-spec/import
 * 曲線諸元CSVをインポート
 */
router.post('/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'ファイルがアップロードされていません'
      });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const result = CurveSpecParser.parseCurveSpecCSV(csvContent);

    if (result.success) {
      // プロジェクトIDを取得（デフォルトまたはリクエストから）
      const projectId = req.body.projectId || currentProjectId;

      // 曲線諸元データを保存
      curveSpecStore.set(projectId, {
        curveSpecs: result.curveSpecs,
        filename: req.file.originalname,
        uploadedAt: new Date().toISOString(),
        summary: result.summary
      });

      res.json({
        success: true,
        message: `${result.curveSpecs.length}件の曲線諸元をインポートしました`,
        projectId,
        summary: result.summary,
        curveSpecs: result.curveSpecs
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'CSVの解析に失敗しました',
        errors: result.errors
      });
    }
  } catch (error) {
    console.error('Curve spec import error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * GET /api/curve-spec/list
 * 曲線諸元一覧を取得
 */
router.get('/list', (req, res) => {
  try {
    const projectId = req.query.projectId || currentProjectId;
    const data = curveSpecStore.get(projectId);

    if (!data) {
      return res.json({
        success: true,
        curveSpecs: [],
        summary: null,
        message: '曲線諸元データが登録されていません'
      });
    }

    res.json({
      success: true,
      curveSpecs: data.curveSpecs,
      summary: data.summary,
      filename: data.filename,
      uploadedAt: data.uploadedAt
    });
  } catch (error) {
    console.error('Curve spec list error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * GET /api/curve-spec/range
 * キロ程範囲内の曲線諸元を取得
 */
router.get('/range', (req, res) => {
  try {
    const projectId = req.query.projectId || currentProjectId;
    const startKP = parseFloat(req.query.startKP);
    const endKP = parseFloat(req.query.endKP);

    if (isNaN(startKP) || isNaN(endKP)) {
      return res.status(400).json({
        success: false,
        error: 'startKPとendKPを指定してください'
      });
    }

    const data = curveSpecStore.get(projectId);
    if (!data) {
      return res.json({
        success: true,
        curveSpecs: [],
        message: '曲線諸元データが登録されていません'
      });
    }

    const curvesInRange = CurveSpecParser.findCurvesInRange(
      data.curveSpecs,
      startKP,
      endKP
    );

    res.json({
      success: true,
      curveSpecs: curvesInRange,
      range: { startKP, endKP },
      count: curvesInRange.length
    });
  } catch (error) {
    console.error('Curve spec range query error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /api/curve-spec/validate
 * 曲線諸元の整合性チェック
 */
router.post('/validate', (req, res) => {
  try {
    const projectId = req.body.projectId || currentProjectId;
    const data = curveSpecStore.get(projectId);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: '曲線諸元データが登録されていません'
      });
    }

    const validation = CurveSpecParser.validateContinuity(data.curveSpecs);

    res.json({
      success: true,
      isValid: validation.isValid,
      errors: validation.errors,
      message: validation.isValid
        ? '曲線諸元データに問題ありません'
        : `${validation.errors.length}件の問題が見つかりました`
    });
  } catch (error) {
    console.error('Curve spec validation error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * GET /api/curve-spec/export
 * 曲線諸元をCSV形式でエクスポート
 */
router.get('/export', (req, res) => {
  try {
    const projectId = req.query.projectId || currentProjectId;
    const data = curveSpecStore.get(projectId);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: '曲線諸元データが登録されていません'
      });
    }

    const csv = CurveSpecParser.toCurveSpecCSV(data.curveSpecs, true);
    const filename = `curve_spec_${projectId}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // UTF-8 BOM付き
  } catch (error) {
    console.error('Curve spec export error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * PUT /api/curve-spec/update
 * 曲線諸元を更新
 */
router.put('/update', (req, res) => {
  try {
    const projectId = req.body.projectId || currentProjectId;
    const { curveSpecs } = req.body;

    if (!curveSpecs || !Array.isArray(curveSpecs)) {
      return res.status(400).json({
        success: false,
        error: 'curveSpecs配列が必要です'
      });
    }

    // サマリーを再計算
    const summary = {
      totalCurves: curveSpecs.length,
      straightCount: curveSpecs.filter(c => c.curveType === 'straight').length,
      transitionCount: curveSpecs.filter(c => c.curveType === 'transition').length,
      circularCount: curveSpecs.filter(c => c.curveType === 'circular').length,
      totalLength: curveSpecs.reduce((sum, c) => sum + (c.endKP - c.startKP), 0)
    };

    curveSpecStore.set(projectId, {
      curveSpecs,
      filename: 'updated',
      uploadedAt: new Date().toISOString(),
      summary
    });

    res.json({
      success: true,
      message: '曲線諸元を更新しました',
      summary
    });
  } catch (error) {
    console.error('Curve spec update error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * DELETE /api/curve-spec/clear
 * 曲線諸元データをクリア
 */
router.delete('/clear', (req, res) => {
  try {
    const projectId = req.query.projectId || currentProjectId;

    if (curveSpecStore.has(projectId)) {
      curveSpecStore.delete(projectId);
      res.json({
        success: true,
        message: '曲線諸元データをクリアしました'
      });
    } else {
      res.json({
        success: true,
        message: '曲線諸元データは存在しません'
      });
    }
  } catch (error) {
    console.error('Curve spec clear error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
});

module.exports = router;
