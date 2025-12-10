/**
 * 軌道環境データ処理API
 * Track Environment Data Processing Endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const trackEnvironmentProcessor = require('../processors/track-environment-processor');

// アップロード設定
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/track-env');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${timestamp}_${originalName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (originalName.match(/\.(TBL|DDB)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only .TBL and .DDB files are allowed'));
    }
  }
});

/**
 * POST /api/track-env/dataset
 * 新しいデータセットを作成
 */
router.post('/dataset', (req, res) => {
  try {
    const { config } = req.body;

    const datasetId = trackEnvironmentProcessor.createDataset(config || {});
    const dataset = trackEnvironmentProcessor.getDataset(datasetId);

    res.json({
      success: true,
      datasetId,
      dataset
    });
  } catch (error) {
    console.error('データセット作成エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/track-env/dataset/:datasetId
 * データセット情報を取得
 */
router.get('/dataset/:datasetId', (req, res) => {
  try {
    const { datasetId } = req.params;
    const dataset = trackEnvironmentProcessor.getDataset(datasetId);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    res.json({
      success: true,
      dataset
    });
  } catch (error) {
    console.error('データセット取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/track-env/datasets
 * すべてのデータセットを取得
 */
router.get('/datasets', (req, res) => {
  try {
    const datasets = trackEnvironmentProcessor.getAllDatasets();

    res.json({
      success: true,
      datasets,
      count: datasets.length
    });
  } catch (error) {
    console.error('データセット一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/track-env/upload
 * 軌道環境データファイルをアップロード
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { datasetId } = req.body;

    if (!datasetId) {
      return res.status(400).json({
        success: false,
        error: 'datasetId is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // TBLファイルのみ処理（DDBはスキップ）
    if (!originalName.match(/\.TBL$/i)) {
      return res.json({
        success: true,
        message: 'DDBファイルは参照情報として保存されました',
        skipped: true
      });
    }

    // パーサーを動的にロード
    const parserPath = path.join(__dirname, '../parsers/track-environment-parser.js');
    const { parseTrackEnvironmentData } = await import(`file:///${parserPath.replace(/\\/g, '/')}`);

    // ファイルを読み込んで解析
    const buffer = await fs.readFile(req.file.path);
    const parsedData = parseTrackEnvironmentData(buffer, originalName);

    if (!parsedData.success) {
      return res.status(400).json({
        success: false,
        error: `Failed to parse file: ${parsedData.error}`
      });
    }

    // データセットに追加
    const dataType = parsedData.fileInfo.dataType;
    const dataset = await trackEnvironmentProcessor.addFile(
      datasetId,
      dataType,
      req.file.path,
      parsedData
    );

    res.json({
      success: true,
      message: `${parsedData.dataTypeName}をアップロードしました`,
      file: {
        originalName,
        dataType,
        dataTypeName: parsedData.dataTypeName,
        recordCount: parsedData.recordCount
      },
      dataset
    });
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/track-env/upload/batch
 * 複数ファイルを一括アップロード
 */
router.post('/upload/batch', upload.array('files', 20), async (req, res) => {
  try {
    let { datasetId } = req.body;

    if (!datasetId) {
      // データセットIDがない場合は新規作成
      datasetId = trackEnvironmentProcessor.createDataset({
        source: 'batch_upload',
        uploadedAt: new Date().toISOString()
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const results = [];
    const parserPath = path.join(__dirname, '../parsers/track-environment-parser.js');
    const { parseTrackEnvironmentData } = await import(`file:///${parserPath.replace(/\\/g, '/')}`);

    for (const file of req.files) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

      // TBLファイルのみ処理
      if (!originalName.match(/\.TBL$/i)) {
        results.push({
          file: originalName,
          success: true,
          skipped: true,
          message: 'DDBファイルは参照情報として保存されました'
        });
        continue;
      }

      try {
        const buffer = await fs.readFile(file.path);
        const parsedData = parseTrackEnvironmentData(buffer, originalName);

        if (parsedData.success) {
          const dataType = parsedData.fileInfo.dataType;
          await trackEnvironmentProcessor.addFile(
            datasetId,
            dataType,
            file.path,
            parsedData
          );

          results.push({
            file: originalName,
            success: true,
            dataType,
            dataTypeName: parsedData.dataTypeName,
            recordCount: parsedData.recordCount
          });
        } else {
          results.push({
            file: originalName,
            success: false,
            error: parsedData.error
          });
        }
      } catch (error) {
        results.push({
          file: originalName,
          success: false,
          error: error.message
        });
      }
    }

    const dataset = trackEnvironmentProcessor.getDataset(datasetId);

    res.json({
      success: true,
      message: `${results.length}個のファイルを処理しました`,
      datasetId,
      results,
      dataset
    });
  } catch (error) {
    console.error('バッチアップロードエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/track-env/dataset/:datasetId/range
 * キロ程範囲でデータを検索
 */
router.get('/dataset/:datasetId/range', (req, res) => {
  try {
    const { datasetId } = req.params;
    const { startKm, endKm } = req.query;

    if (!startKm || !endKm) {
      return res.status(400).json({
        success: false,
        error: 'startKm and endKm are required'
      });
    }

    const data = trackEnvironmentProcessor.findDataByRange(
      datasetId,
      parseFloat(startKm),
      parseFloat(endKm)
    );

    res.json({
      success: true,
      range: { startKm: parseFloat(startKm), endKm: parseFloat(endKm) },
      data
    });
  } catch (error) {
    console.error('範囲検索エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/track-env/dataset/:datasetId/statistics
 * データセットの統計情報を取得
 */
router.get('/dataset/:datasetId/statistics', (req, res) => {
  try {
    const { datasetId } = req.params;
    const stats = trackEnvironmentProcessor.calculateStatistics(datasetId);

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('統計情報取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/track-env/dataset/:datasetId/export
 * データセットをエクスポート
 */
router.get('/dataset/:datasetId/export', (req, res) => {
  try {
    const { datasetId } = req.params;
    const { format = 'json' } = req.query;

    const data = trackEnvironmentProcessor.exportData(datasetId, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="track_env_${datasetId}.csv"`);
      res.send('\uFEFF' + data); // UTF-8 BOM
    } else {
      res.json({
        success: true,
        data
      });
    }
  } catch (error) {
    console.error('エクスポートエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/track-env/dataset/:datasetId
 * データセットを削除
 */
router.delete('/dataset/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params;
    const dataset = trackEnvironmentProcessor.getDataset(datasetId);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    // ファイルを削除
    const filesToDelete = Object.values(dataset.files);
    for (const filePath of filesToDelete) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn(`ファイル削除失敗: ${filePath}`, error);
      }
    }

    // データセットを削除
    trackEnvironmentProcessor.deleteDataset(datasetId);

    res.json({
      success: true,
      message: 'データセットを削除しました',
      datasetId
    });
  } catch (error) {
    console.error('データセット削除エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/track-env/statistics
 * 全体の統計情報を取得
 */
router.get('/statistics', (req, res) => {
  try {
    const stats = trackEnvironmentProcessor.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('統計情報取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/track-env/supported-types
 * サポートされているデータ型のリストを取得
 */
router.get('/supported-types', async (req, res) => {
  try {
    const parserPath = path.join(__dirname, '../parsers/track-environment-parser.js');
    const { getSupportedDataTypes } = await import(`file:///${parserPath.replace(/\\/g, '/')}`);

    const types = getSupportedDataTypes();

    res.json({
      success: true,
      types
    });
  } catch (error) {
    console.error('データ型一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/track-env/info
 * 軌道環境データ処理情報を取得
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    info: {
      name: 'Track Environment Data Processor',
      version: '1.0.0',
      description: '軌道環境データ処理システム',
      fileFormat: 'LABOCS形式 (.TBL/.DDB)',
      fileNamingConvention: 'LLLTSUDD.TBL (例: TKD014KR.TBL)',
      supportedDataTypes: [
        'EM: 駅名データ',
        'JS: こう配データ（縦断線形）',
        'HS: 曲線データ（平面線形）',
        'KR: 構造物・路盤データ',
        'RT/RU: レール継目データ（左/右）',
        'DS: 道床データ',
        'BK: 分岐器データ',
        'EJ: EJデータ',
        'IJ: IJデータ'
      ],
      requiredDataTypes: ['JS', 'HS', 'KR', 'RT', 'DS', 'BK', 'EJ', 'IJ']
    }
  });
});

module.exports = router;
