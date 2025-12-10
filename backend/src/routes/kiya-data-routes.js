/**
 * キヤデータ処理API
 * Kiya 141 inspection car data processing endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const kiyaDataProcessor = require('../processors/kiya-data-processor');

// アップロード設定
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/kiya');
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
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/**
 * POST /api/kiya-data/dataset
 * 新しいデータセットを作成
 */
router.post('/dataset', (req, res) => {
  try {
    const { config } = req.body;

    const datasetId = kiyaDataProcessor.createDataset(config || {});
    const dataset = kiyaDataProcessor.getDataset(datasetId);

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
 * GET /api/kiya-data/dataset/:datasetId
 * データセット情報を取得
 */
router.get('/dataset/:datasetId', (req, res) => {
  try {
    const { datasetId } = req.params;
    const dataset = kiyaDataProcessor.getDataset(datasetId);

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
 * GET /api/kiya-data/datasets
 * すべてのデータセットを取得
 */
router.get('/datasets', (req, res) => {
  try {
    const datasets = kiyaDataProcessor.getAllDatasets();

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
 * POST /api/kiya-data/upload/lk
 * LKファイルをアップロード（線区管理ファイル）
 */
router.post('/upload/lk', upload.single('file'), async (req, res) => {
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

    const dataset = await kiyaDataProcessor.addFile(
      datasetId,
      'lk',
      req.file.path
    );

    res.json({
      success: true,
      message: 'LKファイルをアップロードしました',
      file: {
        originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        path: req.file.path,
        size: req.file.size
      },
      dataset
    });
  } catch (error) {
    console.error('LKファイルアップロードエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/kiya-data/upload/ck
 * CKファイルをアップロード（曲線情報ファイル）
 */
router.post('/upload/ck', upload.single('file'), async (req, res) => {
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

    const dataset = await kiyaDataProcessor.addFile(
      datasetId,
      'ck',
      req.file.path
    );

    res.json({
      success: true,
      message: 'CKファイルをアップロードしました',
      file: {
        originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        path: req.file.path,
        size: req.file.size
      },
      dataset
    });
  } catch (error) {
    console.error('CKファイルアップロードエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/kiya-data/upload/o010
 * O010ファイルをアップロード（旧測定データ）
 */
router.post('/upload/o010', upload.single('file'), async (req, res) => {
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

    const dataset = await kiyaDataProcessor.addFile(
      datasetId,
      'o010',
      req.file.path
    );

    res.json({
      success: true,
      message: 'O010ファイルをアップロードしました',
      file: {
        originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        path: req.file.path,
        size: req.file.size
      },
      dataset
    });
  } catch (error) {
    console.error('O010ファイルアップロードエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/kiya-data/upload/batch
 * 複数ファイルを一括アップロード（LK, CK, O010を同時に）
 */
router.post('/upload/batch', upload.fields([
  { name: 'lkFile', maxCount: 1 },
  { name: 'ckFile', maxCount: 1 },
  { name: 'o010File', maxCount: 1 }
]), async (req, res) => {
  try {
    const { datasetId } = req.body;

    if (!datasetId) {
      // データセットIDがない場合は新規作成
      const newDatasetId = kiyaDataProcessor.createDataset({
        source: 'batch_upload',
        uploadedAt: new Date().toISOString()
      });
      req.body.datasetId = newDatasetId;
    }

    const results = {
      lk: null,
      ck: null,
      o010: null
    };

    // LKファイル処理
    if (req.files.lkFile && req.files.lkFile[0]) {
      const dataset = await kiyaDataProcessor.addFile(
        req.body.datasetId,
        'lk',
        req.files.lkFile[0].path
      );
      results.lk = {
        success: true,
        file: req.files.lkFile[0].originalname
      };
    }

    // CKファイル処理
    if (req.files.ckFile && req.files.ckFile[0]) {
      const dataset = await kiyaDataProcessor.addFile(
        req.body.datasetId,
        'ck',
        req.files.ckFile[0].path
      );
      results.ck = {
        success: true,
        file: req.files.ckFile[0].originalname
      };
    }

    // O010ファイル処理
    if (req.files.o010File && req.files.o010File[0]) {
      const dataset = await kiyaDataProcessor.addFile(
        req.body.datasetId,
        'o010',
        req.files.o010File[0].path
      );
      results.o010 = {
        success: true,
        file: req.files.o010File[0].originalname
      };
    }

    const dataset = kiyaDataProcessor.getDataset(req.body.datasetId);

    res.json({
      success: true,
      message: 'ファイルを一括アップロードしました',
      datasetId: req.body.datasetId,
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
 * POST /api/kiya-data/convert/labocs
 * LABOCS形式に変換
 */
router.post('/convert/labocs', async (req, res) => {
  try {
    const { datasetId, options } = req.body;

    if (!datasetId) {
      return res.status(400).json({
        success: false,
        error: 'datasetId is required'
      });
    }

    const labocs = await kiyaDataProcessor.convertToLABOCS(datasetId, options);

    res.json({
      success: true,
      message: 'LABOCS形式に変換しました',
      labocs
    });
  } catch (error) {
    console.error('LABOCS変換エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kiya-data/dataset/:datasetId/position-info
 * 位置情報を取得
 */
router.get('/dataset/:datasetId/position-info', (req, res) => {
  try {
    const { datasetId } = req.params;
    const dataset = kiyaDataProcessor.getDataset(datasetId);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    res.json({
      success: true,
      positionInfo: dataset.data.positionInfo,
      metadata: dataset.metadata
    });
  } catch (error) {
    console.error('位置情報取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kiya-data/dataset/:datasetId/measurements
 * 測定データを取得
 */
router.get('/dataset/:datasetId/measurements', (req, res) => {
  try {
    const { datasetId } = req.params;
    const dataset = kiyaDataProcessor.getDataset(datasetId);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    res.json({
      success: true,
      measurements: dataset.data.measurements,
      standardMeasurements: dataset.data.standardMeasurements,
      count: dataset.data.measurements?.length || 0
    });
  } catch (error) {
    console.error('測定データ取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/kiya-data/dataset/:datasetId
 * データセットを削除
 */
router.delete('/dataset/:datasetId', async (req, res) => {
  try {
    const { datasetId } = req.params;
    const dataset = kiyaDataProcessor.getDataset(datasetId);

    if (!dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    // ファイルを削除
    const filesToDelete = Object.values(dataset.files).filter(f => f);
    for (const filePath of filesToDelete) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn(`ファイル削除失敗: ${filePath}`, error);
      }
    }

    // データセットを削除
    kiyaDataProcessor.deleteDataset(datasetId);

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
 * GET /api/kiya-data/statistics
 * 統計情報を取得
 */
router.get('/statistics', (req, res) => {
  try {
    const stats = kiyaDataProcessor.getStatistics();

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
 * GET /api/kiya-data/info
 * キヤデータ処理情報を取得
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    info: {
      name: 'Kiya 141 Data Processor',
      version: '1.0.0',
      description: 'キヤ141検測車データ処理システム',
      supportedFiles: [
        {
          type: 'lk',
          name: 'LKファイル（線区管理ファイル）',
          pattern: 'LK*.csv',
          description: '線路名、管理値、管理区間情報を含む'
        },
        {
          type: 'ck',
          name: 'CKファイル（曲線情報ファイル）',
          pattern: 'CK*.csv',
          description: '曲線、構造物、駅等の位置情報を含む'
        },
        {
          type: 'o010',
          name: 'O010ファイル（旧測定データ）',
          pattern: 'O010*.csv',
          description: 'タイプ13/14の測定データを含む'
        }
      ],
      processingFlow: [
        '1. LKファイルから線路名を抽出',
        '2. CKファイルから位置情報を作成',
        '3. O010ファイルから測定データを読み込み',
        '4. LABOCS形式に変換',
        '5. 検知状況を確認'
      ],
      dataInterval: 0.25, // m
      alignmentMethods: ['Data depot', 'ATS地上子']
    }
  });
});

module.exports = router;
